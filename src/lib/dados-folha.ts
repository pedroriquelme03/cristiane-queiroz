/**
 * Leitura da Apuração da Folha (servidor). Aplica o nível de acesso do usuário
 * antes de qualquer dado sair do servidor:
 *   - completo:   funcionários com CPF;
 *   - individual: funcionários sem CPF (o RLS de folha_cpfs também barra);
 *   - agregado:   valores sem identificação — a tela mostra só totais.
 */
import type { ConfigRubrica } from "@/lib/folha";
import type {
  ConfigEncargos,
  FuncionarioAnalitico,
  NaturezaDre,
  RegimeTributario,
  TipoCustoDre,
} from "@/lib/folha-analitica";
import type { RubricaExtrato } from "@/lib/importacao/adaptadores/extrato-mensal";
import type { Sessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import type { NivelAcessoFolha } from "@/lib/folha-acesso";

export type { NivelAcessoFolha };

export interface UnidadeFolha {
  id: string;
  nome: string;
  cnpj: string | null;
}

export interface SetorFolha {
  unidadeId: string;
  codigo: string;
  nome: string;
}

export interface CadastroFolha {
  unidadeId: string;
  matricula: string;
  escala: string | null;
  jornadaSemanal: number | null;
  setor: string | null;
}

/** Configuração que muda o cálculo; congelada no fechamento da competência. */
export interface ConfigFolha {
  rubricas: ConfigRubrica[];
  encargos: Record<string, ConfigEncargos>;
  setores: SetorFolha[];
  cadastros: CadastroFolha[];
}

export interface ApuracaoUnidade {
  id: string;
  unidadeId: string | null;
  competencia: string;
  arquivoNome: string;
  empresaRelatorio: { codigo: string | null; nome: string; cnpj: string | null };
  totais: { proventos: number; descontos: number; liquido: number };
  encargos: Record<string, number>;
  situacoes: Record<string, number>;
  resumoRubricas: RubricaExtrato[];
  manuais: { fgts?: number; fgtsProvFerias?: number; fgtsProv13?: number };
  avisos: string[];
  atualizadoEm: string;
}

export interface Justificativa {
  texto: string;
  usuario: string;
  em: string;
}

export interface StatusCompetenciaFolha {
  status: "aberta" | "fechada";
  justificativas: Record<string, Justificativa>;
  fechadoPor: string | null;
  fechadoEm: string | null;
  reabertoPor: string | null;
  reabertoEm: string | null;
  motivoReabertura: string | null;
  snapshot: ConfigFolha | null;
}

export interface MesFolha {
  competencia: string;
  apuracoes: ApuracaoUnidade[];
  funcionarios: FuncionarioAnalitico[];
  status: StatusCompetenciaFolha;
}

export interface ContratoEmprestimo {
  contrato: string;
  instituicao: string | null;
  valorLiberado: number | null;
}

const STATUS_ABERTA: StatusCompetenciaFolha = {
  status: "aberta",
  justificativas: {},
  fechadoPor: null,
  fechadoEm: null,
  reabertoPor: null,
  reabertoEm: null,
  motivoReabertura: null,
  snapshot: null,
};

/** Tabela ou coluna da migration 0025 ainda não aplicada. */
export const faltaMigrationFolha = (mensagem: string | undefined) =>
  /folha_|acesso_folha|unidade_id|does not exist|schema cache/i.test(mensagem ?? "");

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function cliente() {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return createClient();
}

/** Nomes de usuários (profiles só é legível pelo próprio usuário ou admin). */
async function nomesUsuarios(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unicos.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Map();
  const { data } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", unicos);
  return new Map((data ?? []).map((p) => [p.id as string, (p.nome || p.email || "Usuário") as string]));
}

export async function getNivelAcessoFolha(sessao: Sessao, empresaId: string): Promise<NivelAcessoFolha> {
  if (sessao.role === "admin") return "completo";
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("empresa_membros")
    .select("acesso_folha")
    .eq("empresa_id", empresaId)
    .eq("user_id", sessao.usuarioId)
    .maybeSingle();
  if (error) return "individual";
  const nivel = data?.acesso_folha;
  return nivel === "completo" || nivel === "agregado" ? nivel : "individual";
}

export async function getUnidadesFolha(empresaId: string): Promise<UnidadeFolha[]> {
  const supabase = await cliente();
  const comCnpj = await supabase.from("unidades").select("id, nome, cnpj").eq("empresa_id", empresaId).order("nome");
  if (!comCnpj.error) {
    return (comCnpj.data ?? []).map((u) => ({ id: u.id, nome: u.nome, cnpj: u.cnpj ?? null }));
  }
  // Sem a migration 0025 a coluna cnpj não existe
  const { data } = await supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId).order("nome");
  return (data ?? []).map((u) => ({ id: u.id, nome: u.nome, cnpj: null }));
}

