import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tile de número-destaque. O valor é a informação principal, então nada de
 * gráfico aqui — só o número, o rótulo e uma nota de apoio.
 */
export function Kpi({
  rotulo,
  valor,
  nota,
  tom = "neutro",
  icone,
}: {
  rotulo: string;
  valor: string;
  nota?: ReactNode;
  tom?: "neutro" | "positivo" | "negativo" | "atencao";
  icone?: ReactNode;
}) {
  const cores = {
    neutro: "text-foreground",
    positivo: "text-positive",
    negativo: "text-negative",
    atencao: "text-warning",
  };

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
        {icone ? <span className="text-muted-foreground">{icone}</span> : null}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", cores[tom])}>
        {valor}
      </p>
      {nota ? (
        <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
      ) : null}
    </div>
  );
}
