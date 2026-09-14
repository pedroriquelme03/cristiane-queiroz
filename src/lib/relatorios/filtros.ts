import { data as formatarData } from "@/lib/format";
import type { PlanoConta } from "@/lib/types";

export const CONTA_SEM_CLASSIFICACAO = "__vazio__";

export type PeriodoRelatorio = "mes" | "ano" | "intervalo" | "anteriores" | "futuros";
export type CampoDataRelatorio = "vencimento" | "emissao" | "pagamento";
export type SituacaoRelatorio = "todos" | "aberto" | "pago" | "vencido" | "a_vencer";
export type TipoTituloRelatorio = "todos" | "pagar" | "receber";
export type OrigemRelatorio = "todos" | "avulso" | "fixa";

export type FiltrosRelatorio = {
  periodo: PeriodoRelatorio;
  campoData: CampoDataRelatorio;
  mes: string;
  ano: string;
  inicio: string;
  fim: string;
  contas: string[];
  situacao: SituacaoRelatorio;
  tipo: TipoTituloRelatorio;
  origem: OrigemRelatorio;
  q: string;
  empresa?: string;
};

export type IntervaloRelatorio = { inicio: string; fim: string };

const PERIODOS = new Set<PeriodoRelatorio>(["mes", "ano", "intervalo", "anteriores", "futuros"]);
const CAMPOS_DATA = new Set<CampoDataRelatorio>(["vencimento", "emissao", "pagamento"]);
const SITUACOES = new Set<SituacaoRelatorio>(["todos", "aberto", "pago", "vencido", "a_vencer"]);
const TIPOS = new Set<TipoTituloRelatorio>(["todos", "pagar", "receber"]);
const ORIGENS = new Set<OrigemRelatorio>(["todos", "avulso", "fixa"]);

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0]?.trim() ?? "";
  return valor?.trim() ?? "";
}

