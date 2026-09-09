/**
 * Fronteira entre as telas e a fonte de dados.
 *
 * As telas consomem dados reais pelo Supabase.
 * Esta camada traduz tabelas/RPCs para os tipos de dominio usados pela UI.
 */
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getSessao } from "@/lib/sessao";
import {
  gerarCompetenciasRecentes,
  mesDe,
} from "@/lib/competencia";
import { getCompetenciaSelecionada } from "@/lib/competencia-servidor";
import type {
  Alerta,
  AvaliacaoMaturidade,
  Colaborador,
  ContaBancaria,
  DashboardKpis,
  Diagnostico,
  Documento,
  Empresa,
  HistoricoPlanoAcao,
  Indicador,
  Lancamento,
  LinhaDre,
  MovimentoDre,
  PlanoAcao,
  PlanoConta,
  PontoFluxo,
  PontoProjecao,
  Reuniao,
  Titulo,
} from "@/lib/types";

// Lógica pura de títulos vive em @/lib/titulos (sem Supabase), para poder ser
// usada em Client Components. Reexportada aqui pela compatibilidade com o código
// que já importa esses símbolos de @/lib/dados.
export {
  statusEfetivo,
  agruparContasFixas,
  type ContaFixaAgrupada,
} from "@/lib/titulos";

const hoje = () => new Date().toISOString().slice(0, 10);

/** Primeiro e ultimo dia do mes da competencia (aaaa-mm-01), sem fuso. */
function intervaloDoMes(competencia: string) {
  const [anoTexto, mesTexto] = competencia.slice(0, 7).split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesPad = String(mes).padStart(2, "0");
  return {
    inicio: `${anoTexto}-${mesPad}-01`,
    fim: `${anoTexto}-${mesPad}-${String(ultimoDia).padStart(2, "0")}`,
  };
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

/** Cidade/UF da unidade matriz (ou da primeira unidade cadastrada). */
export async function getCidadeEmpresa(
  empresaIdParam?: string,
): Promise<{ cidade: string; uf: string } | null> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return null;

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("unidades")
    .select("cidade, uf, tipo")
    .eq("empresa_id", empresaId)
    .order("tipo");

  if (error || !data?.length) return null;
  const matriz = data.find((u) => u.tipo === "matriz") ?? data[0];
  const cidade = String(matriz.cidade ?? "").trim();
  const uf = String(matriz.uf ?? "").trim();
  if (!cidade) return null;
  return { cidade, uf };
}

