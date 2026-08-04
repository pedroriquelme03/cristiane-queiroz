"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Maximize, Minimize, Presentation, TrendingUp } from "lucide-react";

import { GraficoSaldo } from "@/components/graficos/grafico-saldo";
import { EIXO, GRADE, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { mesCurto, moeda, moedaCompacta, percentual } from "@/lib/format";
import type { Indicador, LinhaDre, PontoProjecao } from "@/lib/types";

const CORES = ["#b38a36", "#6d8d7a", "#7c7297", "#bd7a5c", "#587c9c", "#9b8b5f"];

type Serie = { competencia: string; receita: number; despesas: number; resultado: number };

export function PainelApresentacaoCliente({
  nomeEmpresa,
  serie,
  linhas,
  projecao,
  indicadores,
}: {
  nomeEmpresa: string;
  serie: Serie[];
  linhas: LinhaDre[];
  projecao: PontoProjecao[];
  indicadores: Indicador[];
}) {
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const atual = serie.at(-1) ?? { receita: 0, despesas: 0, resultado: 0 };
  const anterior = serie.at(-2);
  const variacaoReceita = anterior?.receita ? ((atual.receita - anterior.receita) / anterior.receita) * 100 : null;
  const receitas = linhas.filter((linha) => linha.tipo === "receita" && linha.realizado > 0).sort((a, b) => b.realizado - a.realizado);
  const gastos = linhas.filter((linha) => linha.tipo !== "receita" && linha.realizado < 0).sort((a, b) => a.realizado - b.realizado);
  const totalReceita = receitas.reduce((total, linha) => total + linha.realizado, 0);
  const totalGastos = gastos.reduce((total, linha) => total + Math.abs(linha.realizado), 0);
  const menorCaixa = projecao.reduce<PontoProjecao | null>((menor, ponto) => !menor || ponto.saldoProjetado < menor.saldoProjetado ? ponto : menor, null);

  const alternarTelaCheia = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setEmTelaCheia(false);
    } else {
      await document.documentElement.requestFullscreen();
      setEmTelaCheia(true);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand/20 bg-brand-soft px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-brand"><Presentation className="size-4" aria-hidden /> Apresentação executiva</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Resultados de {nomeEmpresa}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Uma leitura visual de resultado, liquidez e direcionadores para a conversa com o cliente.</p>
          </div>
          <button type="button" onClick={alternarTelaCheia} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-muted">
            {emTelaCheia ? <Minimize className="size-4" /> : <Maximize className="size-4" />} {emTelaCheia ? "Sair da tela cheia" : "Modo apresentação"}
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Receita do mês" valor={moeda(atual.receita)} tom="positivo" nota={variacaoReceita === null ? "Primeiro mês da série" : `${variacaoReceita >= 0 ? "+" : ""}${percentual(variacaoReceita)} vs. mês anterior`} />
        <Kpi rotulo="Despesas do mês" valor={moeda(atual.despesas)} tom="negativo" />
        <Kpi rotulo="Resultado do mês" valor={moeda(atual.resultado)} tom={atual.resultado >= 0 ? "positivo" : "negativo"} nota={`Margem de ${percentual(atual.receita ? (atual.resultado / atual.receita) * 100 : null)}`} />
        <Kpi rotulo="Menor caixa projetado" valor={menorCaixa ? moeda(menorCaixa.saldoProjetado) : "—"} tom={menorCaixa && menorCaixa.saldoProjetado < 0 ? "negativo" : "neutro"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader titulo="Evolução financeira" descricao="Receita, despesas e resultado dos últimos seis meses." />
          <CardBody>
            <MolduraGrafico altura={280}>
              <ResponsiveContainer><BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}><CartesianGrid {...GRADE} /><XAxis dataKey="competencia" {...EIXO} tickFormatter={mesCurto} /><YAxis {...EIXO} width={68} tickFormatter={moedaCompacta} /><Tooltip content={({ active, payload, label }) => active && payload?.length ? <TooltipCartao titulo={mesCurto(String(label))} linhas={[{ rotulo: "Receita", valor: moeda(Number(payload[0]?.payload.receita ?? 0)), cor: "var(--serie-entrada)" }, { rotulo: "Despesas", valor: moeda(Number(payload[0]?.payload.despesas ?? 0)), cor: "var(--serie-saida)" }, { rotulo: "Resultado", valor: moeda(Number(payload[0]?.payload.resultado ?? 0)), cor: "var(--serie-saldo)" }]} /> : null} /><Bar dataKey="receita" fill="var(--serie-entrada)" radius={[4, 4, 0, 0]} maxBarSize={30} /><Bar dataKey="despesas" fill="var(--serie-saida)" radius={[4, 4, 0, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer>
            </MolduraGrafico>
          </CardBody>
        </Card>
        <Card>
          <CardHeader titulo="Mensagem para a reunião" descricao="O que merece atenção na conversa." />
          <CardBody className="space-y-4">
            <Mensagem titulo={atual.resultado >= 0 ? "Operação com resultado positivo" : "Resultado pede atenção"} texto={atual.resultado >= 0 ? `A operação gerou ${moeda(atual.resultado)} no período.` : `O período fechou com ${moeda(atual.resultado)}; reveja custos e ritmo de recebimento.`} />
            <Mensagem titulo={receitas[0] ? `${receitas[0].conta} é a maior fonte` : "Receitas sem classificação"} texto={receitas[0] ? `Representa ${percentual((receitas[0].realizado / totalReceita) * 100, 0)} do faturamento atual.` : "Classifique lançamentos para habilitar esta análise."} />
            <Mensagem titulo="Liquidez projetada" texto={menorCaixa ? `O menor saldo projetado é ${moeda(menorCaixa.saldoProjetado)} nos próximos 90 dias.` : "Sem títulos em aberto para projeção."} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader titulo="De onde vem a receita" descricao="Participação das fontes no mês atual." />
          <CardBody className="grid items-center gap-4 sm:grid-cols-[13rem_1fr]"><MolduraGrafico altura={220}><ResponsiveContainer><PieChart><Tooltip content={({ active, payload }) => active && payload?.length ? <TooltipCartao titulo={String(payload[0]?.name)} linhas={[{ rotulo: "Receita", valor: moeda(Number(payload[0]?.value ?? 0)) }]} /> : null} /><Pie data={receitas} dataKey="realizado" nameKey="conta" innerRadius={56} outerRadius={85} paddingAngle={3}>{receitas.map((linha, indice) => <Cell key={linha.planoContaId} fill={CORES[indice % CORES.length]} />)}</Pie></PieChart></ResponsiveContainer></MolduraGrafico><ListaParticipacao linhas={receitas} total={totalReceita} /></CardBody>
        </Card>
        <Card>
          <CardHeader titulo="Para onde vai o recurso" descricao="Principais custos e despesas do mês." />
          <CardBody><ListaParticipacao linhas={gastos.map((linha) => ({ ...linha, realizado: Math.abs(linha.realizado) }))} total={totalGastos} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader titulo="Projeção de caixa" descricao="Visão de continuidade financeira para os próximos 90 dias." />
        <CardBody><GraficoSaldo pontos={projecao} chave="saldoProjetado" /></CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {indicadores.slice(0, 3).map((indicador) => {
          const ultimo = indicador.valores.at(-1);
          return <Card key={indicador.id}><CardBody><div className="flex items-center gap-2 text-brand"><TrendingUp className="size-4" /><p className="text-xs font-medium">Indicador de gestão</p></div><p className="mt-2 text-sm font-medium">{indicador.nome}</p><p className="mt-1 text-2xl font-semibold tabular">{ultimo ? indicador.unidade === "moeda" ? moeda(ultimo.valor) : indicador.unidade === "percentual" ? percentual(ultimo.valor) : `${ultimo.valor.toFixed(1)} ${indicador.unidade === "dias" ? "dias" : ""}` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Meta: {ultimo?.meta === null || ultimo?.meta === undefined ? "não definida" : indicador.unidade === "percentual" ? percentual(ultimo.meta) : indicador.unidade === "moeda" ? moeda(ultimo.meta) : ultimo.meta}</p></CardBody></Card>;
        })}
      </div>
    </div>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) { return <div className="rounded-lg border border-border p-3"><p className="text-sm font-medium">{titulo}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{texto}</p></div>; }

function ListaParticipacao({ linhas, total }: { linhas: { planoContaId: string; conta: string; realizado: number }[]; total: number }) { return <ul className="space-y-3">{linhas.slice(0, 5).map((linha, indice) => <li key={linha.planoContaId}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{linha.conta}</span><span className="tabular text-xs font-medium">{moeda(linha.realizado)}</span></div><div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${total ? (linha.realizado / total) * 100 : 0}%`, background: CORES[indice % CORES.length] }} /></div><span className="w-9 text-right text-xs tabular text-muted-foreground">{percentual(total ? (linha.realizado / total) * 100 : 0, 0)}</span></div></li>)}</ul>; }