function lista(valor: string | string[] | undefined): string[] {
  if (!valor) return [];
  const bruto = Array.isArray(valor) ? valor : valor.split(",");
  return [...new Set(bruto.map((item) => item.trim()).filter(Boolean))];
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Primeiro e último dia do mês (aaaa-mm), sem fuso. */
export function intervaloDoMesIso(anoMes: string): IntervaloRelatorio {
  const [anoTexto, mesTexto] = anoMes.slice(0, 7).split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesPad = String(mes).padStart(2, "0");
  return {
    inicio: `${anoTexto}-${mesPad}-01`,
    fim: `${anoTexto}-${mesPad}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

export function parseFiltrosRelatorio(
  params: Record<string, string | string[] | undefined>,
  padroes?: Partial<FiltrosRelatorio>,
): FiltrosRelatorio {
  const hoje = hojeIso();
  const periodoBruto = primeiro(params.periodo);
  const campoBruto = primeiro(params.campoData);
  const situacaoBruta = primeiro(params.situacao);
  const tipoBruto = primeiro(params.tipo);
  const origemBruta = primeiro(params.origem);

  return {
    periodo: PERIODOS.has(periodoBruto as PeriodoRelatorio)
      ? (periodoBruto as PeriodoRelatorio)
      : (padroes?.periodo ?? "mes"),
    campoData: CAMPOS_DATA.has(campoBruto as CampoDataRelatorio)
      ? (campoBruto as CampoDataRelatorio)
      : (padroes?.campoData ?? "vencimento"),
    mes: primeiro(params.mes) || padroes?.mes || hoje.slice(0, 7),
    ano: primeiro(params.ano) || padroes?.ano || hoje.slice(0, 4),
    inicio: primeiro(params.inicio) || padroes?.inicio || "",
    fim: primeiro(params.fim) || padroes?.fim || "",
    contas: lista(params.conta),
    situacao: SITUACOES.has(situacaoBruta as SituacaoRelatorio)
      ? (situacaoBruta as SituacaoRelatorio)
      : (padroes?.situacao ?? "todos"),
    tipo: TIPOS.has(tipoBruto as TipoTituloRelatorio)
      ? (tipoBruto as TipoTituloRelatorio)
      : (padroes?.tipo ?? "todos"),
    origem: ORIGENS.has(origemBruta as OrigemRelatorio)
      ? (origemBruta as OrigemRelatorio)
      : (padroes?.origem ?? "todos"),
    q: primeiro(params.q),
    empresa: primeiro(params.empresa) || padroes?.empresa,
  };
}

export function resolverIntervalo(filtros: FiltrosRelatorio): IntervaloRelatorio {
  const hoje = hojeIso();

  if (filtros.periodo === "mes") {
    return intervaloDoMesIso(filtros.mes || hoje.slice(0, 7));
  }

  if (filtros.periodo === "ano") {
    const ano = filtros.ano || hoje.slice(0, 4);
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  }

  if (filtros.periodo === "anteriores") {
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const ontem = new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10);
    return { inicio: "2000-01-01", fim: ontem };
  }

  if (filtros.periodo === "futuros") {
    return { inicio: hoje, fim: "2100-12-31" };
  }

  return {
    inicio: filtros.inicio || "2000-01-01",
    fim: filtros.fim || "2100-12-31",
  };
}

const ROTULO_PERIODO: Record<PeriodoRelatorio, string> = {
  mes: "mês específico",
  ano: "ano específico",
  intervalo: "intervalo personalizado",
  anteriores: "lançamentos anteriores",
  futuros: "lançamentos futuros / a vencer",
};

const ROTULO_CAMPO: Record<CampoDataRelatorio, string> = {
  vencimento: "vencimento",
  emissao: "emissão",
  pagamento: "pagamento/recebimento",
};

const ROTULO_SITUACAO: Record<SituacaoRelatorio, string> = {
  todos: "todas",
  aberto: "em aberto",
  pago: "pago/recebido",
  vencido: "vencido",
  a_vencer: "a vencer",
};

export function textoResumoFiltros(
  filtros: FiltrosRelatorio,
  intervalo: IntervaloRelatorio,
  contas: PlanoConta[],
): string {
  const partes: string[] = [];
  partes.push(`Período (${ROTULO_PERIODO[filtros.periodo]}): ${formatarData(intervalo.inicio)} a ${formatarData(intervalo.fim)}`);
  partes.push(`Data considerada: ${ROTULO_CAMPO[filtros.campoData]}`);

  if (filtros.situacao !== "todos") {
    partes.push(`Situação: ${ROTULO_SITUACAO[filtros.situacao]}`);
  }
  if (filtros.tipo !== "todos") {
    partes.push(`Tipo: ${filtros.tipo === "pagar" ? "contas a pagar" : "contas a receber"}`);
  }
  if (filtros.origem !== "todos") {
    partes.push(`Origem: ${filtros.origem === "fixa" ? "contratos/contas fixas" : "avulsos"}`);
  }
  if (filtros.q) {
    partes.push(`Busca: ${filtros.q}`);
  }
  if (filtros.contas.length) {
    const nomes = filtros.contas.map((id) => {
      if (id === CONTA_SEM_CLASSIFICACAO) return "Sem classificação";
      const conta = contas.find((item) => item.id === id);
      return conta ? `${conta.codigo} ${conta.nome}` : id;
    });
    partes.push(`Classificação: ${nomes.join(", ")}`);
  } else {
    partes.push("Classificação: todas");
  }

  return partes.join(" · ");
}

export function queryEmpresa(empresaId?: string | null) {
  return empresaId ? `?empresa=${encodeURIComponent(empresaId)}` : "";
}

export function comEmpresa(href: string, empresaId?: string | null) {
  if (!empresaId) return href;
  const juntor = href.includes("?") ? "&" : "?";
  return `${href}${juntor}empresa=${encodeURIComponent(empresaId)}`;
}
