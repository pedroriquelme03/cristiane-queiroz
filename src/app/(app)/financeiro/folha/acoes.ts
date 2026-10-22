"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import {
  getConfigFolha,
  getFolhaMeses,
  getUnidadesFolha,
  type ConfigFolha,
} from "@/lib/dados-folha";
import { montarContexto } from "@/lib/folha-contexto";
import {
  calcularLinha,
  conferir,
  lancamentosDre,
  NATUREZAS_DRE,
  totalizar,
} from "@/lib/folha-analitica";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const PAPEIS_EDICAO = ["admin", "cliente"] as const;

const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Competência inválida.");
const valor = z.number().finite();
const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

async function contexto(empresaIdInformada: string, papeis: readonly ("admin" | "cliente" | "consultor")[] = PAPEIS_EDICAO) {
  const alvo = await resolverEmpresaAlvo(empresaIdInformada, {
    papeis: [...papeis],
    negado: "Seu perfil não pode alterar a apuração da folha.",
    semEmpresa: "Selecione uma empresa antes de continuar.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

/** Mensagem amigável para erros do banco (migration ausente, competência fechada). */
function erroBanco(error: { message?: string; code?: string } | null, padrao: string): string {
  const m = error?.message ?? "";
  if (/fechada|não está fechada|já está fechada/i.test(m)) return m;
  if (/importar_folha_relatorio|fechar_folha|folha_[a-z_]+|acesso_folha|column .*unidade_id/i.test(m)) {
    return "O banco ainda não tem a estrutura nova da folha (migration 0025).";
  }
  return padrao;
}

async function registrarEvento(
  empresaId: string,
  usuarioId: string,
  evento: {
    competencia?: string | null;
    unidadeId?: string | null;
    tipo: string;
    descricao: string;
    detalhes?: Record<string, unknown>;
  },
) {
  // Auditoria nunca derruba a operação principal, que já foi gravada
  await supabaseAdmin.from("folha_eventos").insert({
    empresa_id: empresaId,
    competencia: evento.competencia ?? null,
    unidade_id: evento.unidadeId ?? null,
    tipo: evento.tipo,
    descricao: evento.descricao,
    detalhes: evento.detalhes ?? {},
    usuario_id: usuarioId || null,
  });
}

async function competenciaFechada(empresaId: string, competencia: string) {
  const { data } = await supabaseAdmin
    .from("folha_competencias")
    .select("status")
    .eq("empresa_id", empresaId)
    .eq("competencia", competencia)
    .maybeSingle();
  return data?.status === "fechada";
}

const revalidar = () => revalidatePath("/financeiro/folha", "layout");

// ---------------------------------------------------------------------------
// Importação: um ou mais relatórios (um por unidade) da mesma competência

const rubricaSchema = z.object({
  codigo: z.string().max(20),
  descricao: z.string().max(200),
  tipo: z.enum(["P", "D"]),
  referencia: z.string().max(30),
  valor,
});

const funcionarioSchema = z.object({
  matricula: z.string().min(1).max(30),
  nome: z.string().min(1).max(200),
  situacao: z.string().max(60),
  cpf: z.string().max(20).nullable(),
  admissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  vinculo: z.string().max(60).nullable(),
  centroCusto: z.string().max(30).nullable(),
  departamento: z.string().max(30).nullable(),
  horasMes: valor.nullable(),
  cargoCodigo: z.string().max(30).nullable(),
  cargo: z.string().max(200).nullable(),
  cbo: z.string().max(20).nullable(),
  filial: z.string().max(30).nullable(),
  salario: valor.nullable(),
  proventos: valor,
  descontos: valor,
  informativa: valor,
  liquido: valor,
  baseInss: valor,
  excedenteInss: valor,
  baseFgts: valor,
  valorFgts: valor,
  baseIrrf: valor,
  rubricas: z.array(rubricaSchema).max(300),
  observacoes: z.array(z.string().max(300)).max(50),
});

const relatorioSchema = z.object({
  arquivoNome: z.string().min(1).max(255),
  /** Unidade existente ou criada a partir do relatório. */
  unidadeId: z.string().uuid().nullable(),
  criarUnidade: z.string().trim().min(1).max(120).nullable(),
  /** Usuário confirmou importar mesmo com CNPJ diferente do cadastro da unidade. */
  confirmarCnpj: z.boolean().default(false),
  empresa: z.object({
    codigo: z.string().max(30).nullable(),
    nome: z.string().max(200),
    cnpj: z.string().max(30).nullable(),
  }),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida no relatório."),
  funcionarios: z.array(funcionarioSchema).min(1, "O relatório não tem funcionários.").max(5000),
  resumoRubricas: z.array(rubricaSchema).max(2000),
  totais: z.object({ proventos: valor, descontos: valor, liquido: valor }),
  encargos: z.record(z.string().max(120), valor),
  situacoes: z.record(z.string().max(120), valor),
  avisos: z.array(z.string().max(500)).max(200),
});

const importacaoSchema = z.object({
  competencia: competenciaSchema,
  relatorios: z.array(relatorioSchema).min(1, "Escolha ao menos um relatório.").max(10),
});

export interface ResultadoRelatorio {
  arquivoNome: string;
  ok: boolean;
  mensagem: string;
  cnpjDiferente?: boolean;
}

export async function importarRelatoriosFolha(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado<{ resultados: ResultadoRelatorio[] }>> {
  const dados = importacaoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: dados.error.issues[0]?.message ?? "Relatórios inválidos." };
  const { competencia, relatorios } = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };
  const { empresaId, sessao } = alvo;

  if (await competenciaFechada(empresaId, competencia)) {
    return { ok: false, erro: "Esta competência está fechada. Reabra antes de importar." };
  }

  const usadas = new Set<string>();
  const resultados: ResultadoRelatorio[] = [];

  for (const r of relatorios) {
    const falhar = (mensagem: string, extra?: Partial<ResultadoRelatorio>) =>
      resultados.push({ arquivoNome: r.arquivoNome, ok: false, mensagem, ...extra });

    if (`${r.competencia}-01` !== competencia) {
      falhar(`O relatório é de ${r.competencia.slice(5)}/${r.competencia.slice(0, 4)}, não da competência escolhida.`);
      continue;
    }
    const cnpjRelatorio = digitos(r.empresa.cnpj) || null;

    // Unidade: a escolhida (precisa ser da empresa) ou uma nova com o CNPJ do relatório
    let unidade: { id: string; nome: string; cnpj: string | null } | null = null;
    if (r.unidadeId) {
      const { data } = await supabaseAdmin
        .from("unidades")
        .select("id, nome, cnpj")
        .eq("id", r.unidadeId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      unidade = data;
      if (!unidade) {
        falhar("Unidade não encontrada nesta empresa.");
        continue;
      }
    } else if (r.criarUnidade) {
      const { data, error } = await supabaseAdmin
        .from("unidades")
        .insert({ empresa_id: empresaId, nome: r.criarUnidade, tipo: "filial", cnpj: cnpjRelatorio })
        .select("id, nome, cnpj")
        .single();
      if (error || !data) {
        falhar(
          error?.code === "23505"
            ? "Já existe uma unidade com este CNPJ; escolha-a na lista."
            : erroBanco(error, "Não foi possível criar a unidade."),
        );
        continue;
      }
      unidade = data;
      await registrarEvento(empresaId, sessao.usuarioId, {
        competencia,
        unidadeId: data.id,
        tipo: "cadastro",
        descricao: `Unidade ${data.nome} criada na importação`,
        detalhes: { cnpj: cnpjRelatorio },
      });
    } else {
      falhar("Escolha a unidade do relatório.");
      continue;
    }

    if (usadas.has(unidade.id)) {
      falhar(`Dois relatórios para ${unidade.nome} na mesma importação.`);
      continue;
    }
    usadas.add(unidade.id);

    // CNPJ: grava na unidade se ela ainda não tem; barra divergência sem confirmação
    if (cnpjRelatorio && !unidade.cnpj) {
      const { error } = await supabaseAdmin.from("unidades").update({ cnpj: cnpjRelatorio }).eq("id", unidade.id);
      if (!error) unidade.cnpj = cnpjRelatorio;
    } else if (cnpjRelatorio && unidade.cnpj && unidade.cnpj !== cnpjRelatorio && !r.confirmarCnpj) {
      falhar(`CNPJ do relatório (${r.empresa.cnpj}) diferente do cadastro de ${unidade.nome}.`, { cnpjDiferente: true });
      continue;
    }

    const { data: rpc, error } = await supabaseAdmin.rpc("importar_folha_relatorio", {
      p_empresa_id: empresaId,
      p_competencia: competencia,
      p_unidade_id: unidade.id,
      p_usuario: sessao.usuarioId || null,
      p_apuracao: {
        arquivo_nome: r.arquivoNome,
        empresa_relatorio: r.empresa,
        totais: r.totais,
        encargos: r.encargos,
        situacoes: r.situacoes,
        resumo_rubricas: r.resumoRubricas,
        avisos: r.avisos,
        // Ponto de partida do FGTS do mês; o usuário pode ajustar na tela
        manuais: { fgts: r.encargos["Valor do FGTS"] ?? 0 },
      },
      // CPF vai para folha_cpfs (acesso restrito), não para a linha do funcionário
      p_cpfs: r.funcionarios
        .map((f) => ({ matricula: f.matricula, cpf: digitos(f.cpf) }))
        .filter((c) => c.cpf.length === 11),
      p_funcionarios: r.funcionarios.map((f) => ({
        matricula: f.matricula,
        nome: f.nome,
        situacao: f.situacao,
        vinculo: f.vinculo,
        admissao: f.admissao,
        centro_custo: f.centroCusto,
        departamento: f.departamento,
        cargo_codigo: f.cargoCodigo,
        cargo: f.cargo,
        cbo: f.cbo,
        filial: f.filial,
        horas_mes: f.horasMes,
        salario: f.salario,
        proventos: f.proventos,
        descontos: f.descontos,
        informativa: f.informativa,
        liquido: f.liquido,
        base_inss: f.baseInss,
        excedente_inss: f.excedenteInss,
        base_fgts: f.baseFgts,
        valor_fgts: f.valorFgts,
        base_irrf: f.baseIrrf,
        rubricas: f.rubricas,
        observacoes: f.observacoes,
      })),
    });

    if (error) {
      falhar(erroBanco(error, "Não foi possível gravar o relatório."));
      continue;
    }
    const versao = (rpc as { versao?: number } | null)?.versao ?? 1;
    resultados.push({
      arquivoNome: r.arquivoNome,
      ok: true,
      mensagem: `${unidade.nome}: ${r.funcionarios.length} funcionários${versao > 1 ? ` (versão ${versao}, substitui a anterior)` : ""}.`,
    });
  }

  revalidar();
  return { ok: true, resultados };
}

// ---------------------------------------------------------------------------
// Rubricas

const configSchema = z.object({
  codigo: z.string().min(1).max(20),
  tipo: z.enum(["P", "D"]),
  descricao: z.string().max(200),
  efeito: z.enum(["soma", "subtrai", "ignora"]),
  categoria: z.enum([
    "proventos", "comissao", "produtividade", "retornos", "decimo_terceiro",
    "ferias", "terco_ferias", "inss", "inss_13", "inss_ferias", "ignorar",
  ]),
  coluna: z
    .enum([
      "salario", "he50", "he100", "adicional_noturno", "gratificacoes", "comissoes", "insalubridade",
      "periculosidade", "dsr", "ferias", "terco_ferias", "decimo_terceiro", "rescisorias",
      "outros_proventos", "nao_remuneratorio",
      "inss", "irrf", "faltas", "atrasos", "afastamentos", "adiantamento", "adiantamento_ferias_13",
      "vale_transporte", "emprestimo_consignado", "outros_emprestimos", "retornos", "rescisao_paga",
      "outros_descontos",
    ])
    .nullable()
    .optional(),
});

export async function salvarConfigRubricaFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = configSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Configuração de rubrica inválida." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: anterior } = await supabaseAdmin
    .from("folha_rubricas")
    .select("efeito, categoria, coluna")
    .eq("empresa_id", alvo.empresaId)
    .eq("codigo", dados.data.codigo)
    .eq("tipo", dados.data.tipo)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("folha_rubricas")
    .upsert({ ...dados.data, coluna: dados.data.coluna ?? null, empresa_id: alvo.empresaId }, {
      onConflict: "empresa_id,codigo,tipo",
    });
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar a rubrica.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    tipo: "rubrica",
    descricao: `Rubrica ${dados.data.tipo} ${dados.data.codigo} (${dados.data.descricao}) reclassificada`,
    detalhes: {
      antes: anterior ?? null,
      depois: { efeito: dados.data.efeito, categoria: dados.data.categoria, coluna: dados.data.coluna ?? null },
    },
  });
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ajustes manuais

const manuaisSchema = z.object({
  apuracaoId: z.string().uuid(),
  manuais: z.object({
    fgts: valor.min(0).optional(),
    fgtsProvFerias: valor.min(0).optional(),
    fgtsProv13: valor.min(0).optional(),
  }),
});

export async function salvarManuaisFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = manuaisSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Valor inválido." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: atual } = await supabaseAdmin
    .from("folha_apuracoes")
    .select("competencia, unidade_id, manuais")
    .eq("id", dados.data.apuracaoId)
    .eq("empresa_id", alvo.empresaId)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Apuração não encontrada." };

  const { error } = await supabaseAdmin
    .from("folha_apuracoes")
    .update({ manuais: dados.data.manuais })
    .eq("id", dados.data.apuracaoId);
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar o valor.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    competencia: atual.competencia,
    unidadeId: atual.unidade_id,
    tipo: "ajuste",
    descricao: "FGTS informado à mão alterado",
    detalhes: { antes: atual.manuais, depois: dados.data.manuais },
  });
  revalidar();
  return { ok: true };
}

