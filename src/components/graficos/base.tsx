"use client";

import type { ReactNode } from "react";

/**
 * Peças compartilhadas pelos gráficos: tooltip, eixos e legenda.
 *
 * Regra que vale para todos: nunca dois eixos Y. Quando duas medidas têm
 * escalas diferentes (ex.: movimento diário x saldo acumulado), elas viram
 * dois gráficos empilhados, não duas escalas no mesmo.
 */

export const EIXO = {
  stroke: "var(--eixo)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const GRADE = {
  stroke: "var(--grade)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export function TooltipCartao({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { rotulo: string; valor: string; cor?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{titulo}</p>
      <ul className="space-y-1">
        {linhas.map((linha) => (
          <li key={linha.rotulo} className="flex items-center gap-2">
            {linha.cor ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: linha.cor }}
              />
            ) : null}
            <span className="text-muted-foreground">{linha.rotulo}</span>
            <span className="tabular ml-auto font-medium">{linha.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legenda em texto, sempre presente quando há 2+ séries. */
export function Legenda({
  itens,
}: {
  itens: { rotulo: string; cor: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {itens.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ background: item.cor }}
          />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}

export function MolduraGrafico({
  altura = 260,
  children,
}: {
  altura?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ width: "100%", height: altura }}>{children}</div>
  );
}
