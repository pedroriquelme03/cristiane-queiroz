"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EIXO, GRADE, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { moeda, moedaCompacta } from "@/lib/format";

/**
 * Gráficos da tela de Vendas. Todos têm uma série só (faturamento), então usam
 * uma cor e dispensam legenda: o título do cartão nomeia a medida.
 */

export interface PontoVendas {
  rotulo: string;
  /** Texto do tooltip (ex.: data por extenso, nome completo do produto). */
  titulo: string;
  valor: number;
  quantidade?: number;
}

const COR = "var(--serie-saldo)";

function Dica({ ponto }: { ponto: PontoVendas }) {
  return (
    <TooltipCartao
      titulo={ponto.titulo}
      linhas={[
        { rotulo: "Faturamento", valor: moeda(ponto.valor), cor: COR },
        ...(ponto.quantidade !== undefined
          ? [{ rotulo: "Quantidade", valor: ponto.quantidade.toLocaleString("pt-BR") }]
          : []),
      ]}
    />
  );
}

/** Barras verticais: série no tempo (dias do mês, meses do ano). */
export function GraficoColunas({ pontos, altura = 220 }: { pontos: PontoVendas[]; altura?: number }) {
  return (
    <MolduraGrafico altura={altura}>
      <ResponsiveContainer>
        <BarChart data={pontos} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="rotulo" {...EIXO} minTickGap={8} interval="preserveStartEnd" />
          <YAxis {...EIXO} width={64} tickFormatter={(v: number) => moedaCompacta(v)} />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? <Dica ponto={payload[0].payload as PontoVendas} /> : null
            }
          />
          <Bar dataKey="valor" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </MolduraGrafico>
  );
}

/** Barras horizontais: ranking (departamentos, produtos, usuários). */
export function GraficoRanking({ pontos }: { pontos: PontoVendas[] }) {
  // 28px por barra dá folga para o rótulo e para o alvo do hover
  const altura = Math.max(120, pontos.length * 28 + 24);
  return (
    <MolduraGrafico altura={altura}>
      <ResponsiveContainer>
        <BarChart data={pontos} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid {...GRADE} vertical horizontal={false} />
          <XAxis type="number" {...EIXO} tickFormatter={(v: number) => moedaCompacta(v)} />
          <YAxis
            type="category"
            dataKey="rotulo"
            {...EIXO}
            width={168}
            interval={0}
            tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? <Dica ponto={payload[0].payload as PontoVendas} /> : null
            }
          />
          <Bar dataKey="valor" fill={COR} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </MolduraGrafico>
  );
}