export async function getConfigFolha(empresaId: string): Promise<ConfigFolha> {
  const supabase = await cliente();
  const [rubricas, encargos, setores, cadastros] = await Promise.all([
    supabase.from("folha_rubricas").select("codigo, tipo, efeito, categoria, coluna").eq("empresa_id", empresaId),
    supabase
      .from("folha_unidades_config")
      .select("unidade_id, regime, inss_empresa, rat, terceiros, fgts, fgts_aprendiz, provisionar")
      .eq("empresa_id", empresaId),
    supabase.from("folha_setores").select("unidade_id, codigo, nome").eq("empresa_id", empresaId),
    supabase
      .from("folha_colaboradores")
      .select("unidade_id, matricula, escala, jornada_semanal, setor")
      .eq("empresa_id", empresaId),
  ]);

  // Rubricas existem desde a 0023; se a coluna "coluna" falta, lê sem ela
  let listaRubricas = rubricas.data as ConfigRubrica[] | null;
  if (rubricas.error) {
    const antigas = await supabase.from("folha_rubricas").select("codigo, tipo, efeito, categoria").eq("empresa_id", empresaId);
    listaRubricas = (antigas.data ?? []) as ConfigRubrica[];
  }

  return {
    rubricas: listaRubricas ?? [],
    encargos: Object.fromEntries(
      (encargos.data ?? []).map((c) => [
        c.unidade_id,
        {
          regime: (c.regime ?? null) as RegimeTributario | null,
          inssEmpresa: num(c.inss_empresa),
          rat: num(c.rat),
          terceiros: num(c.terceiros),
          fgts: num(c.fgts),
          fgtsAprendiz: num(c.fgts_aprendiz),
          provisionar: Boolean(c.provisionar),
          origem: "cadastro" as const,
        },
      ]),
    ),
    setores: (setores.data ?? []).map((s) => ({ unidadeId: s.unidade_id, codigo: s.codigo, nome: s.nome })),
    cadastros: (cadastros.data ?? []).map((c) => ({
      unidadeId: c.unidade_id,
      matricula: c.matricula,
      escala: c.escala ?? null,
      jornadaSemanal: numOuNull(c.jornada_semanal),
      setor: c.setor ?? null,
    })),
  };
}

const COLUNAS_APURACAO =
  "id, unidade_id, competencia, arquivo_nome, empresa_relatorio, totais, encargos, situacoes, resumo_rubricas, manuais, avisos, updated_at";
const COLUNAS_APURACAO_0023 =
  "id, competencia, arquivo_nome, empresa_relatorio, totais, encargos, situacoes, resumo_rubricas, manuais, updated_at";
const COLUNAS_FUNCIONARIO =
  "id, apuracao_id, unidade_id, matricula, nome, situacao, vinculo, admissao, centro_custo, departamento, cargo, horas_mes, salario, proventos, descontos, liquido, base_inss, excedente_inss, base_fgts, valor_fgts, rubricas, observacoes";

/**
 * Apurações e funcionários das competências pedidas (o mês aberto e os do
 * comparativo), já no nível de acesso do usuário.
 */
