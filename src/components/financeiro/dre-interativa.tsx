"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { data as formatarData, moeda, percentual } from "@/lib/format";
import type { Lancamento, LinhaDre } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RegistrosGrupoInterativos({
  titulo,
  contas,
  lancamentos,
  receitaBruta,
}: {
  titulo: string;
  contas: LinhaDre[];
  lancamentos: Lancamento[];
  receitaBruta: number;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const totalReal = contas.reduce((s, c) => s + c.realizado, 0);
  const totalPrev = contas.reduce((s, c) => s + c.previsto, 0);

  const movimentosDaConta = (planoContaId: string) =>
    lancamentos.filter((lancamento) => lancamento.planoContaId === planoContaId);

  const av = (valor: number) =>
    receitaBruta !== 0 ? (Math.abs(valor) / receitaBruta) * 100 : 0;

  function alternar(planoContaId: string) {
    setAbertas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(planoContaId)) proxima.delete(planoContaId);
      else proxima.add(planoContaId);
      return proxima;
    });
  }

  return (
    <>
      <tr className="border-b border-border bg-surface">
        <th
          scope="rowgroup"
          className="px-5 pt-4 pb-2 text-left text-xs font-semibold tracking-wide uppercase"
        >
          {titulo}
        </th>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm font-semibold">
          {moeda(totalReal)}
        </td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-xs text-muted-foreground">
          {percentual(av(totalReal))}
        </td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm text-muted-foreground">
          {moeda(totalPrev)}
        </td>
        <td className="tabular px-5 pt-4 pb-2 text-right text-sm">
          {moeda(totalReal - totalPrev)}
        </td>
      </tr>

      {contas.map((conta) => {
        const desvio = conta.realizado - conta.previsto;
        const movimentos = movimentosDaConta(conta.planoContaId);
        const expansivel = movimentos.length > 0;
        const aberta = abertas.has(conta.planoContaId);

        return (
          <ContaComDetalhe
            key={conta.planoContaId}
            conta={conta}
            desvio={desvio}
            av={av(conta.realizado)}
            expansivel={expansivel}
            aberta={aberta}
            movimentos={movimentos}
            onAlternar={() => alternar(conta.planoContaId)}
          />
        );
      })}
    </>
  );
}

function ContaComDetalhe({
  conta,
  desvio,
  av,
  expansivel,
  aberta,
  movimentos,
  onAlternar,
}: {
  conta: LinhaDre;
  desvio: number;
  av: number;
  expansivel: boolean;
  aberta: boolean;
  movimentos: Lancamento[];
  onAlternar: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border last:border-0">
        <th scope="row" className="py-2 pr-3 pl-5 text-left font-normal">
          {expansivel ? (
            <button
              type="button"
              onClick={onAlternar}
              aria-expanded={aberta}
              className="group flex w-full items-center gap-1.5 rounded-md text-left transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-brand",
                  aberta && "rotate-90",
                )}
                aria-hidden
              />
              <span>
                <span className="tabular text-xs text-muted-foreground">{conta.codigo}</span>{" "}
                {conta.conta}
              </span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 pl-5">
              <span className="tabular text-xs text-muted-foreground">{conta.codigo}</span>{" "}
              {conta.conta}
            </span>
          )}
        </th>
        <td className="tabular px-3 py-2 text-right">{moeda(conta.realizado)}</td>
        <td className="tabular px-3 py-2 text-right text-muted-foreground">
          {percentual(av)}
        </td>
        <td className="tabular px-3 py-2 text-right text-muted-foreground">
          {moeda(conta.previsto)}
        </td>
        <td
          className={cn(
            "tabular px-5 py-2 text-right",
            Math.abs(desvio) > Math.abs(conta.previsto) * 0.1 && desvio !== 0
              ? "font-medium text-warning"
              : "text-muted-foreground",
          )}
        >
          {moeda(desvio)}
        </td>
      </tr>

      {aberta
        ? movimentos.map((movimento) => (
            <tr
              key={movimento.id}
              className="border-b border-border bg-surface-muted/60 last:border-0"
            >
              <td className="py-2 pr-3 pl-12 text-sm">
                <span className="text-muted-foreground tabular">
                  {formatarData(movimento.data)}
                </span>
                <span className="mx-2 text-border">·</span>
                <span>{movimento.descricao}</span>
                {movimento.contraparte || movimento.origem ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {movimento.contraparte ?? movimento.origem}
                  </span>
                ) : null}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right text-sm font-medium tabular",
                  movimento.tipo === "entrada" ? "text-positive" : "text-negative",
                )}
              >
                {movimento.tipo === "entrada" ? "+" : "−"}
                {moeda(movimento.valor)}
              </td>
              <td className="px-3 py-2" colSpan={3} />
            </tr>
          ))
        : null}
    </>
  );
}
