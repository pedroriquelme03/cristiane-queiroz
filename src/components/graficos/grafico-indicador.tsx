"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EIXO, GRADE, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { competenciaExtenso, mesCurto, numero, valorIndicador } from "@/lib/format";
import type { Indicador } from "@/lib/types";

/** Série única do indicador ao longo de 12 meses, com a meta como referência. */
export function GraficoIndicador({
  indicador,
  altura = 200,
}: {
  indicador: Indicador;
  altura?: number;
}) {
  const meta = indicador.valores[0]?.meta ?? null;

  return (
    <MolduraGrafico altura={altura}>
      <ResponsiveContainer>
        <LineChart
          data={indicador.valores}
          margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
        >
          <CartesianGrid {...GRADE} />
          <XAxis
            dataKey="competencia"
            {...EIXO}
            tickFormatter={mesCurto}
            minTickGap={12}
          />
          <YAxis
            {...EIXO}
            width={56}
            tickFormatter={(v: number) =>
              indicador.unidade === "moeda"
                ? new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(v)
                : numero(v)
            }
          />
          {meta !== null ? (
            <ReferenceLine
              y={meta}
              stroke="var(--eixo)"
              strokeDasharray="5 4"
              label={{
                value: `meta ${valorIndicador(meta, indicador.unidade)}`,
                position: "insideTopRight",
                fill: "var(--eixo)",
                fontSize: 10,
              }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--eixo)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipCartao
                  titulo={competenciaExtenso(String(label))}
                  linhas={[
                    {
                      rotulo: indicador.nome,
                      valor: valorIndicador(
                        Number(payload[0]?.value ?? 0),
                        indicador.unidade,
                      ),
                      cor: "var(--serie-saldo)",
                    },
                    ...(meta !== null
                      ? [
                          {
                            rotulo: "Meta",
                            valor: valorIndicador(meta, indicador.unidade),
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--serie-saldo)"
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--serie-saldo)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </MolduraGrafico>
  );
}