export async function getFolhaMeses(
  empresaId: string,
  competencias: string[],
  nivel: NivelAcessoFolha,
  /** servico: lê com service_role (fechamento no servidor, já autorizado). */
  opcoes: { servico?: boolean } = {},
): Promise<MesFolha[]> {
  if (!competencias.length) return [];
  const supabase = opcoes.servico ? supabaseAdmin : await cliente();

  let apuracoesRes = await supabase
    .from("folha_apuracoes")
    .select(COLUNAS_APURACAO)
    .eq("empresa_id", empresaId)
    .in("competencia", competencias);
  if (apuracoesRes.error && faltaMigrationFolha(apuracoesRes.error.message)) {
    apuracoesRes = (await supabase
      .from("folha_apuracoes")
      .select(COLUNAS_APURACAO_0023)
      .eq("empresa_id", empresaId)
      .in("competencia", competencias)) as typeof apuracoesRes;
  }
  if (apuracoesRes.error) {
    if (faltaMigrationFolha(apuracoesRes.error.message)) return competencias.map((c) => mesVazio(c));
    throw new Error("Não foi possível carregar a apuração da folha.");
  }
  const apuracoes: ApuracaoUnidade[] = (apuracoesRes.data ?? []).map((a) => {
    const row = a as Record<string, unknown>;
    return {
      id: row.id as string,
      unidadeId: (row.unidade_id as string | null | undefined) ?? null,
      competencia: String(row.competencia).slice(0, 10),
      arquivoNome: row.arquivo_nome as string,
      empresaRelatorio: (row.empresa_relatorio as ApuracaoUnidade["empresaRelatorio"]) ?? {
        codigo: null,
        nome: "",
        cnpj: null,
      },
      totais: (row.totais as ApuracaoUnidade["totais"]) ?? { proventos: 0, descontos: 0, liquido: 0 },
      encargos: (row.encargos as Record<string, number>) ?? {},
      situacoes: (row.situacoes as Record<string, number>) ?? {},
      resumoRubricas: (row.resumo_rubricas as RubricaExtrato[]) ?? [],
      manuais: (row.manuais as ApuracaoUnidade["manuais"]) ?? {},
      avisos: (row.avisos as string[] | undefined) ?? [],
      atualizadoEm: row.updated_at as string,
    };
  });

  const ids = apuracoes.map((a) => a.id);
  const funcionarios: FuncionarioAnalitico[] = [];
  if (ids.length) {
    // "agregado" não lê pelo RLS (que bloqueia); lê com service_role e tira a identificação
    const leitor = nivel === "agregado" || opcoes.servico ? supabaseAdmin : supabase;
    const { data, error } = await leitor
      .from("folha_funcionarios")
      .select(COLUNAS_FUNCIONARIO)
      .in("apuracao_id", ids)
      .order("nome");
    if (error && !faltaMigrationFolha(error.message)) {
      throw new Error("Não foi possível carregar os funcionários da folha.");
    }

    const unidadePorApuracao = new Map(apuracoes.map((a) => [a.id, a.unidadeId]));
    const cpfs = new Map<string, string>();
    if (nivel === "completo") {
      const unidades = [...new Set(apuracoes.map((a) => a.unidadeId).filter(Boolean))] as string[];
      if (unidades.length) {
        const { data: lista } = await supabase
          .from("folha_cpfs")
          .select("unidade_id, matricula, cpf")
          .in("unidade_id", unidades);
        for (const c of lista ?? []) cpfs.set(`${c.unidade_id}:${c.matricula}`, c.cpf);
      }
    }

    (data ?? []).forEach((f, i) => {
      const unidadeId = (f.unidade_id as string | null) ?? unidadePorApuracao.get(f.apuracao_id) ?? null;
      const anonimo = nivel === "agregado";
      funcionarios.push({
        id: f.id,
        apuracaoId: f.apuracao_id,
        unidadeId,
        matricula: anonimo ? `#${i + 1}` : f.matricula,
        nome: anonimo ? `Colaborador ${i + 1}` : f.nome,
        cpf: anonimo ? null : cpfs.get(`${unidadeId}:${f.matricula}`) ?? null,
        situacao: f.situacao,
        vinculo: f.vinculo,
        admissao: anonimo ? null : f.admissao,
        centroCusto: f.centro_custo,
        departamento: f.departamento,
        cargo: anonimo ? null : f.cargo,
        horasMes: numOuNull(f.horas_mes),
        salario: numOuNull(f.salario),
        proventos: num(f.proventos),
        descontos: num(f.descontos),
        liquido: num(f.liquido),
        baseInss: num(f.base_inss),
        excedenteInss: num(f.excedente_inss),
        baseFgts: num(f.base_fgts),
        valorFgts: num(f.valor_fgts),
        rubricas: ((f.rubricas ?? []) as RubricaExtrato[]).map((r) => ({ ...r, valor: Number(r.valor) })),
        observacoes: anonimo ? [] : (f.observacoes ?? []),
      });
    });
  }

  const status = await getStatusCompetencias(empresaId, competencias);
  return competencias.map((competencia) => ({
    competencia,
    apuracoes: apuracoes.filter((a) => a.competencia === competencia),
    funcionarios: funcionarios.filter((f) =>
      apuracoes.some((a) => a.id === f.apuracaoId && a.competencia === competencia),
    ),
    status: status.get(competencia) ?? STATUS_ABERTA,
  }));
}

