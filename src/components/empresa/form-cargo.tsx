"use client";

import { useActionState } from "react";
import { CheckCircle2, Plus } from "lucide-react";

import {
  adicionarCargoComEstado,
  type EstadoFormularioEstrutura,
} from "@/app/(app)/empresa/actions";

const ESTADO_INICIAL: EstadoFormularioEstrutura = {};

export function FormCargo({ empresaId, areaId }: { empresaId: string; areaId: string }) {
  const [estado, acao, pendente] = useActionState(
    adicionarCargoComEstado.bind(null, empresaId, areaId),
    ESTADO_INICIAL,
  );

  return (
    <details className="mt-3 border-t border-border pt-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-brand hover:underline">
        <Plus className="size-3.5" aria-hidden />
        Adicionar cargo
      </summary>
      <form action={acao} className="mt-2 grid min-w-0 gap-2">
        <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
          Nome do cargo
          <input
            name="nome"
            required
            placeholder="Ex.: Analista financeiro"
            className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-end gap-2">
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Pessoas
            <input
              name="quantidade"
              required
              type="number"
              min="0"
              defaultValue="1"
              className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            disabled={pendente}
            className="min-w-0 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {pendente ? "Salvando..." : "Adicionar cargo"}
          </button>
        </div>
        {estado.erro ? (
          <p role="alert" className="text-xs text-negative">{estado.erro}</p>
        ) : estado.ok ? (
          <p role="status" className="flex items-center gap-1 text-xs text-positive">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Cargo salvo.
          </p>
        ) : null}
      </form>
    </details>
  );
}