/** Colaboradores ativos que fazem aniversário hoje (fuso America/Sao_Paulo). */
export async function getAniversariantesHoje(
  empresaIdParam?: string,
): Promise<Colaborador[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome, data_nascimento, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error) {
    if (/colaboradores/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar colaboradores.");
  }

  const hojeBr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [, mesHoje, diaHoje] = hojeBr.split("-");

  return (data ?? [])
    .filter((row) => {
      const iso = String(row.data_nascimento ?? "").slice(0, 10);
      const partes = iso.split("-");
      return partes[1] === mesHoje && partes[2] === diaHoje;
    })
    .map((row) => ({
      id: row.id,
      nome: row.nome,
      dataNascimento: String(row.data_nascimento).slice(0, 10),
      ativo: Boolean(row.ativo),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function getColaboradores(empresaIdParam?: string): Promise<Colaborador[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome, data_nascimento, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error) {
    if (/colaboradores/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar colaboradores.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    nome: row.nome,
    dataNascimento: String(row.data_nascimento).slice(0, 10),
    ativo: Boolean(row.ativo),
  }));
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

export type OrcamentoLinha = {
  id: string;
  planoContaId: string;
  codigo: string;
  conta: string;
  tipo: PlanoConta["tipo"];
  competencia: string;
  valorPrevisto: number;
};

/** Orçamentos (previstos) da competência, com dados da conta. */
export async function getOrcamentos(
  competencia: string,
  empresaIdParam?: string,
): Promise<OrcamentoLinha[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const mes = competencia.slice(0, 7) + "-01";
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("id, plano_conta_id, competencia, valor_previsto, plano_contas(codigo, nome, tipo)")
    .eq("empresa_id", empresaId)
    .eq("competencia", mes)
    .order("competencia");

  if (error) throw new Error("Nao foi possivel carregar os previstos do orçamento.");

  return (data ?? [])
    .map((row) => {
      const conta = Array.isArray(row.plano_contas) ? row.plano_contas[0] : row.plano_contas;
      if (!conta) return null;
      return {
        id: row.id,
        planoContaId: row.plano_conta_id,
        codigo: conta.codigo,
        conta: conta.nome,
        tipo: conta.tipo as PlanoConta["tipo"],
        competencia: dataIso(row.competencia),
        valorPrevisto: numero(row.valor_previsto),
      } satisfies OrcamentoLinha;
    })
    .filter((item): item is OrcamentoLinha => item !== null)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
}

export async function getContasBancarias(empresaIdParam?: string): Promise<ContaBancaria[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("id, nome, banco, tipo, saldo_inicial, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error) throw new Error("Nao foi possivel carregar as contas bancarias.");
  return (data ?? []).map((row) => ({
    id: row.id,
    nome: row.nome,
    banco: row.banco,
    tipo: row.tipo as ContaBancaria["tipo"],
    saldoInicial: Number(row.saldo_inicial),
    ativo: Boolean(row.ativo),
  }));
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

/** Meses disponíveis no seletor: recentes + meses com lançamentos. */
export async function listarCompetenciasOpcoes(empresaIdParam?: string): Promise<string[]> {
  const selecionada = await getCompetenciaSelecionada();
  const [doBanco, recentes] = await Promise.all([
    getCompetencias(empresaIdParam).catch(() => [selecionada]),
    Promise.resolve(gerarCompetenciasRecentes(36, selecionada)),
  ]);
  const conjunto = new Set([selecionada, mesDe(hoje()), ...doBanco, ...recentes]);
  return [...conjunto].sort((a, b) => b.localeCompare(a));
}

/** Competência ativa na plataforma (escolhida pelo usuário ou mês corrente). */
export async function getCompetenciaAtual(): Promise<string> {
  return getCompetenciaSelecionada();
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

/** Títulos em aberto com vencimento no mês (contas fixas e avulsas). */
export async function getPrevistoPeriodo(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<{
  aReceber: number;
  aPagar: number;
  aReceberNoMes: number;
  aPagarNoMes: number;
  aReceberAtrasado: number;
  aPagarAtrasado: number;
  titulosNoMes: Array<{
    id: string;
    tipo: "pagar" | "receber";
    vencimento: string;
    valor: number;
    valorPago: number;
    saldo: number;
    contraparte: string;
    fixa: boolean;
    descricao: string;
  }>;
}> {
  const vazio = {
    aReceber: 0,
    aPagar: 0,
    aReceberNoMes: 0,
    aPagarNoMes: 0,
    aReceberAtrasado: 0,
    aPagarAtrasado: 0,
    titulosNoMes: [] as Array<{
      id: string;
      tipo: "pagar" | "receber";
      vencimento: string;
      valor: number;
      valorPago: number;
      saldo: number;
      contraparte: string;
      fixa: boolean;
      descricao: string;
    }>,
  };
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return vazio;

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("titulos")
    .select("id, tipo, valor, valor_pago, vencimento, contraparte, fixa, documento")
    .eq("empresa_id", empresaId)
    .in("status", ["aberto", "parcial"])
    .lte("vencimento", fim)
    .order("vencimento");

  if (error) throw new Error("Nao foi possivel carregar titulos previstos.");

  const total = { ...vazio, titulosNoMes: [] as typeof vazio.titulosNoMes };
  for (const row of data ?? []) {
    const saldo = numero(row.valor) - numero(row.valor_pago);
    if (saldo <= 0) continue;
    const vencimento = dataIso(row.vencimento);
    const noMes = vencimento >= inicio && vencimento <= fim;
    const tipo = row.tipo === "receber" ? "receber" : "pagar";

    if (tipo === "receber") {
      if (noMes) total.aReceberNoMes += saldo;
      else total.aReceberAtrasado += saldo;
    } else if (noMes) {
      total.aPagarNoMes += saldo;
    } else {
      total.aPagarAtrasado += saldo;
    }

    if (!noMes) continue;

    total.titulosNoMes.push({
      id: row.id,
      tipo,
      vencimento,
      valor: numero(row.valor),
      valorPago: numero(row.valor_pago),
      saldo,
      contraparte: row.contraparte ?? "—",
      fixa: Boolean(row.fixa),
      descricao: row.documento
        ? `${row.contraparte ?? "Título"} (${row.documento})`
        : (row.contraparte ?? "Título"),
    });
  }

  // Totais do mês respeitam o vencimento (sem misturar atrasados de outros meses).
  total.aReceber = total.aReceberNoMes;
  total.aPagar = total.aPagarNoMes;
  return total;
}

/**
 * Soma títulos com vencimento no dia ao fluxo realizado e recalcula o saldo.
 * Assim parcelas de contas fixas aparecem no gráfico no dia do vencimento.
 */
export function mesclarTitulosNoFluxo(
  fluxo: PontoFluxo[],
  titulos: Array<{ vencimento: string; tipo: "pagar" | "receber"; saldo: number }>,
  saldoInicial: number,
): PontoFluxo[] {
  if (!fluxo.length) return fluxo;

  const porData = new Map(
    fluxo.map((ponto) => [
      ponto.data,
      { data: ponto.data, entradas: ponto.entradas, saidas: ponto.saidas, saldoAcumulado: 0 },
    ]),
  );

  for (const titulo of titulos) {
    const ponto = porData.get(titulo.vencimento);
    if (!ponto) continue;
    if (titulo.tipo === "receber") ponto.entradas += titulo.saldo;
    else ponto.saidas += titulo.saldo;
  }

  let saldo = saldoInicial;
  return [...porData.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((ponto) => {
      saldo += ponto.entradas - ponto.saidas;
      return { ...ponto, saldoAcumulado: saldo };
    });
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
    .select("id, data, tipo, valor, descricao, contraparte, documento, plano_conta_id, origem")
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
  const selecao =
    "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem, fixa, grupo_fixa_id";
  // `data` pode vir do select completo ou dos fallbacks sem fixa/grupo_fixa_id
  // (enquanto as migrations 0014/0015 nao foram aplicadas). mapTitulo trata as
  // colunas ausentes, entao tipamos com fixa/grupo_fixa_id opcionais.
  type TituloRow = Parameters<typeof mapTitulo>[0];
  let data: TituloRow[] | null;
  let error: { message: string } | null;
  ({ data, error } = await supabase
    .from("titulos")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .order("vencimento"));

  // Compatível enquanto as migrations 0014/0015 não foram aplicadas.
  if (error && /grupo_fixa/i.test(error.message)) {
    const comFixa = await supabase
      .from("titulos")
      .select(
        "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem, fixa",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("vencimento");
    data = comFixa.data;
    error = comFixa.error;
  }
  if (error && /fixa/i.test(error.message)) {
    const fallback = await supabase
      .from("titulos")
      .select(
        "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("vencimento");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar titulos.");
  return (data ?? []).map(mapTitulo);
}

/** DRE gerencial: realizado por competência (emissão do título) + lançamentos manuais. */
export async function getDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<LinhaDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const [
    { data: contas, error: erroContas },
    { data: orcamentos, error: erroOrcamentos },
    { data: titulos, error: erroTitulos },
    { data: lancamentos, error: erroLancamentos },
  ] = await Promise.all([
    supabase
      .from("plano_contas")
      .select("id, codigo, nome, tipo, grupo_dre")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("codigo"),
    supabase
      .from("orcamentos")
      .select("plano_conta_id, valor_previsto, competencia")
      .eq("empresa_id", empresaId)
      .gte("competencia", inicio.slice(0, 7) + "-01")
      .lte("competencia", fim),
    supabase
      .from("titulos")
      .select("id, tipo, valor, emissao, vencimento, plano_conta_id, status")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelado")
      .not("plano_conta_id", "is", null),
    supabase
      .from("lancamentos")
      .select("id, tipo, valor, data, plano_conta_id, origem")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .neq("origem", "integracao")
      .not("plano_conta_id", "is", null),
  ]);

  if (erroContas) throw new Error("Nao foi possivel carregar o plano de contas da DRE.");
  if (erroOrcamentos) throw new Error("Nao foi possivel carregar o orçamento da DRE.");
  if (erroTitulos) throw new Error("Nao foi possivel carregar os títulos da DRE.");
  if (erroLancamentos) throw new Error("Nao foi possivel carregar os lançamentos da DRE.");

  const realizadoPorConta = new Map<string, number>();
  const previstoPorConta = new Map<string, number>();

  for (const titulo of titulos ?? []) {
    const competencia = dataIso(titulo.emissao) || dataIso(titulo.vencimento);
    if (!competencia || competencia < inicio || competencia > fim) continue;
    if (!titulo.plano_conta_id) continue;
    const sinal = titulo.tipo === "receber" ? 1 : -1;
    realizadoPorConta.set(
      titulo.plano_conta_id,
      (realizadoPorConta.get(titulo.plano_conta_id) ?? 0) + sinal * numero(titulo.valor),
    );
  }

  for (const lancamento of lancamentos ?? []) {
    if (!lancamento.plano_conta_id) continue;
    const sinal = lancamento.tipo === "entrada" ? 1 : -1;
    realizadoPorConta.set(
      lancamento.plano_conta_id,
      (realizadoPorConta.get(lancamento.plano_conta_id) ?? 0) + sinal * numero(lancamento.valor),
    );
  }

  for (const orcamento of orcamentos ?? []) {
    if (!orcamento.plano_conta_id) continue;
    previstoPorConta.set(
      orcamento.plano_conta_id,
      (previstoPorConta.get(orcamento.plano_conta_id) ?? 0) + numero(orcamento.valor_previsto),
    );
  }

  return (contas ?? []).map((conta) => ({
    planoContaId: conta.id,
    codigo: conta.codigo,
    conta: conta.nome,
    grupoDre: conta.grupo_dre as LinhaDre["grupoDre"],
    tipo: conta.tipo as LinhaDre["tipo"],
    realizado: realizadoPorConta.get(conta.id) ?? 0,
    previsto: previstoPorConta.get(conta.id) ?? 0,
  }));
}

/**
 * Movimentos que formam o Realizado da DRE no período:
 * títulos pela data de emissão (+ vencimento se emissão vazia) e lançamentos manuais/importados.
 * Baixas de títulos (origem integração) ficam de fora para não duplicar.
 */
export async function getMovimentosDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<MovimentoDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const [{ data: titulos, error: erroTitulos }, { data: lancamentos, error: erroLancamentos }] =
    await Promise.all([
      supabase
        .from("titulos")
        .select("id, tipo, valor, emissao, vencimento, plano_conta_id, status, contraparte, documento, fixa")
        .eq("empresa_id", empresaId)
        .neq("status", "cancelado")
        .not("plano_conta_id", "is", null),
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, data, plano_conta_id, origem, descricao, contraparte")
        .eq("empresa_id", empresaId)
        .gte("data", inicio)
        .lte("data", fim)
        .neq("origem", "integracao")
        .not("plano_conta_id", "is", null),
    ]);

  if (erroTitulos) throw new Error("Nao foi possivel carregar os títulos da DRE.");
  if (erroLancamentos) throw new Error("Nao foi possivel carregar os lançamentos da DRE.");

  const movimentos: MovimentoDre[] = [];

  for (const titulo of titulos ?? []) {
    const data = dataIso(titulo.emissao) || dataIso(titulo.vencimento);
    if (!data || data < inicio || data > fim) continue;
    const tipo = titulo.tipo === "receber" ? "entrada" : "saida";
    const rotulo = titulo.fixa
      ? titulo.tipo === "receber"
        ? "Recebimento fixo"
        : "Conta fixa"
      : titulo.tipo === "receber"
        ? "Contas a receber"
        : "Contas a pagar";
    movimentos.push({
      id: `titulo:${titulo.id}`,
      data,
      tipo,
      valor: numero(titulo.valor),
      descricao: titulo.documento ? `${rotulo}: ${titulo.documento}` : rotulo,
      contraparte: titulo.contraparte ?? null,
      origem: "titulo",
      planoContaId: titulo.plano_conta_id,
    });
  }

  for (const lancamento of lancamentos ?? []) {
    movimentos.push({
      id: lancamento.id,
      data: dataIso(lancamento.data),
      tipo: lancamento.tipo === "entrada" ? "entrada" : "saida",
      valor: numero(lancamento.valor),
      descricao: lancamento.descricao ?? "Lançamento",
      contraparte: lancamento.contraparte ?? null,
      origem: lancamento.origem ?? "manual",
      planoContaId: lancamento.plano_conta_id,
    });
  }

  return movimentos.sort((a, b) => b.data.localeCompare(a.data) || a.descricao.localeCompare(b.descricao));
}

// ---------------------------------------------------------------------------
// Indicadores e consultoria
// ---------------------------------------------------------------------------

export async function getIndicadores(_empresaId?: string): Promise<Indicador[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("segmento")
    .eq("id", empresaId)
    .single();
  if (empresaError || !empresa) throw new Error("Nao foi possivel identificar o segmento da empresa.");

  const segmentos = empresa.segmento === "geral" ? ["geral"] : ["geral", empresa.segmento];
  const campos = "id, empresa_id, codigo, nome, descricao, segmento, unidade, direcao_meta";
  const [templatesResultado, personalizadosResultado] = await Promise.all([
    supabase
      .from("indicadores")
      .select(campos)
      .is("empresa_id", null)
      .in("segmento", segmentos)
      .eq("ativo", true),
    supabase
      .from("indicadores")
      .select(campos)
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
  ]);

  if (templatesResultado.error || personalizadosResultado.error) {
    throw new Error("Nao foi possivel carregar indicadores.");
  }

  // Um indicador personalizado com o mesmo código substitui o template.
  const porCodigo = new Map<string, (typeof templatesResultado.data)[number]>();
  for (const indicador of templatesResultado.data ?? []) porCodigo.set(indicador.codigo, indicador);
  for (const indicador of personalizadosResultado.data ?? []) porCodigo.set(indicador.codigo, indicador);
  const definicoes = [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (!definicoes.length) return [];

  const { data: valores, error: valoresError } = await supabase
    .from("indicador_valores")
    .select("indicador_id, competencia, valor, meta")
    .eq("empresa_id", empresaId)
    .in("indicador_id", definicoes.map((indicador) => indicador.id))
    .order("competencia");

  if (valoresError) throw new Error("Nao foi possivel carregar os valores dos indicadores.");
  const valoresPorIndicador = new Map<string, NonNullable<typeof valores>>();
  for (const valor of valores ?? []) {
    const serie = valoresPorIndicador.get(valor.indicador_id) ?? [];
    serie.push(valor);
    valoresPorIndicador.set(valor.indicador_id, serie);
  }

  return definicoes.map((indicador) => mapIndicador({
    ...indicador,
    indicador_valores: valoresPorIndicador.get(indicador.id) ?? [],
  }));
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

export async function getHistoricoPlanosAcao(
  _empresaId?: string,
): Promise<HistoricoPlanoAcao[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("plano_acao_historico")
    .select("id, plano_acao_id, tipo, descricao, autor_nome, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(100);

  // A tela principal continua operacional antes da migration 0011 ser aplicada.
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    planoAcaoId: row.plano_acao_id,
    tipo: row.tipo as HistoricoPlanoAcao["tipo"],
    descricao: row.descricao,
    autorNome: row.autor_nome,
    criadoEm: row.created_at,
  }));
}

export async function getDiagnosticos(_empresaId?: string): Promise<Diagnostico[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("diagnosticos")
    .select("competencia, observacoes, diagnostico_itens(categoria, nota, observacao)")
    .eq("empresa_id", empresaId)
    .order("competencia");

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
      empresa_id,
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
  const hojeIso = new Date().toISOString();
  const [{ data, error }, { data: reunioes, error: reunioesError }] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, severidade, titulo, descricao")
      .eq("empresa_id", empresaId)
      .eq("resolvido", false)
      .neq("tipo", "solicitacao_reuniao")
      .order("created_at", { ascending: false }),
    supabase
      .from("reunioes")
      .select("id, tipo, titulo, data")
      .eq("empresa_id", empresaId)
      .gt("data", hojeIso)
      .order("data")
      .limit(3),
  ]);

  if (error) throw new Error("Nao foi possivel carregar alertas.");
  if (reunioesError) throw new Error("Nao foi possivel carregar reunioes agendadas.");

  const alertasReunioes: Alerta[] = (reunioes ?? []).map((reuniao) => ({
    id: `reuniao-${reuniao.id}`,
    severidade: "info",
    titulo: reuniao.tipo === "treinamento" ? "Treinamento agendado" : "Reunião agendada",
    descricao: `${reuniao.titulo} em ${formatarDataHoraAlerta(reuniao.data)}.`,
  }));

  return [
    ...alertasReunioes,
    ...(data ?? []).map((row) => ({
    id: row.id,
    severidade: row.severidade as Alerta["severidade"],
    titulo: row.titulo,
    descricao: row.descricao ?? "",
    })),
  ];
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

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
  empresa_id: string;
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

function formatarDataHoraAlerta(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
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
  documento: string | null;
  plano_conta_id: string | null;
  origem: Lancamento["origem"];
}): Lancamento {
  return {
    id: row.id,
    data: dataIso(row.data),
    tipo: row.tipo,
    valor: numero(row.valor),
    descricao: row.descricao,
    contraparte: row.contraparte,
    documento: row.documento,
    planoContaId: row.plano_conta_id,
    origem: row.origem,
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
  data_pagamento: string | null;
  status: Titulo["status"];
  plano_conta_id: string | null;
  origem: Titulo["origem"];
  fixa?: boolean | null;
  grupo_fixa_id?: string | null;
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
    dataPagamento: row.data_pagamento ? dataIso(row.data_pagamento) : null,
    status: row.status,
    planoContaId: row.plano_conta_id,
    origem: row.origem,
    fixa: Boolean(row.fixa),
    grupoFixaId: row.grupo_fixa_id ?? null,
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
  empresa_id: string | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: Indicador["unidade"];
  direcao_meta: Indicador["direcaoMeta"];
  segmento: Indicador["segmento"];
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
    segmento: row.segmento,
    personalizado: row.empresa_id !== null,
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
    empresaId: row.empresa_id,
    tipo: row.tipo,
    titulo: row.titulo,
    data: row.data,
    participantes: row.participantes ?? "Participantes nao informados",
    ata: row.ata ?? "",
    gravacaoUrl: row.gravacao_url,
    empresaNome: empresa?.nome_fantasia ?? empresa?.razao_social ?? "Empresa nao informada",
  };
}
