/**
 * Fronteira entre as telas e a fonte de dados.
 *
 * As telas consomem dados reais pelo Supabase.
 * Esta camada traduz tabelas/RPCs para os tipos de dominio usados pela UI.
 */
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getSessao } from "@/lib/sessao";
import type {
  Alerta,
  AvaliacaoMaturidade,
  DashboardKpis,
  Diagnostico,
  Documento,
  Empresa,
  Indicador,
  Lancamento,
  LinhaDre,
  PlanoAcao,
  PlanoConta,
  PontoFluxo,
  PontoProjecao,
  Reuniao,
  StatusTitulo,
  Titulo,
} from "@/lib/types";

const hoje = () => new Date().toISOString().slice(0, 10);

/** Primeiro e ultimo dia do mes da competencia. */
function intervaloDoMes(competencia: string) {
  const d = new Date(`${competencia}T12:00:00`);
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { inicio: iso(inicio), fim: iso(fim) };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Espelha status_efetivo da view titulos_view: "vencido" e derivado. */
export function statusEfetivo(titulo: Titulo): StatusTitulo | "vencido" {
  if (titulo.status === "pago" || titulo.status === "cancelado") return titulo.status;
  return titulo.vencimento < hoje() ? "vencido" : titulo.status;
}

// ---------------------------------------------------------------------------
// Empresa e cadastros
// ---------------------------------------------------------------------------

export async function getEmpresa(_empresaId?: string): Promise<Empresa> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) throw new Error("Nenhuma empresa selecionada.");

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", empresaId)
    .single();

  if (error || !data) throw new Error("Nao foi possivel carregar a empresa.");
  return mapEmpresa(data);
}

export async function getPlanoContas(empresaIdParam?: string): Promise<PlanoConta[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("plano_contas")
    .select("id, codigo, nome, tipo, grupo_dre")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("codigo");

  if (error) throw new Error("Nao foi possivel carregar o plano de contas.");
  return (data ?? []).map(mapPlanoConta);
}

export async function getCompetencias(empresaIdParam?: string): Promise<string[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [mesDe(hoje())];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("data")
    .eq("empresa_id", empresaId)
    .order("data");

  if (error) throw new Error("Nao foi possivel carregar as competencias.");
  const competencias = [...new Set((data ?? []).map((row) => mesDe(row.data)))];
  return competencias.length ? competencias : [mesDe(hoje())];
}

export async function getCompetenciaAtual(): Promise<string> {
  return mesDe(hoje());
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

/** Espelha saldo_em_caixa(): saldo inicial + entradas - saidas ate a data. */
export async function saldoEmCaixa(empresaIdParam?: string, ate = hoje()) {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return 0;

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("saldo_em_caixa", {
    p_empresa_id: empresaId,
    p_data: ate,
  });

  if (error) throw new Error("Nao foi possivel carregar o saldo em caixa.");
  return numero(data);
}

export async function getKpis(competencia: string, empresaIdParam?: string): Promise<DashboardKpis> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return kpisVazios(competencia);

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("dashboard_kpis", {
    p_empresa_id: empresaId,
    p_competencia: competencia,
  });

  if (error || !data) throw new Error("Nao foi possivel carregar os KPIs.");
  return mapDashboardKpis(data as DashboardKpisSupabase);
}

