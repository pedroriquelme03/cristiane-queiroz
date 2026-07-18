import type { ReactNode } from "react";

export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? (
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {acao}
    </header>
  );
}
