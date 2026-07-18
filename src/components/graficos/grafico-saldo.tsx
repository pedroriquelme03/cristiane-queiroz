"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EIXO, GRADE, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { data as formatarData, moeda, moedaCompacta } from "@/lib/format";

/**
 * Série única de saldo. Fica em gráfico separado do movimento diário de
 * propósito: as duas escalas são muito diferentes e um eixo duplo distorceria
 * a leitura. Série única não precisa de legenda — o título já a nomeia.
 */
export function GraficoSaldo({
  pontos,
  chave = "saldoAcumulado",
}: {
  /** Qualquer série com uma data; `chave` diz qual campo plotar. */
  pontos: readonly { data: string }[];
  chave?: string;
}) {
  return (
    <MolduraGrafico altura={220}>
      <ResponsiveContainer>
        <AreaChart
          data={pontos as { data: string }[]}
          margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--serie-saldo)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--serie-saldo)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRADE} />
          <XAxis
            dataKey="data"
            {...EIXO}
            tickFormatter={(v: string) => v.slice(8, 10) + "/" + v.slice(5, 7)}
            minTickGap={28}
          />
          <YAxis {...EIXO} width={64} tickFormatter={(v: number) => moedaCompacta(v)} />
          <ReferenceLine y={0} stroke="var(--serie-saida)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "var(--eixo)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipCartao
                  titulo={formatarData(String(label))}
                  linhas={[
                    {
                      rotulo: "Saldo",
                      valor: moeda(Number(payload[0]?.value ?? 0)),
                      cor: "var(--serie-saldo)",
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={chave}
            stroke="var(--serie-saldo)"
            strokeWidth={2}
            fill="url(#grad-saldo)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </MolduraGrafico>
  );
}