const colaboradorSchema = z.object({
  competencia: competenciaSchema,
  unidadeId: z.string().uuid(),
  matricula: z.string().min(1).max(30),
  nome: z.string().max(200),
  escala: z.string().trim().max(30).nullable(),
  jornadaSemanal: valor.min(0).max(80).nullable(),
  setor: z.string().trim().max(30).nullable(),
});

export async function salvarColaboradorFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = colaboradorSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Dados do colaborador inválidos." };
  const d = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select("id")
    .eq("id", d.unidadeId)
    .eq("empresa_id", alvo.empresaId)
    .maybeSingle();
  if (!unidade) return { ok: false, erro: "Unidade não encontrada." };

  const { data: anterior } = await supabaseAdmin
    .from("folha_colaboradores")
    .select("escala, jornada_semanal, setor")
    .eq("unidade_id", d.unidadeId)
    .eq("matricula", d.matricula)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("folha_colaboradores").upsert(
    {
      unidade_id: d.unidadeId,
      empresa_id: alvo.empresaId,
      matricula: d.matricula,
      escala: d.escala || null,
      jornada_semanal: d.jornadaSemanal,
      setor: d.setor || null,
    },
    { onConflict: "unidade_id,matricula" },
  );
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar o colaborador.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    competencia: d.competencia,
    unidadeId: d.unidadeId,
    tipo: "ajuste",
    descricao: `Cadastro de ${d.matricula} ${d.nome} alterado (escala, jornada ou setor)`,
    detalhes: {
      antes: anterior ?? null,
      depois: { escala: d.escala || null, jornada_semanal: d.jornadaSemanal, setor: d.setor || null },
    },
  });
  revalidar();
  return { ok: true };
}

