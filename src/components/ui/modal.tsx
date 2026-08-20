"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Modal sobre o <dialog> nativo: foco preso, Esc para fechar e inerte por
 * baixo já vêm do navegador, sem biblioteca nem armadilha de acessibilidade.
 */
export function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  className,
  children,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="titulo-modal"
      onClose={onFechar}
      // Clique no backdrop fecha: o alvo do clique é o próprio dialog
      // quando cai fora do conteúdo.
      onClick={(e) => {
        if (e.target === ref.current) onFechar();
      }}
      className={cn(
        // overflow-visible: o CampoSelect porta o menu para dentro do dialog;
        // overflow-hidden cortaria as opções fora da caixa do modal.
        "m-auto max-h-[90dvh] w-full max-w-lg overflow-visible rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/50",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 rounded-t-xl border-b border-border px-5 py-4">
        <div>
          <h2 id="titulo-modal" className="text-sm font-semibold tracking-tight">
            {titulo}
          </h2>
          {descricao ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="max-h-[calc(90dvh-73px)] overflow-y-auto rounded-b-xl px-5 py-4">{children}</div>
    </dialog>
  );
}