function mesVazio(competencia: string): MesFolha {
  return { competencia, apuracoes: [], funcionarios: [], status: STATUS_ABERTA };
}

async function getStatusCompetencias(
  empresaId: string,
  competencias: string[],
): Promise<Map<string, StatusCompetenciaFolha>> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("folha_competencias")
    .select(
      "competencia, status, justificativas, snapshot, fechado_por, fechado_em, reaberto_por, reaberto_em, motivo_reabertura",
    )
    .eq("empresa_id", empresaId)
    .in("competencia", competencias);
  if (error || !data) return new Map();

  const nomes = await nomesUsuarios(data.flatMap((c) => [c.fechado_por, c.reaberto_por]));
  return new Map(
    data.map((c) => [
      String(c.competencia).slice(0, 10),
      {
        status: c.status === "fechada" ? "fechada" : "aberta",
        justificativas: (c.justificativas ?? {}) as Record<string, Justificativa>,
        fechadoPor: c.fechado_por ? nomes.get(c.fechado_por) ?? "Usuário" : null,
        fechadoEm: c.fechado_em,
        reabertoPor: c.reaberto_por ? nomes.get(c.reaberto_por) ?? "Usuário" : null,
        reabertoEm: c.reaberto_em,
        motivoReabertura: c.motivo_reabertura,
        snapshot: c.status === "fechada" ? ((c.snapshot ?? null) as ConfigFolha | null) : null,
      } satisfies StatusCompetenciaFolha,
    ]),
  );
}

export async function getContratosEmprestimo(empresaId: string): Promise<ContratoEmprestimo[]> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("folha_emprestimos_contratos")
    .select("contrato, instituicao, valor_liberado")
    .eq("empresa_id", empresaId);
  if (error) return [];
  return (data ?? []).map((c) => ({
    contrato: c.contrato,
    instituicao: c.instituicao,
    valorLiberado: numOuNull(c.valor_liberado),
  }));
}

// ---------------------------------------------------------------------------
// Histórico

export interface VersaoImportada {
  id: string;
  unidadeId: string | null;
  versao: number;
  arquivoNome: string;
  cnpj: string | null;
  totais: { proventos: number; descontos: number; liquido: number };
  qtdFuncionarios: number;
  importadoPor: string;
  criadoEm: string;
}

export interface EventoFolha {
  id: string;
  unidadeId: string | null;
  tipo: string;
  descricao: string;
  detalhes: Record<string, unknown>;
  usuario: string;
  criadoEm: string;
}