const contratoSchema = z.object({
  contrato: z.string().trim().min(1).max(60),
  instituicao: z.string().trim().max(120).nullable(),
  valorLiberado: valor.min(0).nullable(),
});

export async function salvarContratoEmprestimo(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = contratoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Dados do contrato inválidos." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { error } = await supabaseAdmin.from("folha_emprestimos_contratos").upsert(
    {
      empresa_id: alvo.empresaId,
      contrato: dados.data.contrato,
      instituicao: dados.data.instituicao || null,
      valor_liberado: dados.data.valorLiberado,
    },
    { onConflict: "empresa_id,contrato" },
  );
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar o contrato.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    tipo: "ajuste",
    descricao: `Contrato de empréstimo ${dados.data.contrato} atualizado`,
    detalhes: dados.data,
  });
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cadastros: unidade (CNPJ e encargos), setores, integração com o DRE

const unidadeSchema = z.object({
  unidadeId: z.string().uuid(),
  cnpj: z.string().max(20).nullable(),
  regime: z.enum(["simples", "presumido", "real"]).nullable(),
  inssEmpresa: valor.min(0).max(100),
  rat: valor.min(0).max(100),
  terceiros: valor.min(0).max(100),
  fgts: valor.min(0).max(100),
  fgtsAprendiz: valor.min(0).max(100),
  provisionar: z.boolean(),
});

