"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";

import { definirCompetencia } from "@/app/(app)/competencia/acoes";
import { competenciaExtenso } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SeletorCompetencia({
  competencia,
  opcoes,
}: {
  competencia: string;
  opcoes: string[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const valor = competencia.slice(0, 7);

  function aoMudar(nova: string) {
    if (nova === valor) return;
    iniciar(async () => {
      await definirCompetencia(nova);
      router.refresh();
    });
  }

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs",
        pendente && "opacity-70",
      )}
    >
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Competência</span>
      <select
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        disabled={pendente}
        aria-label="Selecionar competência"
        className="max-w-[11rem] cursor-pointer truncate border-0 bg-transparent py-0 pr-6 pl-0 text-xs font-medium text-foreground outline-none disabled:cursor-wait"
      >
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao.slice(0, 7)}>
            {competenciaExtenso(opcao)}
          </option>
        ))}
      </select>
      {pendente ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
    </label>
  );
}
