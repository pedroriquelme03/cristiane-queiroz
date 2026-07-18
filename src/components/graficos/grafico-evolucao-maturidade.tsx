"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EIXO, GRADE, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { competenciaExtenso, mesCurto } from "@/lib/format";
import type { AvaliacaoMaturidade } from "@/lib/types";

/** Pontuação geral de maturidade mês a mês. Série única, escala fixa 0–100. */
export function GraficoEvolucaoMaturidade({
  avaliacoes,
}: {
  avaliacoes: AvaliacaoMaturidade[];
}) {
  return (
    <MolduraGrafico altura={200}>
      <ResponsiveContainer>
        <AreaChart
          data={avaliacoes}
          margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="grad-maturidade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--serie-entrada)" stopOpacity={0.24} />
              <stop offset="100%" stopColor="var(--serie-entrada)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRADE} />
          <XAxis dataKey="competencia" {...EIXO} tickFormatter={mesCurto} minTickGap={12} />
          <YAxis {...EIXO} width={32} domain={[0, 100]} />
          <Tooltip
            cursor={{ stroke: "var(--eixo)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipCartao
                  titulo={competenciaExtenso(String(label))}
                  linhas={[
                    {
                      rotulo: "Maturidade geral",
                      valor: `${payload[0]?.value}/100`,
                      cor: "var(--serie-entrada)",
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="pontuacaoGeral"
            stroke="var(--serie-entrada)"
            strokeWidth={2}
            fill="url(#grad-maturidade)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </MolduraGrafico>
  );
}