export async function salvarUnidadeFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = unidadeSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Alíquotas inválidas." };
  const d = dados.data;
  const cnpj = digitos(d.cnpj) || null;
  if (cnpj && cnpj.length !== 14) return { ok: false, erro: "CNPJ deve ter 14 dígitos." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select("id, nome, cnpj")
    .eq("id", d.unidadeId)
    .eq("empresa_id", alvo.empresaId)
    .maybeSingle();
  if (!unidade) return { ok: false, erro: "Unidade não encontrada." };

  if (cnpj !== unidade.cnpj) {
    const { error } = await supabaseAdmin.from("unidades").update({ cnpj }).eq("id", d.unidadeId);
    if (error) {
      return {
        ok: false,
        erro: error.code === "23505" ? "Outra unidade já usa este CNPJ." : erroBanco(error, "Não foi possível salvar o CNPJ."),
      };
    }
  }

  const { data: anterior } = await supabaseAdmin
    .from("folha_unidades_config")
    .select("regime, inss_empresa, rat, terceiros, fgts, fgts_aprendiz, provisionar")
    .eq("unidade_id", d.unidadeId)
    .maybeSingle();

  const config = {
    regime: d.regime,
    inss_empresa: d.inssEmpresa,
    rat: d.rat,
    terceiros: d.terceiros,
    fgts: d.fgts,
    fgts_aprendiz: d.fgtsAprendiz,
    provisionar: d.provisionar,
  };
  const { error } = await supabaseAdmin
    .from("folha_unidades_config")
    .upsert({ unidade_id: d.unidadeId, empresa_id: alvo.empresaId, ...config }, { onConflict: "unidade_id" });
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar as alíquotas.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    unidadeId: d.unidadeId,
    tipo: "cadastro",
    descricao: `Encargos e CNPJ de ${unidade.nome} atualizados`,
    detalhes: { antes: { ...anterior, cnpj: unidade.cnpj }, depois: { ...config, cnpj } },
  });
  revalidar();
  return { ok: true };
}

