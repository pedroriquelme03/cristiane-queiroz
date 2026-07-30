"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { FilePenLine, X } from "lucide-react";

export function EditarCadastroModal({ children }: { children: ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
        <FilePenLine className="size-4" aria-hidden />
        Editar cadastro
      </summary>
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Editar cadastro</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Atualize os dados principais da empresa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (detailsRef.current) detailsRef.current.open = false;
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              aria-label="Fechar edição de cadastro"
              title="Fechar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </details>
  );
}
