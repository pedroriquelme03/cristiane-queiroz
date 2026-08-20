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
