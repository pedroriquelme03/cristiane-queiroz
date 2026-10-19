"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string; cnpjDiferente?: boolean };

const valor = z.number().finite();
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
  admissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  vinculo: z.string().max(60).nullable(),
  centroCusto: z.string().max(30).nullable(),
  departamento: z.string().max(30).nullable(),
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

const extratoSchema = z.object({
  arquivoNome: z.string().min(1).max(255),
  /** Usuário confirmou importar mesmo com CNPJ diferente do cadastro. */
  confirmarCnpj: z.boolean().default(false),
  empresa: z.object({
    codigo: z.string().max(30).nullable(),
    nome: z.string().max(200),
    cnpj: z.string().max(30).nullable(),
  }),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida no extrato."),
  funcionarios: z.array(funcionarioSchema).min(1, "O extrato não tem funcionários.").max(5000),
  resumoRubricas: z.array(rubricaSchema).max(2000),
  totais: z.object({ proventos: valor, descontos: valor, liquido: valor }),
  encargos: z.record(z.string().max(120), valor),
  situacoes: z.record(z.string().max(120), valor),
});

async function contexto(empresaIdInformada: string) {
  const alvo = await resolverEmpresaAlvo(empresaIdInformada, {
    papeis: ["admin", "cliente"],
    negado: "Seu perfil não pode alterar a apuração da folha.",
    semEmpresa: "Selecione uma empresa antes de continuar.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const tabelaAusente = (mensagem: string | undefined) =>
  /folha_|importar_folha_extrato/i.test(mensagem ?? "");

export async function importarExtratoMensal(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado<{ competencia: string }>> {
  const dados = extratoSchema.safeParse(entrada);
  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Extrato inválido." };
  }
  const e = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  // Multi-tenant: barra o PDF de uma empresa importado em outra por engano
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("cnpj, razao_social")
    .eq("id", alvo.empresaId)
    .maybeSingle();
  const cnpjCadastro = digitos(empresa?.cnpj);
  const cnpjExtrato = digitos(e.empresa.cnpj);
  if (!e.confirmarCnpj && cnpjCadastro && cnpjExtrato && cnpjCadastro !== cnpjExtrato) {
    return {
      ok: false,
      cnpjDiferente: true,
      erro: `O extrato é de ${e.empresa.nome} (CNPJ ${e.empresa.cnpj}), diferente do CNPJ cadastrado para ${empresa?.razao_social ?? "esta empresa"}.`,
    };
  }

  const competencia = `${e.competencia}-01`;
  const { error } = await supabaseAdmin.rpc("importar_folha_extrato", {
    p_empresa_id: alvo.empresaId,
    p_competencia: competencia,
    p_usuario: alvo.sessao.usuarioId || null,
    p_apuracao: {
      arquivo_nome: e.arquivoNome,
      empresa_relatorio: e.empresa,
      totais: e.totais,
      encargos: e.encargos,
      situacoes: e.situacoes,
      resumo_rubricas: e.resumoRubricas,
      // Ponto de partida do FGTS do mês; o usuário pode ajustar na tela
      manuais: { fgts: e.encargos["Valor do FGTS"] ?? 0 },
    },
    // CPF não é gravado: a matrícula basta para identificar e evita guardar dado pessoal à toa
    p_funcionarios: e.funcionarios.map((f) => ({
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
    if (tabelaAusente(error.message)) {
      return { ok: false, erro: "As tabelas da folha ainda não existem no banco (migration 0023)." };
    }
    return { ok: false, erro: "Não foi possível gravar a apuração da folha." };
  }

  // "layout" cobre as abas de mês (/financeiro/folha/01 … /12)
  revalidatePath("/financeiro/folha", "layout");
  return { ok: true, competencia };
}

const configSchema = z.object({
  codigo: z.string().min(1).max(20),
  tipo: z.enum(["P", "D"]),
  descricao: z.string().max(200),
  efeito: z.enum(["soma", "subtrai", "ignora"]),
  categoria: z.enum([
    "proventos", "comissao", "produtividade", "retornos", "decimo_terceiro",
    "ferias", "terco_ferias", "inss", "inss_13", "inss_ferias", "ignorar",
  ]),
});

export async function salvarConfigRubricaFolha(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado> {
  const dados = configSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Configuração de rubrica inválida." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { error } = await supabaseAdmin
    .from("folha_rubricas")
    .upsert({ ...dados.data, empresa_id: alvo.empresaId }, { onConflict: "empresa_id,codigo,tipo" });

  if (error) {
    if (tabelaAusente(error.message)) {
      return { ok: false, erro: "As tabelas da folha ainda não existem no banco (migration 0023)." };
    }
    return { ok: false, erro: "Não foi possível salvar a rubrica." };
  }
  // "layout" cobre as abas de mês (/financeiro/folha/01 … /12)
  revalidatePath("/financeiro/folha", "layout");
  return { ok: true };
}

const manuaisSchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}-01$/),
  manuais: z.object({
    fgts: valor.min(0).optional(),
    fgtsProvFerias: valor.min(0).optional(),
    fgtsProv13: valor.min(0).optional(),
  }),
});

export async function salvarManuaisFolha(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado> {
  const dados = manuaisSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: "Valor inválido." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { error, count } = await supabaseAdmin
    .from("folha_apuracoes")
    .update({ manuais: dados.data.manuais }, { count: "exact" })
    .eq("empresa_id", alvo.empresaId)
    .eq("competencia", dados.data.competencia);

  if (error) return { ok: false, erro: "Não foi possível salvar o valor." };
  if (!count) return { ok: false, erro: "Apuração do mês não encontrada." };
  // "layout" cobre as abas de mês (/financeiro/folha/01 … /12)
  revalidatePath("/financeiro/folha", "layout");
  return { ok: true };
}