export async function getHistoricoFolha(
  empresaId: string,
  competencia: string,
  nivel: NivelAcessoFolha,
): Promise<{ versoes: VersaoImportada[]; eventos: EventoFolha[] }> {
  const supabase = await cliente();
  // Versões guardam dados individuais: só aparecem para quem pode vê-los
  const [versoes, eventos] = await Promise.all([
    nivel === "agregado"
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("folha_importacoes")
          .select("id, unidade_id, versao, arquivo_nome, cnpj, totais, qtd_funcionarios, importado_por, created_at")
          .eq("empresa_id", empresaId)
          .eq("competencia", competencia)
          .order("created_at", { ascending: false }),
    supabase
      .from("folha_eventos")
      .select("id, unidade_id, tipo, descricao, detalhes, usuario_id, created_at")
      .eq("empresa_id", empresaId)
      .or(`competencia.eq.${competencia},competencia.is.null`)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const nomes = await nomesUsuarios([
    ...(versoes.data ?? []).map((v) => v.importado_por),
    ...(eventos.data ?? []).map((e) => e.usuario_id),
  ]);

  return {
    versoes: (versoes.data ?? []).map((v) => ({
      id: v.id,
      unidadeId: v.unidade_id,
      versao: v.versao,
      arquivoNome: v.arquivo_nome,
      cnpj: v.cnpj,
      totais: v.totais ?? { proventos: 0, descontos: 0, liquido: 0 },
      qtdFuncionarios: v.qtd_funcionarios,
      importadoPor: v.importado_por ? nomes.get(v.importado_por) ?? "Usuário" : "—",
      criadoEm: v.created_at,
    })),
    eventos: (eventos.data ?? []).map((e) => ({
      id: e.id,
      unidadeId: e.unidade_id,
      tipo: e.tipo,
      descricao: e.descricao,
      detalhes: (e.detalhes ?? {}) as Record<string, unknown>,
      usuario: e.usuario_id ? nomes.get(e.usuario_id) ?? "Usuário" : "Sistema",
      criadoEm: e.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Acessos e integração com o DRE

export interface MembroFolha {
  usuarioId: string;
  nome: string;
  email: string;
  papel: string;
  acesso: NivelAcessoFolha;
}

/** Usuários da empresa e o nível de acesso à folha (tela do admin). */
export async function getMembrosFolha(empresaId: string): Promise<MembroFolha[]> {
  const { data, error } = await supabaseAdmin
    .from("empresa_membros")
    .select("user_id, papel, acesso_folha")
    .eq("empresa_id", empresaId);
  if (error) return [];
  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, email")
    .in("id", (data ?? []).map((m) => m.user_id));
  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((m) => ({
    usuarioId: m.user_id,
    nome: porId.get(m.user_id)?.nome || porId.get(m.user_id)?.email || "Usuário",
    email: porId.get(m.user_id)?.email ?? "",
    papel: m.papel,
    acesso: (m.acesso_folha ?? "individual") as NivelAcessoFolha,
  }));
}

export interface ContaPlano {
  id: string;
  codigo: string;
  nome: string;
  grupoDre: string;
}

export async function getIntegracaoDreFolha(
  empresaId: string,
): Promise<{ contas: Partial<Record<NaturezaDre, string>>; planoContas: ContaPlano[] }> {
  const supabase = await cliente();
  const [mapa, plano] = await Promise.all([
    supabase.from("folha_dre_contas").select("natureza, plano_conta_id").eq("empresa_id", empresaId),
    supabase
      .from("plano_contas")
      .select("id, codigo, nome, grupo_dre, tipo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .in("tipo", ["custo", "despesa"])
      .order("codigo"),
  ]);
  return {
    contas: Object.fromEntries((mapa.data ?? []).map((m) => [m.natureza, m.plano_conta_id])),
    planoContas: (plano.data ?? []).map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, grupoDre: c.grupo_dre })),
  };
}

export interface LancamentoFolhaDre {
  unidadeId: string | null;
  setor: string;
  centroCusto: string | null;
  natureza: NaturezaDre;
  tipo: TipoCustoDre;
  valor: number;
  planoContaId: string | null;
}

/** Custo da folha gravado no fechamento, para a conciliação no DRE. */
export async function getFolhaParaDre(
  empresaId: string,
  competencia: string,
): Promise<{ fechada: boolean; importada: boolean; lancamentos: LancamentoFolhaDre[]; unidades: UnidadeFolha[] }> {
  const supabase = await cliente();
  const [lanc, status, apuracoes, unidades] = await Promise.all([
    supabase
      .from("folha_dre_lancamentos")
      .select("unidade_id, setor, centro_custo, natureza, tipo_custo, valor, plano_conta_id")
      .eq("empresa_id", empresaId)
      .eq("competencia", competencia),
    supabase
      .from("folha_competencias")
      .select("status")
      .eq("empresa_id", empresaId)
      .eq("competencia", competencia)
      .maybeSingle(),
    supabase
      .from("folha_apuracoes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("competencia", competencia),
    getUnidadesFolha(empresaId),
  ]);
  return {
    fechada: status.data?.status === "fechada",
    importada: (apuracoes.count ?? 0) > 0,
    unidades,
    lancamentos: (lanc.data ?? []).map((l) => ({
      unidadeId: l.unidade_id,
      setor: l.setor,
      centroCusto: l.centro_custo,
      natureza: l.natureza as NaturezaDre,
      tipo: l.tipo_custo as TipoCustoDre,
      valor: num(l.valor),
      planoContaId: l.plano_conta_id,
    })),
  };
}
