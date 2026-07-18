import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TomBadge = "neutro" | "positivo" | "negativo" | "atencao" | "marca";

const TONS: Record<TomBadge, string> = {
  neutro: "bg-surface-muted text-muted-foreground border-border",
  positivo: "bg-positive-soft text-positive border-positive/20",
  negativo: "bg-negative-soft text-negative border-negative/20",
  atencao: "bg-warning-soft text-warning border-warning/20",
  marca: "bg-brand-soft text-brand border-brand/20",
};

export function Badge({
  tom = "neutro",
  children,
  className,
}: {
  tom?: TomBadge;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
