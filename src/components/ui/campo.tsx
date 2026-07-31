import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export { CampoSelect } from "@/components/ui/campo-select";

const CLASSE_CONTROLE =
  "mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none";

function Envolucro({
  id,
  rotulo,
  erro,
  dica,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-negative">
          {erro}
        </p>
      ) : dica ? (
        <p className="mt-1 text-xs text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}

export function CampoTexto({
  id,
  rotulo,
  tipo = "text",
  erro,
  dica,
  className,
  ...resto
}: {
  id: string;
  rotulo: string;
  tipo?: string;
  erro?: string;
  dica?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "className">) {
  return (
    <Envolucro id={id} rotulo={rotulo} erro={erro} dica={dica} className={className}>
      <input
        id={id}
        name={id}
        type={tipo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={cn(CLASSE_CONTROLE, erro ? "border-negative" : "border-border")}
        {...resto}
      />
    </Envolucro>
  );
}
