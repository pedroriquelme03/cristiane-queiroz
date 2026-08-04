"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListTree } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { data as formatarData, moeda, percentual } from "@/lib/format";
import type { Lancamento, LinhaDre } from "@/lib/types";
import { cn } from "@/lib/utils";

type ContaComMovimentos = LinhaDre & { movimentos: Lancamento[] };

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
  const [contaSelecionada, setContaSelecionada] = useState<ContaComMovimentos | null>(null);
  const [montado, setMontado] = useState(false);
  const totalReal = contas.reduce((s, c) => s + c.realizado, 0);
  const totalPrev = contas.reduce((s, c) => s + c.previsto, 0);

  useEffect(() => {
    const quadro = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(quadro);
  }, []);

  const movimentosDaConta = (planoContaId: string) =>
    lancamentos.filter((lancamento) => lancamento.planoContaId === planoContaId);
  const av = (valor: number) =>
    receitaBruta !== 0 ? (Math.abs(valor) / receitaBruta) * 100 : 0;

  return (
    <>
      <tr className="border-b border-border bg-surface">
        <th scope="rowgroup" className="px-5 pt-4 pb-2 text-left text-xs font-semibold tracking-wide uppercase">
          {titulo}
        </th>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm font-semibold">{moeda(totalReal)}</td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-xs text-muted-foreground">{percentual(av(totalReal))}</td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm text-muted-foreground">{moeda(totalPrev)}</td>
        <td className="tabular px-5 pt-4 pb-2 text-right text-sm">{moeda(totalReal - totalPrev)}</td>
      </tr>
      {contas.map((conta) => {
        const desvio = conta.realizado - conta.previsto;
        const movimentos = movimentosDaConta(conta.planoContaId);
        return (
          <tr key={conta.planoContaId} className="border-b border-border last:border-0">
            <th scope="row" className="py-2 pr-3 pl-9 text-left font-normal">
              <span className="tabular text-xs text-muted-foreground">{conta.codigo}</span>{" "}
              {conta.conta}
            </th>
            <td className="px-3 py-1.5 text-right">
              {movimentos.length ? (
                <button
                  type="button"
                  onClick={() => setContaSelecionada({ ...conta, movimentos })}
                  className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 tabular transition-colors hover:bg-brand-soft hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  aria-label={`Ver composição de ${conta.conta}`}
                  title="Ver composição da receita"
                >
                  {moeda(conta.realizado)}
                  <ListTree className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" aria-hidden />
                </button>
              ) : (
                <span className="tabular px-1.5">{moeda(conta.realizado)}</span>
              )}
            </td>
            <td className="tabular px-3 py-2 text-right text-muted-foreground">{percentual(av(conta.realizado))}</td>
            <td className="tabular px-3 py-2 text-right text-muted-foreground">{moeda(conta.previsto)}</td>
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
        );
      })}

      {montado ? createPortal(<Modal
        aberto={Boolean(contaSelecionada)}
        onFechar={() => setContaSelecionada(null)}
        titulo={contaSelecionada ? `Composição: ${contaSelecionada.conta}` : "Composição da receita"}
        descricao={contaSelecionada ? `${contaSelecionada.movimentos.length} lançamento(s) que formam este valor.` : undefined}
        className="max-w-3xl"
      >
        {contaSelecionada ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between rounded-lg bg-surface-muted px-3 py-2.5">
              <div>
                <p className="text-xs text-muted-foreground">Total realizado</p>
                <p className="mt-0.5 text-lg font-semibold tabular">{moeda(contaSelecionada.realizado)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Clique em uma conta da DRE para ver seus lançamentos.</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-left font-medium">Composição</th>
                    <th className="px-3 py-2 text-left font-medium">Cliente / origem</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {contaSelecionada.movimentos.map((movimento) => (
                    <tr key={movimento.id} className="border-t border-border">
                      <td className="px-3 py-2.5 whitespace-nowrap tabular">{formatarData(movimento.data)}</td>
                      <td className="px-3 py-2.5">{movimento.descricao}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{movimento.contraparte ?? movimento.origem}</td>
                      <td className={cn("px-3 py-2.5 text-right font-medium tabular", movimento.tipo === "entrada" ? "text-positive" : "text-negative")}>
                        {movimento.tipo === "entrada" ? "+" : "−"}{moeda(movimento.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>, document.body) : null}
    </>
  );
}