const setorSchema = z.object({
  unidadeId: z.string().uuid(),
  codigo: z.string().trim().min(1).max(30),
  nome: z.string().trim().max(80),
});

/** Nomeia o setor de um código de departamento; nome vazio apaga. */
export async function salvarSetorFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = setorSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Setor inválido." };
  const d = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: unidade } = await supabaseAdmin
    .from("unidades")
    .select("id, nome")
    .eq("id", d.unidadeId)
    .eq("empresa_id", alvo.empresaId)
    .maybeSingle();
  if (!unidade) return { ok: false, erro: "Unidade não encontrada." };

  const { error } = d.nome
    ? await supabaseAdmin
        .from("folha_setores")
        .upsert(
          { unidade_id: d.unidadeId, empresa_id: alvo.empresaId, codigo: d.codigo, nome: d.nome },
          { onConflict: "unidade_id,codigo" },
        )
    : await supabaseAdmin.from("folha_setores").delete().eq("unidade_id", d.unidadeId).eq("codigo", d.codigo);
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar o setor.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    unidadeId: d.unidadeId,
    tipo: "cadastro",
    descricao: d.nome
      ? `${unidade.nome}: departamento ${d.codigo} = setor "${d.nome}"`
      : `${unidade.nome}: nome do departamento ${d.codigo} removido`,
  });
  revalidar();
  return { ok: true };
}

