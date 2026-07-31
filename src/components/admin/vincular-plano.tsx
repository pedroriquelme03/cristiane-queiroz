"use client";

import { useActionState } from "react";
import { CheckCircle2, Link2 } from "lucide-react";

import { criarAssinatura, type EstadoAdmin } from "@/app/(app)/admin/acoes";
import { CampoSelect } from "@/components/ui/campo";
import type { Plano } from "@/lib/types";

const ESTADO_INICIAL: EstadoAdmin = {};

export function VincularPlano({ empresaId, planos }: { empresaId: string; planos: Plano[] }) {
  const [estado, acao, pendente] = useActionState(criarAssinatura, ESTADO_INICIAL);
  const primeiroPlano = planos[0];

  return (
    <form action={acao} className="grid w-full min-w-0 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
      <input type="hidden" name="empresaId" value={empresaId} />
      <CampoSelect
        id={`plano-${empresaId}`}
        name="planoId"
        rotulo="Plano"
        defaultValue={primeiroPlano?.id ?? ""}
        opcoes={planos.map((plano) => ({ valor: plano.id, rotulo: plano.nome }))}
      />
      <CampoSelect
        id={`ciclo-${empresaId}`}
        name="ciclo"
        rotulo="Ciclo"
        defaultValue="mensal"
        opcoes={[
          { valor: "mensal", rotulo: "Mensal" },
          { valor: "anual", rotulo: "Anual" },
        ]}
      />
      <button
        disabled={pendente || !primeiroPlano}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50"
      >
        <Link2 className="size-3.5" aria-hidden />
        {pendente ? "Vinculando..." : "Vincular"}
      </button>
      {estado.erro ? <p role="alert" className="text-xs text-negative sm:col-span-3">{estado.erro}</p> : null}
      {estado.ok ? (
        <p role="status" className="flex items-center gap-1 text-xs text-positive sm:col-span-3">
          <CheckCircle2 className="size-3.5" aria-hidden /> Plano vinculado.
        </p>
      ) : null}
    </form>
  );
}
