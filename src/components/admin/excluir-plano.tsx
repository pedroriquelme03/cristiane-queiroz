"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { excluirPlano, type EstadoAdmin } from "@/app/(app)/admin/acoes";

/**
 * Exclusão fica atrás de confirmação nativa. Em produção o servidor decide
 * entre apagar e apenas desativar, conforme haja assinaturas usando o plano.
 */
export function ExcluirPlano({ id, nome }: { id: string; nome: string }) {
  const [estado, acao] = useActionState<EstadoAdmin, FormData>(
    (_prev, formData) => excluirPlano(formData),
    {},
  );

  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!confirm(`Excluir o plano "${nome}"? Assinaturas ativas serão preservadas.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title="Excluir plano"
        aria-label={`Excluir plano ${nome}`}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      {estado.erro ? (
        <p className="mt-1 max-w-48 text-xs text-muted-foreground">{estado.erro}</p>
      ) : null}
    </form>
  );
}