const contaDreSchema = z.object({
  natureza: z.enum(NATUREZAS_DRE.map((n) => n.chave) as [string, ...string[]]),
  planoContaId: z.string().uuid().nullable(),
});

export async function salvarContaDreFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = contaDreSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Conta inválida." };
  const { natureza, planoContaId } = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  if (planoContaId) {
    const { data: conta } = await supabaseAdmin
      .from("plano_contas")
      .select("id")
      .eq("id", planoContaId)
      .eq("empresa_id", alvo.empresaId)
      .maybeSingle();
    if (!conta) return { ok: false, erro: "Conta não encontrada no plano de contas." };
  }

  const { error } = planoContaId
    ? await supabaseAdmin
        .from("folha_dre_contas")
        .upsert({ empresa_id: alvo.empresaId, natureza, plano_conta_id: planoContaId }, { onConflict: "empresa_id,natureza" })
    : await supabaseAdmin.from("folha_dre_contas").delete().eq("empresa_id", alvo.empresaId).eq("natureza", natureza);
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar a conta.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    tipo: "cadastro",
    descricao: `Integração DRE: natureza "${NATUREZAS_DRE.find((n) => n.chave === natureza)?.rotulo}" ${planoContaId ? "vinculada a conta" : "sem conta"}`,
    detalhes: { natureza, planoContaId },
  });
  revalidar();
  return { ok: true };
}

const vinculoSchema = z.object({ apuracaoId: z.string().uuid(), unidadeId: z.string().uuid() });

/** Vincula a uma unidade um relatório importado antes da separação por unidade. */
export async function vincularApuracaoUnidade(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = vinculoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Dados inválidos." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const [{ data: apuracao }, { data: unidade }] = await Promise.all([
    supabaseAdmin
      .from("folha_apuracoes")
      .select("id, competencia, arquivo_nome")
      .eq("id", dados.data.apuracaoId)
      .eq("empresa_id", alvo.empresaId)
      .maybeSingle(),
    supabaseAdmin
      .from("unidades")
      .select("id, nome")
      .eq("id", dados.data.unidadeId)
      .eq("empresa_id", alvo.empresaId)
      .maybeSingle(),
  ]);
  if (!apuracao || !unidade) return { ok: false, erro: "Relatório ou unidade não encontrados." };

  const { error } = await supabaseAdmin
    .from("folha_apuracoes")
    .update({ unidade_id: unidade.id })
    .eq("id", apuracao.id);
  if (error) {
    return {
      ok: false,
      erro: error.code === "23505" ? `${unidade.nome} já tem relatório neste mês.` : erroBanco(error, "Não foi possível vincular."),
    };
  }
  await supabaseAdmin.from("folha_funcionarios").update({ unidade_id: unidade.id }).eq("apuracao_id", apuracao.id);

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    competencia: apuracao.competencia,
    unidadeId: unidade.id,
    tipo: "ajuste",
    descricao: `Relatório ${apuracao.arquivo_nome} vinculado à unidade ${unidade.nome}`,
  });
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Conferência, fechamento e reabertura

const justificativaSchema = z.object({
  competencia: competenciaSchema,
  chave: z.string().min(1).max(200),
  descricao: z.string().max(500),
  texto: z.string().trim().max(500),
});

