import { statusEfetivo } from "@/lib/titulos";
import type { Titulo } from "@/lib/types";

import {
  CONTA_SEM_CLASSIFICACAO,
  type FiltrosRelatorio,
  type IntervaloRelatorio,
} from "@/lib/relatorios/filtros";
import { dataDoCampo } from "@/lib/relatorios/titulos";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export type SituacaoContrato = "quitado" | "em_andamento" | "vencido" | "a_vencer";

export type ContratoRelatorio = {
  chave: string;
  tipo: Titulo["tipo"];
  cliente: string;
  documento: string | null;
  planoContaId: string | null;
  valorTotal: number;
  quantidadeParcelas: number;
  valorParcela: number;
  parcelasPagas: number;
  valorPago: number;
  parcelasAVencer: number;
  valorAVencer: number;
  parcelasVencidas: number;
  vencimentos: string[];
  situacao: SituacaoContrato;
  parcelas: Titulo[];
};

/** Agrupa contas/recebimentos fixos, inclusive grupos já quitados. */
export function agruparContratos(titulos: Titulo[]): ContratoRelatorio[] {
  const grupos = new Map<string, Titulo[]>();

  for (const titulo of titulos) {
    if (!titulo.fixa || titulo.status === "cancelado") continue;
    const chave =
      titulo.grupoFixaId ??
      `legado:${titulo.contraparte}|${titulo.valor}|${titulo.planoContaId ?? ""}|${titulo.documento ?? ""}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(titulo);
    grupos.set(chave, lista);
  }

  return Array.from(grupos.entries())
    .map(([chave, parcelas]) => {
      const ordenadas = [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      const base = ordenadas[0];
      const pagas = ordenadas.filter((item) => item.status === "pago");
      const abertas = ordenadas.filter((item) =>
        ["aberto", "parcial", "vencido"].includes(statusEfetivo(item)),
      );
      const vencidas = ordenadas.filter((item) => statusEfetivo(item) === "vencido");
      const aVencer = ordenadas.filter(
        (item) =>
          item.status !== "pago" &&
          item.status !== "cancelado" &&
          item.vencimento >= hojeIso(),
      );

      let situacao: SituacaoContrato = "em_andamento";
      if (abertas.length === 0) situacao = "quitado";
      else if (vencidas.length > 0) situacao = "vencido";
      else if (pagas.length === 0) situacao = "a_vencer";

      return {
        chave,
        tipo: base.tipo,
        cliente: base.contraparte,
        documento: base.documento,
        planoContaId: base.planoContaId,
        valorTotal: ordenadas.reduce((soma, item) => soma + item.valor, 0),
        quantidadeParcelas: ordenadas.length,
        valorParcela: base.valor,
        parcelasPagas: pagas.length,
        valorPago: ordenadas.reduce((soma, item) => soma + item.valorPago, 0),
        parcelasAVencer: aVencer.length,
        valorAVencer: aVencer.reduce((soma, item) => soma + item.valor - item.valorPago, 0),
        parcelasVencidas: vencidas.length,
        vencimentos: ordenadas.map((item) => item.vencimento),
        situacao,
        parcelas: ordenadas,
      };
    })
    .sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));
}

export const ROTULO_SITUACAO_CONTRATO: Record<SituacaoContrato, string> = {
  quitado: "Quitado",
  em_andamento: "Em andamento",
  vencido: "Com parcelas vencidas",
  a_vencer: "A vencer",
};

export function filtrarContratos(
  contratos: ContratoRelatorio[],
  filtros: FiltrosRelatorio,
  intervalo: IntervaloRelatorio,
): ContratoRelatorio[] {
  return contratos.filter((contrato) => {
    if (filtros.tipo !== "todos" && contrato.tipo !== filtros.tipo) return false;

    const busca = `${contrato.cliente} ${contrato.documento ?? ""}`;
    if (
      filtros.q &&
      !busca.toLocaleLowerCase("pt-BR").includes(filtros.q.toLocaleLowerCase("pt-BR"))
    ) {
      return false;
    }

    if (filtros.contas.length > 0) {
      const ids = new Set(contrato.parcelas.map((parcela) => parcela.planoContaId));
      const combina = filtros.contas.some((id) => {
        if (id === CONTA_SEM_CLASSIFICACAO) return ids.has(null);
        return ids.has(id);
      });
      if (!combina) return false;
    }

    if (filtros.situacao !== "todos") {
      if (filtros.situacao === "pago" && contrato.situacao !== "quitado") return false;
      if (filtros.situacao === "aberto" && contrato.situacao !== "em_andamento") return false;
      if (filtros.situacao === "vencido" && contrato.situacao !== "vencido") return false;
      if (filtros.situacao === "a_vencer" && contrato.situacao !== "a_vencer") return false;
    }

    return contrato.parcelas.some((parcela) => {
      const data = dataDoCampo(parcela, filtros.campoData);
      return Boolean(data && data >= intervalo.inicio && data <= intervalo.fim);
    });
  });
}
