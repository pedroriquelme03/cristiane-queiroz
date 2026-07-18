"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EIXO, GRADE, Legenda, MolduraGrafico, TooltipCartao } from "@/components/graficos/base";
import { data as formatarData, moeda, moedaCompacta } from "@/lib/format";
import type { PontoFluxo } from "@/lib/types";

/**
 * Entradas e saídas do período. As saídas descem abaixo da linha zero: o sinal
 * já distingue as duas séries, então a cor não é o único canal — é a folga que
 * o par verde/vermelho precisa para quem tem daltonismo protan.
 */
export function GraficoMovimento({ pontos }: { pontos: PontoFluxo[] }) {
  const dados = pontos.map((p) => ({
    data: p.data,
    entradas: p.entradas,
    saidas: -p.saidas,
  }));

  return (
    <div className="space-y-3">
      <Legenda
        itens={[
          { rotulo: "Entradas", cor: "var(--serie-entrada)" },
          { rotulo: "Saídas", cor: "var(--serie-saida)" },
        ]}
      />
      <MolduraGrafico altura={220}>
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid {...GRADE} />
            <XAxis
              dataKey="data"
              {...EIXO}
              tickFormatter={(v: string) => v.slice(8, 10)}
              minTickGap={16}
            />
            <YAxis
              {...EIXO}
              width={64}
              tickFormatter={(v: number) => moedaCompacta(Math.abs(v))}
            />
            <ReferenceLine y={0} stroke="var(--eixo)" />
            <Tooltip
              cursor={{ fill: "var(--surface-muted)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <TooltipCartao
                    titulo={formatarData(String(label))}
                    linhas={[
                      {
                        rotulo: "Entradas",
                        valor: moeda(Number(payload[0]?.payload.entradas ?? 0)),
                        cor: "var(--serie-entrada)",
                      },
                      {
                        rotulo: "Saídas",
                        valor: moeda(Math.abs(Number(payload[0]?.payload.saidas ?? 0))),
                        cor: "var(--serie-saida)",
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="entradas" radius={[4, 4, 0, 0]} maxBarSize={14}>
              {dados.map((d) => (
                <Cell key={`e-${d.data}`} fill="var(--serie-entrada)" />
              ))}
            </Bar>
            <Bar dataKey="saidas" radius={[0, 0, 4, 4]} maxBarSize={14}>
              {dados.map((d) => (
                <Cell key={`s-${d.data}`} fill="var(--serie-saida)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </MolduraGrafico>
    </div>
  );
}