/** Justifica (ou retira a justificativa de) uma pendência da conferência. */
export async function justificarPendenciaFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = justificativaSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Justificativa inválida." };
  const { competencia, chave, descricao, texto } = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { data: atual, error: erroLeitura } = await supabaseAdmin
    .from("folha_competencias")
    .select("status, justificativas")
    .eq("empresa_id", alvo.empresaId)
    .eq("competencia", competencia)
    .maybeSingle();
  if (erroLeitura) return { ok: false, erro: erroBanco(erroLeitura, "Não foi possível ler a competência.") };
  if (atual?.status === "fechada") return { ok: false, erro: "Competência fechada: reabra para justificar." };

  const justificativas = { ...((atual?.justificativas ?? {}) as Record<string, unknown>) };
  if (texto) {
    justificativas[chave] = { texto, usuario: alvo.sessao.nome, em: new Date().toISOString() };
  } else {
    delete justificativas[chave];
  }

  const { error } = await supabaseAdmin
    .from("folha_competencias")
    .upsert({ empresa_id: alvo.empresaId, competencia, justificativas }, { onConflict: "empresa_id,competencia" });
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar a justificativa.") };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    competencia,
    tipo: "justificativa",
    descricao: texto ? `Pendência justificada: ${descricao}` : `Justificativa retirada: ${descricao}`,
    detalhes: { chave, texto },
  });
  revalidar();
  return { ok: true };
}

/**
 * Fecha a competência. O servidor refaz a apuração e a conferência (não confia
 * no navegador): só fecha sem pendência bloqueante sem justificativa. Grava a
 * configuração usada e o custo por natureza para o DRE.
 */
export async function fecharCompetenciaFolha(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado> {
  const dados = z.object({ competencia: competenciaSchema }).safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Competência inválida." };
  const { competencia } = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };
  const { empresaId, sessao } = alvo;

  const [[mes], config, unidades] = await Promise.all([
    getFolhaMeses(empresaId, [competencia], "completo", { servico: true }),
    getConfigFolha(empresaId),
    getUnidadesFolha(empresaId),
  ]);
  if (!mes?.apuracoes.length) return { ok: false, erro: "Não há relatório importado nesta competência." };
  if (mes.status.status === "fechada") return { ok: false, erro: "A competência já está fechada." };

  const ctx = montarContexto(config, mes.apuracoes);
  const linhas = mes.funcionarios.map((f) => calcularLinha(f, ctx));
  const pendencias = conferir({
    apuracoes: mes.apuracoes.map((a) => ({
      id: a.id,
      unidadeId: a.unidadeId,
      arquivoNome: a.arquivoNome,
      cnpjRelatorio: a.empresaRelatorio.cnpj,
      totais: a.totais,
      encargos: a.encargos,
      avisos: a.avisos,
    })),
    unidades: unidades.map((u) => ({ ...u, temConfigEncargos: Boolean(config.encargos[u.id]) })),
    linhas,
    ctx,
  });
  const abertas = pendencias.filter((p) => p.gravidade === "bloqueia" && !mes.status.justificativas[p.chave]);
  if (abertas.length) {
    return {
      ok: false,
      erro: `${abertas.length} pendência${abertas.length === 1 ? "" : "s"} bloqueante${abertas.length === 1 ? "" : "s"} sem correção ou justificativa (ex.: ${abertas[0].descricao}).`,
    };
  }

  const t = totalizar(linhas).campos;
  const snapshot: ConfigFolha = config;
  const { error } = await supabaseAdmin.rpc("fechar_folha_competencia", {
    p_empresa_id: empresaId,
    p_competencia: competencia,
    p_snapshot: snapshot,
    p_lancamentos: lancamentosDre(linhas).map((l) => ({
      unidade_id: l.unidadeId,
      setor: l.setor,
      centro_custo: l.centroCusto,
      natureza: l.natureza,
      tipo_custo: l.tipo,
      valor: l.valor,
    })),
    p_resumo: {
      funcionarios: linhas.length,
      unidades: mes.apuracoes.length,
      proventos: t.totalProventos,
      liquido: t.liquido,
      encargos: t.encargos,
      provisoes: t.provisoes,
      custoTotal: t.custoTotal,
      pendenciasJustificadas: pendencias.filter((p) => mes.status.justificativas[p.chave]).length,
      alertas: pendencias.filter((p) => p.gravidade === "alerta").length,
    },
    p_usuario: sessao.usuarioId || null,
  });
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível fechar a competência.") };

  revalidar();
  revalidatePath("/financeiro/dre");
  return { ok: true };
}

const reaberturaSchema = z.object({
  competencia: competenciaSchema,
  motivo: z.string().trim().min(5, "Informe o motivo da reabertura (mín. 5 caracteres).").max(500),
});

