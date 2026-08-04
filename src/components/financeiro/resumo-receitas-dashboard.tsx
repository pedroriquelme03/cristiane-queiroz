"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Layers3 } from "lucide-react";

import { moeda, percentual } from "@/lib/format";
import type { Lancamento, LinhaDre } from "@/lib/types";
import { cn } from "@/lib/utils";

const CORES = ["bg-brand", "bg-positive", "bg-[#7c7297]", "bg-warning", "bg-[#587c9c]"];

export function ResumoReceitasDashboard({
  linhas,
  lancamentos,
  href,
}: {
  linhas: LinhaDre[];
  lancamentos: Lancamento[];
  href: string;
}) {
  const fontes = useMemo(() => linhas
    .filter((linha) => linha.tipo === "receita" && linha.realizado !== 0)
    .map((linha) => ({
      id: linha.planoContaId,
      nome: linha.conta,
      valor: linha.realizado,
      lancamentos: lancamentos.filter((lancamento) => lancamento.planoContaId === linha.planoContaId),
    }))
    .sort((a, b) => b.valor - a.valor), [lancamentos, linhas]);
  const [fonteId, setFonteId] = useState<string | null>(null);
  const fonteAtiva = fontes.find((fonte) => fonte.id === fonteId) ?? fontes[0];
  const total = fontes.reduce((soma, fonte) => soma + fonte.valor, 0);

  if (!fontes.length) return null;

  return (
    <section className="rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-brand"><Layers3 className="size-3.5" aria-hidden /> Receita em foco</div>
          <h2 className="mt-1 text-sm font-semibold tracking-tight">De onde vem o faturamento?</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Escolha uma fonte para atualizar a leitura.</p>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Explorar receitas <ArrowRight className="size-3.5" aria-hidden /></Link>
      </header>
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-2">
          {fontes.slice(0, 5).map((fonte, indice) => {
            const ativa = fonte.id === fonteAtiva?.id;
            const participacao = total ? (fonte.valor / total) * 100 : 0;
            return (
              <button key={fonte.id} type="button" onClick={() => setFonteId(fonte.id)} className={cn("w-full rounded-lg p-2 text-left transition-colors hover:bg-surface-muted", ativa && "bg-surface-muted") }>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{fonte.nome}</span><span className="tabular shrink-0 font-medium">{moeda(fonte.valor)}</span></div>
                <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className={cn("h-full rounded-full", CORES[indice])} style={{ width: `${participacao}%` }} /></div><span className="w-9 text-right text-xs tabular text-muted-foreground">{percentual(participacao, 0)}</span></div>
              </button>
            );
          })}
        </div>
        {fonteAtiva ? (
          <aside className="rounded-lg border border-brand/20 bg-brand-soft p-4">
            <p className="text-xs font-medium text-brand">Fonte selecionada</p>
            <p className="mt-1 text-base font-semibold">{fonteAtiva.nome}</p>
            <p className="mt-2 text-2xl font-semibold tabular">{moeda(fonteAtiva.valor)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{percentual((fonteAtiva.valor / total) * 100, 1)} da receita mensal · {fonteAtiva.lancamentos.length} lançamento(s)</p>
            <Link href={href} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Ver composição completa <ArrowRight className="size-3.5" aria-hidden /></Link>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
