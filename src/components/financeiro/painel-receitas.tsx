"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ReceiptText, Sparkles } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { EIXO, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { data as formatarData, moeda, moedaCompacta, percentual } from "@/lib/format";
import type { Lancamento, LinhaDre } from "@/lib/types";
import { cn } from "@/lib/utils";

const CORES = ["#b38a36", "#6d8d7a", "#7c7297", "#bd7a5c", "#587c9c", "#9b8b5f"];

type Fonte = { id: string; nome: string; valor: number; movimentos: Lancamento[] };

export function PainelReceitas({
  linhas,
  lancamentos,
  competencia,
}: {
  linhas: LinhaDre[];
  lancamentos: Lancamento[];
  competencia: string;
}) {
  const fontes = useMemo<Fonte[]>(() => {
    const contasReceita = linhas.filter((linha) => linha.tipo === "receita" && linha.realizado !== 0);
    return contasReceita
      .map((conta) => ({
        id: conta.planoContaId,
        nome: conta.conta,
        valor: conta.realizado,
        movimentos: lancamentos.filter((lancamento) => lancamento.planoContaId === conta.planoContaId),
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [lancamentos, linhas]);

  const [fonteSelecionada, setFonteSelecionada] = useState<string | null>(null);
  const fonteAtiva = fontes.find((fonte) => fonte.id === fonteSelecionada) ?? null;
  const fontesVisiveis = fonteAtiva ? [fonteAtiva] : fontes;
  const movimentosVisiveis = fonteAtiva
    ? fonteAtiva.movimentos
    : fontes.flatMap((fonte) => fonte.movimentos);
  const receitaTotal = fontesVisiveis.reduce((total, fonte) => total + fonte.valor, 0);
  const receitaGeral = fontes.reduce((total, fonte) => total + fonte.valor, 0);
  const maiorFonte = fontes[0];
  const ticketMedio = movimentosVisiveis.length ? receitaTotal / movimentosVisiveis.length : 0;

  const porDia = useMemo(() => {
    const dias = new Map<string, number>();
    for (const movimento of movimentosVisiveis) {
      const sinal = movimento.tipo === "entrada" ? 1 : -1;
      dias.set(movimento.data, (dias.get(movimento.data) ?? 0) + movimento.valor * sinal);
    }
    return [...dias.entries()]
      .map(([data, valor]) => ({ data, valor }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [movimentosVisiveis]);

  if (!fontes.length) {
    return (
      <Card>
        <CardHeader titulo="Análise de receitas" descricao="Acompanhe a origem do faturamento assim que houver lançamentos classificados como receita." />
        <CardBody className="py-12 text-center text-sm text-muted-foreground">
          Ainda não há receitas classificadas neste período.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-brand/20 bg-brand-soft px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-brand">
              <Sparkles className="size-4" aria-hidden /> Inteligência de receitas
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {fonteAtiva ? `Foco em ${fonteAtiva.nome}` : "O que está trazendo receita para a operação?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma fonte para atualizar todos os indicadores e descobrir sua composição.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFonteSelecionada(null)}
            disabled={!fonteAtiva}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted disabled:cursor-default disabled:opacity-50"
          >
            Ver todas as fontes
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Receita analisada" valor={moeda(receitaTotal)} tom="positivo" />
        <Kpi rotulo="Fontes ativas" valor={String(fontesVisiveis.length)} nota={fonteAtiva ? "Filtro aplicado" : "no período"} />
        <Kpi rotulo="Ticket médio" valor={moeda(ticketMedio)} nota={`${movimentosVisiveis.length} lançamento(s)`} />
        <Kpi
          rotulo="Principal fonte"
          valor={maiorFonte ? percentual((maiorFonte.valor / receitaGeral) * 100, 0) : "—"}
          nota={maiorFonte?.nome ?? "—"}
          tom="atencao"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader titulo="Mix de receitas" descricao="Clique em uma fonte para explorar somente seus resultados." />
          <CardBody className="grid gap-5 sm:grid-cols-[12rem_1fr] sm:items-center">
            <MolduraGrafico altura={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload as Fonte;
                      return <TooltipCartao titulo={item.nome} linhas={[{ rotulo: "Receita", valor: moeda(item.valor) }]} />;
                    }}
                  />
                  <Pie
                    data={fontes}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    onClick={(item) => setFonteSelecionada(fontes.find((fonte) => fonte.nome === item.name)?.id ?? null)}
                    className="cursor-pointer focus:outline-none"
                  >
                    {fontes.map((fonte, indice) => (
                      <Cell key={fonte.id} fill={CORES[indice % CORES.length]} opacity={!fonteAtiva || fonteAtiva.id === fonte.id ? 1 : 0.28} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </MolduraGrafico>
            <ul className="space-y-1.5">
              {fontes.map((fonte, indice) => {
                const ativa = fonteAtiva?.id === fonte.id;
                return (
                  <li key={fonte.id}>
                    <button
                      type="button"
                      onClick={() => setFonteSelecionada(ativa ? null : fonte.id)}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted", ativa && "bg-surface-muted")}
                    >
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: CORES[indice % CORES.length] }} />
                      <span className="min-w-0 flex-1 truncate">{fonte.nome}</span>
                      <span className="tabular text-xs font-medium">{moeda(fonte.valor)}</span>
                      <span className="tabular text-xs text-muted-foreground">{percentual((fonte.valor / receitaGeral) * 100, 0)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titulo="Leitura rápida" descricao="Sinais para orientar a conversa de gestão." />
          <CardBody className="space-y-4">
            <Insight icone={<ArrowUpRight className="size-4" />} titulo={`${maiorFonte?.nome} lidera o faturamento`} texto={`Representa ${percentual(((maiorFonte?.valor ?? 0) / receitaGeral) * 100, 0)} da receita do período.`} />
            <Insight icone={<ReceiptText className="size-4" />} titulo={`${movimentosVisiveis.length} entradas compõem o resultado`} texto={`O ticket médio ${fonteAtiva ? "desta fonte" : "da operação"} é de ${moeda(ticketMedio)}.`} />
            <Insight icone={<Sparkles className="size-4" />} titulo={fontes.length > 1 ? "Receitas diversificadas" : "Receita concentrada"} texto={fontes.length > 1 ? `Há ${fontes.length} fontes classificadas para acompanhar separadamente.` : "Classifique novas linhas de receita para ampliar a leitura do negócio."} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader titulo="Ritmo de entradas" descricao={`Movimento diário de ${fonteAtiva?.nome ?? "todas as fontes"} em ${competencia}.`} />
        <CardBody>
          <MolduraGrafico altura={235}>
            <ResponsiveContainer>
              <AreaChart data={porDia} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <defs><linearGradient id="receita-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--serie-entrada)" stopOpacity={0.36} /><stop offset="100%" stopColor="var(--serie-entrada)" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="data" {...EIXO} tickFormatter={(valor: string) => valor.slice(8, 10)} minTickGap={18} />
                <YAxis {...EIXO} width={64} tickFormatter={(valor: number) => moedaCompacta(valor)} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? <TooltipCartao titulo={formatarData(String(label))} linhas={[{ rotulo: "Receita", valor: moeda(Number(payload[0]?.value ?? 0)), cor: "var(--serie-entrada)" }]} /> : null} />
                <Area type="monotone" dataKey="valor" stroke="var(--serie-entrada)" strokeWidth={2} fill="url(#receita-area)" />
              </AreaChart>
            </ResponsiveContainer>
          </MolduraGrafico>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Lançamentos que compõem a receita" descricao="Aprofunde a análise até a origem de cada entrada." />
        <CardBody className="px-0 py-0">
          <div className="max-h-[25rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted-foreground">
                <tr className="border-b border-border"><th className="px-5 py-2.5 text-left font-medium">Data</th><th className="px-3 py-2.5 text-left font-medium">Fonte</th><th className="px-3 py-2.5 text-left font-medium">Descrição</th><th className="px-3 py-2.5 text-left font-medium">Cliente</th><th className="px-5 py-2.5 text-right font-medium">Valor</th></tr>
              </thead>
              <tbody>
                {movimentosVisiveis.sort((a, b) => b.data.localeCompare(a.data)).map((movimento) => (
                  <tr key={movimento.id} className="border-b border-border last:border-0"><td className="px-5 py-2.5 tabular whitespace-nowrap">{formatarData(movimento.data)}</td><td className="px-3 py-2.5 text-muted-foreground">{fontes.find((fonte) => fonte.id === movimento.planoContaId)?.nome ?? "—"}</td><td className="px-3 py-2.5">{movimento.descricao}</td><td className="px-3 py-2.5 text-muted-foreground">{movimento.contraparte ?? "—"}</td><td className="px-5 py-2.5 text-right font-medium tabular text-positive">+{moeda(movimento.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Insight({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return <div className="flex gap-3 rounded-lg border border-border p-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{icone}</span><div><p className="text-sm font-medium">{titulo}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{texto}</p></div></div>;
}