/** Reabertura autorizada: só o admin (consultoria) reabre uma competência fechada. */
export async function reabrirCompetenciaFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = reaberturaSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const alvo = await contexto(empresaIdInformada, ["admin"]);
  if ("erro" in alvo) return { ok: false, erro: "Somente a consultoria (administrador) pode reabrir a competência." };

  const { error } = await supabaseAdmin.rpc("reabrir_folha_competencia", {
    p_empresa_id: alvo.empresaId,
    p_competencia: dados.data.competencia,
    p_motivo: dados.data.motivo,
    p_usuario: alvo.sessao.usuarioId || null,
  });
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível reabrir a competência.") };

  revalidar();
  revalidatePath("/financeiro/dre");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Acessos, exportações e versões

const acessoSchema = z.object({
  usuarioId: z.string().uuid(),
  acesso: z.enum(["completo", "individual", "agregado"]),
});

export async function salvarAcessoFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = acessoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Nível de acesso inválido." };

  const alvo = await contexto(empresaIdInformada, ["admin"]);
  if ("erro" in alvo) return { ok: false, erro: "Somente o administrador define o acesso à folha." };

  const { data, error } = await supabaseAdmin
    .from("empresa_membros")
    .update({ acesso_folha: dados.data.acesso })
    .eq("empresa_id", alvo.empresaId)
    .eq("user_id", dados.data.usuarioId)
    .select("user_id");
  if (error) return { ok: false, erro: erroBanco(error, "Não foi possível salvar o acesso.") };
  if (!data?.length) return { ok: false, erro: "Usuário não pertence à empresa." };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    tipo: "acesso",
    descricao: `Acesso à folha alterado para "${dados.data.acesso}"`,
    detalhes: dados.data,
  });
  revalidar();
  return { ok: true };
}

const exportacaoSchema = z.object({
  competencia: competenciaSchema,
  formato: z.enum(["excel", "pdf"]),
  filtros: z.string().max(500),
  linhas: z.number().int().min(0),
});

/** Registra a exportação na trilha de auditoria (qualquer perfil que vê a folha). */
export async function registrarExportacaoFolha(empresaIdInformada: string, entrada: unknown): Promise<Resultado> {
  const dados = exportacaoSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Exportação inválida." };

  const alvo = await contexto(empresaIdInformada, ["admin", "cliente", "consultor"]);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  await registrarEvento(alvo.empresaId, alvo.sessao.usuarioId, {
    competencia: dados.data.competencia,
    tipo: "exportacao",
    descricao: `Exportação em ${dados.data.formato === "excel" ? "Excel" : "PDF"} (${dados.data.linhas} funcionários)`,
    detalhes: { filtros: dados.data.filtros },
  });
  return { ok: true };
}

export interface FuncionarioVersao {
  matricula: string;
  nome: string;
  proventos: number;
  descontos: number;
  liquido: number;
}

/** Funcionários como estavam numa versão importada (para comparar com a atual). */
export async function lerVersaoFolha(
  empresaIdInformada: string,
  versaoId: string,
): Promise<Resultado<{ funcionarios: FuncionarioVersao[] }>> {
  if (!z.string().uuid().safeParse(versaoId).success) return { ok: false, erro: "Versão inválida." };
  const alvo = await contexto(empresaIdInformada, ["admin", "cliente", "consultor"]);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  // Lido com o cliente do usuário: o RLS de folha_importacoes exige acesso individual
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folha_importacoes")
    .select("funcionarios")
    .eq("id", versaoId)
    .eq("empresa_id", alvo.empresaId)
    .maybeSingle();
  if (error || !data) return { ok: false, erro: "Versão não encontrada ou sem permissão." };

  const lista = (data.funcionarios ?? []) as Record<string, unknown>[];
  return {
    ok: true,
    funcionarios: lista.map((f) => ({
      matricula: String(f.matricula),
      nome: String(f.nome),
      proventos: Number(f.proventos ?? 0),
      descontos: Number(f.descontos ?? 0),
      liquido: Number(f.liquido ?? 0),
    })),
  };
}