/** Espelha fluxo_caixa_diario(). */
export async function getFluxoDiario(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<PontoFluxo[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("fluxo_caixa_diario", {
    p_empresa_id: empresaId,
    p_inicio: inicio,
    p_fim: fim,
  });

  if (error) throw new Error("Nao foi possivel carregar o fluxo de caixa.");
  return ((data ?? []) as FluxoDiarioSupabase[]).map((row) => ({
    data: dataIso(row.data),
    entradas: numero(row.entradas),
    saidas: numero(row.saidas),
    saldoAcumulado: numero(row.saldo_acumulado),
  }));
}

/** Espelha fluxo_caixa_projetado(): saldo atual + titulos em aberto por vencimento. */
export async function getFluxoProjetado(dias = 90, empresaIdParam?: string): Promise<PontoProjecao[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("fluxo_caixa_projetado", {
    p_empresa_id: empresaId,
    p_dias: dias,
  });

  if (error) throw new Error("Nao foi possivel carregar a projecao de caixa.");
  return ((data ?? []) as FluxoProjetadoSupabase[]).map((row) => ({
    data: dataIso(row.data),
    aReceber: numero(row.a_receber),
    aPagar: numero(row.a_pagar),
    saldoProjetado: numero(row.saldo_projetado),
  }));
}

export async function getLancamentos(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<Lancamento[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("id, data, tipo, valor, descricao, contraparte, plano_conta_id")
    .eq("empresa_id", empresaId)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar lancamentos.");
  return (data ?? []).map(mapLancamento);
}

export async function getTitulos(tipo: Titulo["tipo"], empresaIdParam?: string): Promise<Titulo[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("titulos")
    .select("id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, status, plano_conta_id")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .order("vencimento");

  if (error) throw new Error("Nao foi possivel carregar titulos.");
  return (data ?? []).map(mapTitulo);
}

/** Espelha dre_gerencial(): realizado e previsto por conta no periodo. */
export async function getDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<LinhaDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("dre_gerencial", {
    p_empresa_id: empresaId,
    p_inicio: inicio,
    p_fim: fim,
  });

  if (error) throw new Error("Nao foi possivel carregar a DRE.");
  return (data ?? []).map(mapLinhaDre);
}

// ---------------------------------------------------------------------------
// Indicadores e consultoria
// ---------------------------------------------------------------------------

export async function getIndicadores(_empresaId?: string): Promise<Indicador[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("indicadores")
    .select("id, codigo, nome, descricao, unidade, direcao_meta, indicador_valores(competencia, valor, meta)")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .eq("ativo", true)
    .order("codigo");

  if (error) throw new Error("Nao foi possivel carregar indicadores.");
  return (data ?? []).map(mapIndicador);
}

export async function getPlanosAcao(_empresaId?: string): Promise<PlanoAcao[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("planos_acao")
    .select("id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado")
    .eq("empresa_id", empresaId)
    .order("prazo");

  if (error) throw new Error("Nao foi possivel carregar planos de acao.");
  return (data ?? []).map(mapPlanoAcao);
}

export async function getDiagnosticos(_empresaId?: string): Promise<Diagnostico[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("diagnosticos")
    .select("competencia, observacoes, diagnostico_itens(categoria, nota, observacao)")
    .eq("empresa_id", empresaId)
    .order("competencia", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar diagnosticos.");
  return (data ?? []).map(mapDiagnostico);
}

export async function getMaturidade(_empresaId?: string): Promise<AvaliacaoMaturidade[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("maturidade_avaliacoes")
    .select("competencia, pontuacao_geral, maturidade_itens(categoria, pontuacao)")
    .eq("empresa_id", empresaId)
    .order("competencia");

  if (error) throw new Error("Nao foi possivel carregar maturidade.");
  return (data ?? []).map(mapMaturidade);
}

export async function getDocumentos(_empresaId?: string): Promise<Documento[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("documentos")
    .select("id, nome, categoria, tamanho_bytes, created_at, profiles(nome, email)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar documentos.");
  return (data ?? []).map(mapDocumento);
}

export async function getReunioes(_empresaId?: string): Promise<Reuniao[]> {
  const supabase = await criarSupabaseObrigatorio();
  let query = supabase
    .from("reunioes")
    .select(`
      id,
      tipo,
      titulo,
      data,
      participantes,
      ata,
      gravacao_url,
      empresa:empresas(nome_fantasia, razao_social)
    `)
    .order("data", { ascending: false });

  if (_empresaId) query = query.eq("empresa_id", _empresaId);

  const { data, error } = await query;
  if (error) throw new Error("Nao foi possivel carregar reunioes.");
  return (data ?? []).map(mapReuniao);
}

export async function getAlertas(empresaIdParam?: string): Promise<Alerta[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("alertas")
    .select("id, severidade, titulo, descricao")
    .eq("empresa_id", empresaId)
    .eq("resolvido", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar alertas.");
  return (data ?? []).map((row) => ({
    id: row.id,
    severidade: row.severidade as Alerta["severidade"],
    titulo: row.titulo,
    descricao: row.descricao ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

/** Primeiro dia do mes de uma data ISO. */
function mesDe(data: string) {
  return `${data.slice(0, 7)}-01`;
}

export { intervaloDoMes };

type EmpresaSupabase = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: Empresa["segmento"] | null;
  regime_tributario: Empresa["regimeTributario"] | null;
  data_abertura: string | null;
  qtd_funcionarios: number | null;
};

type DashboardKpisSupabase = {
  competencia: string;
  saldo_caixa: number | string;
  faturamento_mes: number | string;
  despesas_mes: number | string;
  resultado_mes: number | string;
  margem_mes: number | string | null;
  contas_pagar: number | string;
  contas_pagar_vencidas: number | string;
  contas_receber: number | string;
  inadimplencia: number | string;
};

type FluxoDiarioSupabase = {
  data: string;
  entradas: number | string;
  saidas: number | string;
  saldo_acumulado: number | string;
};

type FluxoProjetadoSupabase = {
  data: string;
  a_receber: number | string;
  a_pagar: number | string;
  saldo_projetado: number | string;
};

type EmpresaJoin = {
  nome_fantasia: string | null;
  razao_social: string | null;
} | {
  nome_fantasia: string | null;
  razao_social: string | null;
}[] | null;

type ReuniaoSupabase = {
  id: string;
  tipo: Reuniao["tipo"];
  titulo: string;
  data: string;
  participantes: string | null;
  ata: string | null;
  gravacao_url: string | null;
  empresa: EmpresaJoin;
};

async function criarSupabaseObrigatorio() {
  if (!supabaseConfigurado) {
    throw new Error("Supabase nao configurado. Configure as chaves para carregar dados reais.");
  }
  return createClient();
}

async function resolverEmpresaId(empresaId?: string) {
  if (empresaId) return empresaId;
  const sessao = await getSessao();
  return sessao.role === "admin" ? "" : sessao.empresaId;
}

function numero(valor: number | string | null) {
  return typeof valor === "string" ? Number(valor) : valor ?? 0;
}

function dataIso(valor: string | null) {
  return valor ? valor.slice(0, 10) : "";
}

function mapEmpresa(row: EmpresaSupabase): Empresa {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia ?? row.razao_social,
    cnpj: row.cnpj ?? "",
    segmento: row.segmento ?? "geral",
    regimeTributario: row.regime_tributario ?? "simples",
    dataAbertura: row.data_abertura ?? "",
    qtdFuncionarios: row.qtd_funcionarios ?? 0,
    unidades: [],
  };
}

function mapPlanoConta(row: {
  id: string;
  codigo: string;
  nome: string;
  tipo: PlanoConta["tipo"];
  grupo_dre: PlanoConta["grupoDre"];
}): PlanoConta {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    tipo: row.tipo,
    grupoDre: row.grupo_dre,
  };
}

function kpisVazios(competencia: string): DashboardKpis {
  return {
    competencia,
    saldoCaixa: 0,
    faturamentoMes: 0,
    despesasMes: 0,
    resultadoMes: 0,
    margemMes: null,
    contasPagar: 0,
    contasPagarVencidas: 0,
    contasReceber: 0,
    inadimplencia: 0,
  };
}

function mapDashboardKpis(row: DashboardKpisSupabase): DashboardKpis {
  return {
    competencia: dataIso(row.competencia),
    saldoCaixa: numero(row.saldo_caixa),
    faturamentoMes: numero(row.faturamento_mes),
    despesasMes: numero(row.despesas_mes),
    resultadoMes: numero(row.resultado_mes),
    margemMes: row.margem_mes === null ? null : numero(row.margem_mes),
    contasPagar: numero(row.contas_pagar),
    contasPagarVencidas: numero(row.contas_pagar_vencidas),
    contasReceber: numero(row.contas_receber),
    inadimplencia: numero(row.inadimplencia),
  };
}

function mapLancamento(row: {
  id: string;
  data: string;
  tipo: Lancamento["tipo"];
  valor: number | string;
  descricao: string;
  contraparte: string | null;
  plano_conta_id: string | null;
}): Lancamento {
  return {
    id: row.id,
    data: dataIso(row.data),
    tipo: row.tipo,
    valor: numero(row.valor),
    descricao: row.descricao,
    contraparte: row.contraparte,
    planoContaId: row.plano_conta_id,
  };
}

function mapTitulo(row: {
  id: string;
  tipo: Titulo["tipo"];
  contraparte: string;
  documento: string | null;
  emissao: string | null;
  vencimento: string;
  valor: number | string;
  valor_pago: number | string;
  status: Titulo["status"];
  plano_conta_id: string | null;
}): Titulo {
  return {
    id: row.id,
    tipo: row.tipo,
    contraparte: row.contraparte,
    documento: row.documento,
    emissao: dataIso(row.emissao),
    vencimento: dataIso(row.vencimento),
    valor: numero(row.valor),
    valorPago: numero(row.valor_pago),
    status: row.status,
    planoContaId: row.plano_conta_id,
  };
}

function mapLinhaDre(row: {
  plano_conta_id: string;
  codigo: string;
  conta: string;
  grupo_dre: LinhaDre["grupoDre"];
  tipo: LinhaDre["tipo"];
  realizado: number | string;
  previsto: number | string;
}): LinhaDre {
  return {
    planoContaId: row.plano_conta_id,
    codigo: row.codigo,
    conta: row.conta,
    grupoDre: row.grupo_dre,
    tipo: row.tipo,
    realizado: numero(row.realizado),
    previsto: numero(row.previsto),
  };
}

function mapIndicador(row: {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: Indicador["unidade"];
  direcao_meta: Indicador["direcaoMeta"];
  indicador_valores?: {
    competencia: string;
    valor: number | string;
    meta: number | string | null;
  }[];
}): Indicador {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao ?? "",
    unidade: row.unidade,
    direcaoMeta: row.direcao_meta,
    valores: (row.indicador_valores ?? [])
      .map((valor) => ({
        competencia: dataIso(valor.competencia),
        valor: numero(valor.valor),
        meta: valor.meta === null ? null : numero(valor.meta),
      }))
      .sort((a, b) => a.competencia.localeCompare(b.competencia)),
  };
}

function mapPlanoAcao(row: {
  id: string;
  problema: string;
  acao: string;
  area: PlanoAcao["area"];
  responsavel: string | null;
  prazo: string | null;
  prioridade: PlanoAcao["prioridade"];
  status: PlanoAcao["status"];
  percentual: number;
  impacto_estimado: number | string | null;
}): PlanoAcao {
  return {
    id: row.id,
    problema: row.problema,
    acao: row.acao,
    area: row.area,
    responsavel: row.responsavel ?? "Nao informado",
    prazo: dataIso(row.prazo),
    prioridade: row.prioridade,
    status: row.status,
    percentual: row.percentual,
    impactoEstimado: row.impacto_estimado === null ? null : numero(row.impacto_estimado),
  };
}

function mapDiagnostico(row: {
  competencia: string;
  observacoes: string | null;
  diagnostico_itens?: {
    categoria: Diagnostico["itens"][number]["categoria"];
    nota: number;
    observacao: string | null;
  }[];
}): Diagnostico {
  return {
    competencia: dataIso(row.competencia),
    observacoes: row.observacoes ?? "",
    itens: (row.diagnostico_itens ?? []).map((item) => ({
      categoria: item.categoria,
      nota: item.nota,
      observacao: item.observacao ?? "",
    })),
  };
}

function mapMaturidade(row: {
  competencia: string;
  pontuacao_geral: number | null;
  maturidade_itens?: {
    categoria: AvaliacaoMaturidade["itens"][number]["categoria"];
    pontuacao: number;
  }[];
}): AvaliacaoMaturidade {
  return {
    competencia: dataIso(row.competencia),
    pontuacaoGeral: row.pontuacao_geral ?? 0,
    itens: (row.maturidade_itens ?? []).map((item) => ({
      categoria: item.categoria,
      pontuacao: item.pontuacao,
    })),
  };
}

function mapDocumento(row: {
  id: string;
  nome: string;
  categoria: Documento["categoria"];
  tamanho_bytes: number | string | null;
  created_at: string;
  profiles: {
    nome: string | null;
    email: string | null;
  } | {
    nome: string | null;
    email: string | null;
  }[] | null;
}): Documento {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    tamanhoBytes: numero(row.tamanho_bytes),
    criadoEm: dataIso(row.created_at),
    enviadoPor: profile?.nome || profile?.email || "Nao informado",
  };
}

function mapReuniao(row: ReuniaoSupabase): Reuniao {
  const empresa = Array.isArray(row.empresa) ? row.empresa[0] : row.empresa;

  return {
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    data: row.data,
    participantes: row.participantes ?? "Participantes nao informados",
    ata: row.ata ?? "",
    gravacaoUrl: row.gravacao_url,
    empresaNome: empresa?.nome_fantasia ?? empresa?.razao_social ?? "Empresa nao informada",
  };
}
