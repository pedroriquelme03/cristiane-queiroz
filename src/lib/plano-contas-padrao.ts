import type { GrupoDre, PlanoConta } from "@/lib/types";

export type ContaPadrao = {
  codigo: string;
  nome: string;
  tipo: PlanoConta["tipo"];
  grupoDre: GrupoDre;
};

/** Plano de contas inicial usado no seed e no botão "Carregar plano padrão". */
export const PLANO_CONTAS_PADRAO: ContaPadrao[] = [
  { codigo: "3.1.01", nome: "Receita de vendas", tipo: "receita", grupoDre: "receita_bruta" },
  { codigo: "3.1.02", nome: "Receita de serviços", tipo: "receita", grupoDre: "receita_bruta" },
  { codigo: "4.1.01", nome: "Impostos sobre vendas", tipo: "deducao", grupoDre: "deducoes" },
  { codigo: "4.2.01", nome: "CMV / insumos", tipo: "custo", grupoDre: "custo_variavel" },
  { codigo: "5.1.01", nome: "Folha de pagamento", tipo: "despesa", grupoDre: "despesa_pessoal" },
  { codigo: "5.2.01", nome: "Aluguel", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { codigo: "5.2.02", nome: "Energia e internet", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { codigo: "5.2.03", nome: "Água e esgoto", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { codigo: "5.2.04", nome: "Contabilidade / honorários", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { codigo: "5.3.01", nome: "Marketing e vendas", tipo: "despesa", grupoDre: "despesa_comercial" },
  { codigo: "5.4.01", nome: "Tarifas e juros", tipo: "despesa", grupoDre: "despesa_financeira" },
  { codigo: "6.1.01", nome: "Equipamentos", tipo: "investimento", grupoDre: "investimento" },
];

export const ROTULO_TIPO_CONTA: Record<PlanoConta["tipo"], string> = {
  receita: "Receita",
  deducao: "Dedução",
  custo: "Custo",
  despesa: "Despesa",
  investimento: "Investimento",
  nao_operacional: "Não operacional",
};

export const ROTULO_GRUPO_DRE: Record<GrupoDre, string> = {
  receita_bruta: "Receita bruta",
  deducoes: "Deduções",
  custo_variavel: "Custos variáveis",
  despesa_pessoal: "Despesas com pessoal",
  despesa_administrativa: "Despesas administrativas",
  despesa_comercial: "Despesas comerciais",
  despesa_financeira: "Despesas financeiras",
  investimento: "Investimentos",
  nao_operacional: "Não operacional",
  outros: "Outros",
};

/**
 * Prefixo do código por grupo DRE (classe.subgrupo).
 * O sequencial (01, 02…) é gerado por empresa dentro desse prefixo.
 */
export const PREFIXO_CODIGO_POR_GRUPO: Record<GrupoDre, string> = {
  receita_bruta: "3.1",
  deducoes: "4.1",
  custo_variavel: "4.2",
  despesa_pessoal: "5.1",
  despesa_administrativa: "5.2",
  despesa_comercial: "5.3",
  despesa_financeira: "5.4",
  investimento: "6.1",
  nao_operacional: "7.1",
  outros: "9.1",
};

/** Próximo código sequencial no formato `X.Y.ZZ` para o grupo informado. */
export function proximoCodigoConta(grupoDre: GrupoDre, codigosExistentes: string[]): string {
  const prefixo = PREFIXO_CODIGO_POR_GRUPO[grupoDre];
  const re = new RegExp(`^${prefixo.replaceAll(".", "\\.")}\\.(\\d+)$`);
  let max = 0;
  for (const codigo of codigosExistentes) {
    const match = codigo.match(re);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefixo}.${String(max + 1).padStart(2, "0")}`;
}

export type IdSecaoPlanoContas = "receitas" | "despesas" | "outros";

export type SecaoPlanoContas = {
  id: IdSecaoPlanoContas;
  titulo: string;
  descricao: string;
  contas: PlanoConta[];
};

const DEFINICAO_SECOES: Array<{
  id: IdSecaoPlanoContas;
  titulo: string;
  descricao: string;
  tipos: PlanoConta["tipo"][];
}> = [
  {
    id: "receitas",
    titulo: "Receitas",
    descricao: "Entradas e faturamento",
    tipos: ["receita"],
  },
  {
    id: "despesas",
    titulo: "Despesas",
    descricao: "Gastos operacionais e administrativos",
    tipos: ["despesa"],
  },
  {
    id: "outros",
    titulo: "Outros",
    descricao: "Deduções, custos, investimentos e não operacional",
    tipos: ["deducao", "custo", "investimento", "nao_operacional"],
  },
];

export function secaoDoTipoConta(tipo: PlanoConta["tipo"]): IdSecaoPlanoContas {
  if (tipo === "receita") return "receitas";
  if (tipo === "despesa") return "despesas";
  return "outros";
}

export function tituloSecaoTipoConta(tipo: PlanoConta["tipo"]): string {
  const id = secaoDoTipoConta(tipo);
  return DEFINICAO_SECOES.find((secao) => secao.id === id)?.titulo ?? "Outros";
}

/** Agrupa classificações em Receitas / Despesas / Outros (ordem do plano). */
export function montarSecoesPlanoContas(
  contas: PlanoConta[],
  opcoes?: { incluirVazias?: boolean },
): SecaoPlanoContas[] {
  const incluirVazias = opcoes?.incluirVazias ?? false;
  return DEFINICAO_SECOES.map((def) => ({
    id: def.id,
    titulo: def.titulo,
    descricao: def.descricao,
    contas: contas.filter((conta) => def.tipos.includes(conta.tipo)),
  })).filter((secao) => {
    if (secao.contas.length > 0) return true;
    if (!incluirVazias) return false;
    // No cadastro, Receitas e Despesas aparecem mesmo vazias.
    return secao.id === "receitas" || secao.id === "despesas";
  });
}

/** Opções de select com `grupo` para cabeçalhos Receitas / Despesas / Outros. */
export function opcoesSelectClassificacao(
  contas: PlanoConta[],
  opcoes?: {
    placeholder?: string;
    tipos?: PlanoConta["tipo"][];
  },
): Array<{ valor: string; rotulo: string; detalhe?: string; grupo?: string }> {
  const filtradas = opcoes?.tipos
    ? contas.filter((conta) => opcoes.tipos!.includes(conta.tipo))
    : contas;
  const secoes = montarSecoesPlanoContas(filtradas);
  const resultado: Array<{ valor: string; rotulo: string; detalhe?: string; grupo?: string }> = [];

  if (opcoes?.placeholder !== undefined) {
    resultado.push({ valor: "", rotulo: opcoes.placeholder });
  }

  for (const secao of secoes) {
    for (const conta of secao.contas) {
      resultado.push({
        valor: conta.id,
        rotulo: conta.nome,
        detalhe: conta.codigo,
        grupo: secao.titulo,
      });
    }
  }

  return resultado;
}

/** Tipos usados em contas a pagar / despesas. */
export const TIPOS_CLASSIFICACAO_PAGAR: PlanoConta["tipo"][] = [
  "despesa",
  "custo",
  "investimento",
  "deducao",
];

/** Tipos usados em contas a receber / receitas. */
export const TIPOS_CLASSIFICACAO_RECEBER: PlanoConta["tipo"][] = ["receita"];
