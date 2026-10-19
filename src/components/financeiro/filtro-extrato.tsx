"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, Loader2, Wallet } from "lucide-react";

import type { ContaBancaria } from "@/lib/types";
import { cn } from "@/lib/utils";

const classeSelect =
  "cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-wait disabled:opacity-60";

/** Filtros de conta financeira e período do extrato. */
export function FiltroExtrato({
  contas,
  contaId,
  inicio,
  fim,
  empresaId,
}: {
  contas: ContaBancaria[];
  contaId: string;
  inicio: string;
  fim: string;
  empresaId?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function aplicar(formData: FormData) {
    const params = new URLSearchParams();
    if (empresaId) params.set("empresa", empresaId);
    const conta = String(formData.get("conta") ?? "").trim();
    const de = String(formData.get("inicio") ?? "").trim();
    const ate = String(formData.get("fim") ?? "").trim();
    if (conta) params.set("conta", conta);
    if (de) params.set("inicio", de);
    if (ate) params.set("fim", ate);
    const qs = params.toString();
    iniciar(() => {
      router.push(qs ? `/financeiro/extrato?${qs}` : "/financeiro/extrato");
    });
  }

  return (
    <form
      action={aplicar}
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3",
        pendente && "opacity-70",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Extrato por conta</p>
        <p className="text-xs text-muted-foreground">
          Filtre pela conta financeira e pelo período
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="filtro-extrato-conta" className="sr-only">
            Conta financeira
          </label>
          <div className="flex items-center gap-2">
            <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <select
              id="filtro-extrato-conta"
              name="conta"
              defaultValue={contaId}
              disabled={pendente || contas.length === 0}
              className={cn(classeSelect, "min-w-[12rem]")}
            >
              {contas.length === 0 ? (
                <option value="">Nenhuma conta cadastrada</option>
              ) : (
                contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.nome}
                    {conta.banco ? ` · ${conta.banco}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="filtro-extrato-inicio" className="sr-only">
            Data inicial
          </label>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="filtro-extrato-inicio"
              name="inicio"
              type="date"
              defaultValue={inicio}
              disabled={pendente}
              className={cn(classeSelect, "tabular")}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="filtro-extrato-fim" className="sr-only">
            Data final
          </label>
          <input
            id="filtro-extrato-fim"
            name="fim"
            type="date"
            defaultValue={fim}
            disabled={pendente}
            className={cn(classeSelect, "tabular")}
            required
          />
        </div>
        <button
          type="submit"
          disabled={pendente || contas.length === 0}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {pendente ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Atualizando
            </span>
          ) : (
            "Aplicar"
          )}
        </button>
      </div>
    </form>
  );
}
