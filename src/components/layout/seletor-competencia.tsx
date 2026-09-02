"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";

import { definirCompetencia } from "@/app/(app)/competencia/acoes";
import { cn } from "@/lib/utils";

const MESES = [
  { valor: "01", rotulo: "Janeiro" },
  { valor: "02", rotulo: "Fevereiro" },
  { valor: "03", rotulo: "Março" },
  { valor: "04", rotulo: "Abril" },
  { valor: "05", rotulo: "Maio" },
  { valor: "06", rotulo: "Junho" },
  { valor: "07", rotulo: "Julho" },
  { valor: "08", rotulo: "Agosto" },
  { valor: "09", rotulo: "Setembro" },
  { valor: "10", rotulo: "Outubro" },
  { valor: "11", rotulo: "Novembro" },
  { valor: "12", rotulo: "Dezembro" },
] as const;

const classeSelect =
  "cursor-pointer rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-wait disabled:opacity-60";

export function SeletorCompetencia({
  competencia,
  opcoes,
}: {
  competencia: string;
  opcoes: string[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const mesAtual = competencia.slice(5, 7);
  const anoAtual = competencia.slice(0, 4);

  const anos = useMemo(() => {
    const conjunto = new Set<string>();
    for (const opcao of opcoes) conjunto.add(opcao.slice(0, 4));
    conjunto.add(anoAtual);
    conjunto.add(String(new Date().getFullYear()));
    const min = Math.min(...[...conjunto].map(Number));
    const max = Math.max(...[...conjunto].map(Number));
    const lista: string[] = [];
    for (let ano = max + 1; ano >= min - 2; ano--) {
      lista.push(String(ano));
    }
    return lista;
  }, [opcoes, anoAtual]);

  function aoMudar(mes: string, ano: string) {
    const nova = `${ano}-${mes}`;
    if (nova === `${anoAtual}-${mesAtual}`) return;
    iniciar(async () => {
      await definirCompetencia(nova);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs",
        pendente && "opacity-70",
      )}
    >
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Competência</span>
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor="competencia-mes">
          Mês
        </label>
        <select
          id="competencia-mes"
          value={mesAtual}
          onChange={(evento) => aoMudar(evento.target.value, anoAtual)}
          disabled={pendente}
          className={classeSelect}
        >
          {MESES.map((mes) => (
            <option key={mes.valor} value={mes.valor}>
              {mes.rotulo}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="competencia-ano">
          Ano
        </label>
        <select
          id="competencia-ano"
          value={anoAtual}
          onChange={(evento) => aoMudar(mesAtual, evento.target.value)}
          disabled={pendente}
          className={cn(classeSelect, "tabular")}
        >
          {anos.map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
      </div>
      {pendente ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
    </div>
  );
}
