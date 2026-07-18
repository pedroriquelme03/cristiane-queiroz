"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/**
 * Sparkline para a linha do indicador na tabela. Sem eixos nem tooltip: o valor
 * e a variação aparecem em texto ao lado, então a forma só carrega a tendência.
 */
export function MiniSerie({
  valores,
  positivo,
}: {
  valores: number[];
  /** true quando a tendência é favorável para este indicador */
  positivo: boolean;
}) {
  const dados = valores.map((valor, i) => ({ i, valor }));

  return (
    <div className="h-9 w-28" aria-hidden>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={positivo ? "var(--serie-entrada)" : "var(--serie-saida)"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
