/**
 * Fronteira entre as telas e a fonte de dados.
 *
 * Hoje tudo vem do gerador de exemplo. Quando o projeto Supabase existir,
 * basta reescrever o corpo destas funcoes chamando as RPCs equivalentes
 * (dashboard_kpis, fluxo_caixa_diario, dre_gerencial...) — as telas nao mudam.
 */
import {
  ALERTAS,
  COMPETENCIAS,
  DIAGNOSTICOS,
  DOCUMENTOS,
  EMPRESA,
  INDICADORES,
  LANCAMENTOS,
  MATURIDADE,
  ORCAMENTO,
  PLANOS_ACAO,
  PLANO_CONTAS,
  REUNIOES,
  SALDO_INICIAL,
  TITULOS,
} from "@/lib/mock/gerador";
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

const emAberto = (t: Titulo) => t.status === "aberto" || t.status === "parcial";
const saldo = (t: Titulo) => t.valor - t.valorPago;

// ---------------------------------------------------------------------------
// Empresa e cadastros
// ---------------------------------------------------------------------------

export async function getEmpresa(): Promise<Empresa> {
  return EMPRESA;
}

export async function getPlanoContas(): Promise<PlanoConta[]> {
  return PLANO_CONTAS;
}

export async function getCompetencias(): Promise<string[]> {
  return COMPETENCIAS;
}

export async function getCompetenciaAtual(): Promise<string> {
  return COMPETENCIAS[COMPETENCIAS.length - 1];
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

/** Espelha saldo_em_caixa(): saldo inicial + entradas - saidas ate a data. */
export function saldoEmCaixa(ate = hoje()) {
  return LANCAMENTOS.filter((l) => l.data <= ate).reduce(
    (total, l) => total + (l.tipo === "entrada" ? l.valor : -l.valor),
    SALDO_INICIAL,
  );
}

export async function getKpis(competencia: string): Promise<DashboardKpis> {
  const { inicio, fim } = intervaloDoMes(competencia);
  const doMes = LANCAMENTOS.filter((l) => l.data >= inicio && l.data <= fim);

  const faturamento = doMes
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + l.valor, 0);
  const despesas = doMes
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + l.valor, 0);

  const abertos = TITULOS.filter(emAberto);
  const somaAbertos = (tipo: Titulo["tipo"], apenasVencidos = false) =>
    abertos
      .filter((t) => t.tipo === tipo && (!apenasVencidos || t.vencimento < hoje()))
      .reduce((s, t) => s + saldo(t), 0);

  return {
    competencia,
    saldoCaixa: saldoEmCaixa(),
    faturamentoMes: faturamento,
    despesasMes: despesas,
    resultadoMes: faturamento - despesas,
    margemMes: faturamento > 0 ? ((faturamento - despesas) / faturamento) * 100 : null,
    contasPagar: somaAbertos("pagar"),
    contasPagarVencidas: somaAbertos("pagar", true),
    contasReceber: somaAbertos("receber"),
    inadimplencia: somaAbertos("receber", true),
  };
}

/** Espelha fluxo_caixa_diario(). */
export async function getFluxoDiario(
  inicio: string,
  fim: string,
): Promise<PontoFluxo[]> {
  const pontos: PontoFluxo[] = [];
  let acumulado = saldoEmCaixa(anteriorA(inicio));

  for (const data of intervaloDeDias(inicio, fim)) {
    const doDia = LANCAMENTOS.filter((l) => l.data === data);
    const entradas = doDia.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
    const saidas = doDia.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
    acumulado += entradas - saidas;
    pontos.push({ data, entradas, saidas, saldoAcumulado: acumulado });
  }
  return pontos;
}

/** Espelha fluxo_caixa_projetado(): saldo atual + titulos em aberto por vencimento. */
export async function getFluxoProjetado(dias = 90): Promise<PontoProjecao[]> {
  const fim = new Date();
  fim.setDate(fim.getDate() + dias);

  const pontos: PontoProjecao[] = [];
  let acumulado = saldoEmCaixa();

  for (const data of intervaloDeDias(hoje(), iso(fim))) {
    const doDia = TITULOS.filter((t) => emAberto(t) && t.vencimento === data);
    const aReceber = doDia.filter((t) => t.tipo === "receber").reduce((s, t) => s + saldo(t), 0);
    const aPagar = doDia.filter((t) => t.tipo === "pagar").reduce((s, t) => s + saldo(t), 0);
    acumulado += aReceber - aPagar;
    pontos.push({ data, aReceber, aPagar, saldoProjetado: acumulado });
  }
  return pontos;
}

export async function getLancamentos(
  inicio: string,
  fim: string,
): Promise<Lancamento[]> {
  return LANCAMENTOS.filter((l) => l.data >= inicio && l.data <= fim).sort((a, b) =>
    b.data.localeCompare(a.data),
  );
}

export async function getTitulos(tipo: Titulo["tipo"]): Promise<Titulo[]> {
  return TITULOS.filter((t) => t.tipo === tipo);
}

/** Espelha dre_gerencial(): realizado e previsto por conta no periodo. */
export async function getDre(
  inicio: string,
  fim: string,
): Promise<LinhaDre[]> {
  return PLANO_CONTAS.map((conta) => {
    const realizado = LANCAMENTOS.filter(
      (l) => l.planoContaId === conta.id && l.data >= inicio && l.data <= fim,
    ).reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

    const previsto = ORCAMENTO.filter(
      (o) => o.planoContaId === conta.id && o.competencia >= mesDe(inicio) && o.competencia <= fim,
    ).reduce((s, o) => s + o.valorPrevisto, 0);

    return {
      planoContaId: conta.id,
      codigo: conta.codigo,
      conta: conta.nome,
      grupoDre: conta.grupoDre,
      tipo: conta.tipo,
      realizado,
      previsto,
    };
  });
}

// ---------------------------------------------------------------------------
// Indicadores e consultoria
// ---------------------------------------------------------------------------

export async function getIndicadores(): Promise<Indicador[]> {
  return INDICADORES;
}

export async function getPlanosAcao(): Promise<PlanoAcao[]> {
  return PLANOS_ACAO;
}

export async function getDiagnosticos(): Promise<Diagnostico[]> {
  return DIAGNOSTICOS;
}

export async function getMaturidade(): Promise<AvaliacaoMaturidade[]> {
  return MATURIDADE;
}

export async function getDocumentos(): Promise<Documento[]> {
  return DOCUMENTOS;
}

export async function getReunioes(): Promise<Reuniao[]> {
  return [...REUNIOES].sort((a, b) => b.data.localeCompare(a.data));
}

export async function getAlertas(): Promise<Alerta[]> {
  return ALERTAS;
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

function intervaloDeDias(inicio: string, fim: string) {
  const dias: string[] = [];
  const atual = new Date(`${inicio}T12:00:00`);
  const limite = new Date(`${fim}T12:00:00`);
  while (atual <= limite) {
    dias.push(iso(atual));
    atual.setDate(atual.getDate() + 1);
  }
  return dias;
}

function anteriorA(data: string) {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return iso(d);
}

/** Primeiro dia do mes de uma data ISO. */
function mesDe(data: string) {
  return `${data.slice(0, 7)}-01`;
}

export { intervaloDoMes };
