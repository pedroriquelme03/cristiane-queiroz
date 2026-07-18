"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Legenda, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";

/**
 * Compara a avaliação inicial com a atual nas oito áreas. Duas séries, então a
 * legenda é obrigatória; o tooltip traz o número exato de cada uma.
 */
export function GraficoRadar({
  dados,
  altura = 320,
}: {
  dados: { area: string; inicial: number; atual: number }[];
  altura?: number;
}) {
  return (
    <div className="space-y-3">
      <Legenda
        itens={[
          { rotulo: "Avaliação inicial", cor: "var(--eixo)" },
          { rotulo: "Avaliação atual", cor: "var(--serie-saldo)" },
        ]}
      />
      <MolduraGrafico altura={altura}>
        <ResponsiveContainer>
          <RadarChart data={dados} outerRadius="72%">
            <PolarGrid stroke="var(--grade)" />
            <PolarAngleAxis
              dataKey="area"
              tick={{ fill: "var(--eixo)", fontSize: 11 }}
            />
            {/* Escala 0–100 sem ticks: eles se empilham no centro e a nota
                exata já aparece no tooltip e na lista ao lado. */}
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as (typeof dados)[number];
                return (
                  <TooltipCartao
                    titulo={p.area}
                    linhas={[
                      { rotulo: "Inicial", valor: `${p.inicial}/100`, cor: "var(--eixo)" },
                      { rotulo: "Atual", valor: `${p.atual}/100`, cor: "var(--serie-saldo)" },
                    ]}
                  />
                );
              }}
            />
            <Radar
              name="Avaliação inicial"
              dataKey="inicial"
              stroke="var(--eixo)"
              strokeWidth={2}
              fill="var(--eixo)"
              fillOpacity={0.08}
            />
            <Radar
              name="Avaliação atual"
              dataKey="atual"
              stroke="var(--serie-saldo)"
              strokeWidth={2}
              fill="var(--serie-saldo)"
              fillOpacity={0.18}
            />
          </RadarChart>
        </ResponsiveContainer>
      </MolduraGrafico>
    </div>
  );
}
