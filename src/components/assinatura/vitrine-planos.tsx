"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { solicitarTrocaPlano } from "@/app/(app)/assinatura/acoes";
import { economiaAnual, precoNoCiclo } from "@/lib/assinatura";
import { moeda } from "@/lib/format";
import type { CicloCobranca, Plano } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VitrinePlanos({
  planos,
  planoAtualId,
  cicloAtual,
}: {
  planos: Plano[];
  planoAtualId: string;
  cicloAtual: CicloCobranca;
}) {
  const [ciclo, setCiclo] = useState<CicloCobranca>(cicloAtual);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function solicitar(planoId: string) {
    const fd = new FormData();
    fd.set("planoId", planoId);
    const r = await solicitarTrocaPlano(fd);
    setMensagem(r.mensagem ?? r.erro ?? null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Trocar de plano</p>
        <div
          role="radiogroup"
          aria-label="Ciclo de cobrança"
          className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5 text-xs"
        >
          {(["mensal", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={ciclo === c}
              onClick={() => setCiclo(c)}
              className={cn(
                "rounded-md px-3 py-1 font-medium capitalize transition-colors",
                ciclo === c
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                  : "text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {mensagem ? (
        <p className="rounded-lg border border-positive/20 bg-positive-soft px-3 py-2 text-sm text-positive">
          {mensagem}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {planos.map((plano) => {
          const atual = plano.id === planoAtualId;
          const economia = economiaAnual(plano);
          const preco = precoNoCiclo(plano, ciclo);
          return (
            <div
              key={plano.id}
              className={cn(
                "flex flex-col rounded-xl border p-5",
                atual ? "border-brand ring-1 ring-brand" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{plano.nome}</h3>
                {atual ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                    Plano atual
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{plano.descricao}</p>

              <p className="mt-4 text-2xl font-semibold tracking-tight tabular">
                {moeda(preco)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{ciclo === "anual" ? "ano" : "mês"}
                </span>
              </p>
              {ciclo === "anual" && economia > 0 ? (
                <p className="mt-0.5 text-xs text-positive">economia de {economia}%</p>
              ) : (
                <p className="mt-0.5 text-xs text-transparent">.</p>
              )}

              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {plano.recursos.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={atual}
                onClick={() => solicitar(plano.id)}
                className={cn(
                  "mt-5 rounded-lg px-4 py-2 text-sm font-medium",
                  atual
                    ? "cursor-default border border-border text-muted-foreground"
                    : "bg-brand text-brand-foreground",
                )}
              >
                {atual ? "Seu plano" : "Solicitar mudança"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
