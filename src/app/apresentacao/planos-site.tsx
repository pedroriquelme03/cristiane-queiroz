"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { economiaAnual, precoNoCiclo } from "@/lib/assinatura";
import { moeda } from "@/lib/format";
import type { CicloCobranca, Plano } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Índice (0-based) do plano em destaque na vitrine — o do meio, quando houver 3. */
function indiceDestaque(total: number) {
  return total >= 3 ? 1 : total - 1;
}

export function PlanosSite({ planos }: { planos: Plano[] }) {
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const destaque = indiceDestaque(planos.length);

  if (planos.length === 0) {
    return (
      <p className="mx-auto max-w-md rounded-xl border border-border bg-surface px-6 py-8 text-center text-sm text-muted-foreground">
        Os planos estão sendo atualizados. Fale com a consultoria para conhecer as
        condições.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Ciclo de cobrança"
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
        >
          {(["mensal", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={ciclo === c}
              onClick={() => setCiclo(c)}
              className={cn(
                "cursor-pointer rounded-full px-5 py-1.5 font-medium capitalize transition-colors",
                ciclo === c
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
              {c === "anual" ? (
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    ciclo === c ? "text-brand-foreground/80" : "text-accent",
                  )}
                >
                  2 meses grátis
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {planos.map((plano, i) => {
          const eDestaque = i === destaque;
          const preco = precoNoCiclo(plano, ciclo);
          const economia = economiaAnual(plano);
          return (
            <div
              key={plano.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7 transition-transform duration-300 hover:-translate-y-1",
                eDestaque
                  ? "border-brand bg-surface shadow-[0_20px_50px_-24px_rgba(15,61,76,0.55)] ring-1 ring-brand lg:-mt-3 lg:mb-3"
                  : "border-border bg-surface",
              )}
            >
              {eDestaque ? (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  <Sparkles className="size-3.5" aria-hidden />
                  Mais escolhido
                </span>
              ) : null}

              <h3 className="text-lg font-semibold tracking-tight">{plano.nome}</h3>
              <p className="mt-1.5 min-h-10 text-sm text-muted-foreground">
                {plano.descricao}
              </p>

              <div className="mt-6">
                <span className="text-4xl font-semibold tracking-tight tabular">
                  {moeda(preco)}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{ciclo === "anual" ? "ano" : "mês"}
                </span>
              </div>
              {ciclo === "anual" && economia > 0 ? (
                <p className="mt-1 text-xs font-medium text-positive">
                  Economize {economia}% no plano anual
                </p>
              ) : (
                <p className="mt-1 text-xs text-transparent" aria-hidden>
                  .
                </p>
              )}

              {plano.trialDias > 0 ? (
                <p className="mt-3 inline-flex w-fit items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  {plano.trialDias} dias de teste grátis
                </p>
              ) : (
                <p className="mt-3 inline-flex w-fit items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Onboarding assistido
                </p>
              )}

              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plano.recursos.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2.5 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive/60" aria-hidden />
                  <span>
                    {plano.limiteUsuarios === null
                      ? "Usuários ilimitados"
                      : `Até ${plano.limiteUsuarios} usuários`}
                    {plano.limiteEmpresas === null
                      ? " · multiempresa"
                      : plano.limiteEmpresas > 1
                        ? ` · até ${plano.limiteEmpresas} empresas`
                        : ""}
                  </span>
                </li>
              </ul>

              <Link
                href={`/login?redirect=%2Fassinatura`}
                className={cn(
                  "mt-7 rounded-xl px-4 py-3 text-center text-sm font-semibold transition-transform hover:-translate-y-px",
                  eDestaque
                    ? "bg-brand text-brand-foreground shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                    : "border border-brand text-brand hover:bg-brand-soft",
                )}
              >
                Assinar {plano.nome}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Preços em reais. Cancele quando quiser — sem multa nem fidelidade.
      </p>
    </div>
  );
}
