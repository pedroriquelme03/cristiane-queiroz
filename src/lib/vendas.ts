/**
 * Regras da tela de Vendas (relatórios do PDV). Funções puras: juntam origens
 * e meses no navegador, sem nova consulta ao banco.
 */
import type { ItemVendas, ResumoVendas } from "@/lib/importacao/adaptadores/relatorio-vendas";

export interface RelatorioVendasSalvo {
  id: string;
  /** "AAAA-MM-01" */
  competencia: string;
  origem: string;
  arquivoNome: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  totalValor: number;
  totalQuantidade: number;
  resumos: Partial<Record<ResumoVendas, ItemVendas[]>>;
  atualizadoEm: string;
}

/** Soma por nome um resumo de vários relatórios (ex.: Ipê + Hospedagem). */
export function combinarResumo(relatorios: RelatorioVendasSalvo[], resumo: ResumoVendas): ItemVendas[] {
  const porNome = new Map<string, ItemVendas>();
  for (const r of relatorios) {
    for (const item of r.resumos[resumo] ?? []) {
      const atual = porNome.get(item.nome) ?? { nome: item.nome, quantidade: 0, valor: 0 };
      atual.quantidade += item.quantidade;
      atual.valor += item.valor;
      porNome.set(item.nome, atual);
    }
  }
  return [...porNome.values()].map((i) => ({
    ...i,
    quantidade: Math.round(i.quantidade * 100) / 100,
    valor: Math.round(i.valor * 100) / 100,
  }));
}

/** Faturamento de cada mês do ano (1–12), somando as origens. */
export function totaisPorMes(relatorios: RelatorioVendasSalvo[]): { mes: number; valor: number }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    valor: relatorios
      .filter((r) => Number(r.competencia.slice(5, 7)) === i + 1)
      .reduce((s, r) => s + r.totalValor, 0),
  }));
}

/** "Receita Ipê 01-2026.pdf" → "Receita Ipê"; "Rel. Hospedagem cataratas.pdf" → "Rel. Hospedagem cataratas". */
export function origemSugerida(arquivo: string): string {
  return (
    arquivo
      .replace(/\.pdf$/i, "")
      .replace(/[\s_-]*\d{1,2}[-_/.]\d{2,4}\s*$/, "")
      .replace(/[_]+/g, " ")
      .trim()
      .slice(0, 80) || "Vendas"
  );
}
