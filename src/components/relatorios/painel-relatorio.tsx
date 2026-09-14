import type { ReactNode } from "react";
import Link from "next/link";

import {
  BotoesExportar,
  type ColunaRelatorio,
  type FolhaRelatorio,
  type LinhaRelatorio,
} from "@/components/relatorios/botoes-exportar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { data as formatarData, moeda, numero } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatarCelula(valor: LinhaRelatorio[string], tipo: ColunaRelatorio["tipo"]) {
  if (valor == null || valor === "") return "—";
  if (tipo === "moeda") return moeda(typeof valor === "number" ? valor : Number(valor));
  if (tipo === "numero") return numero(typeof valor === "number" ? valor : Number(valor));
  if (tipo === "data") return formatarData(String(valor));
  return String(valor);
}

function Tabela({
  colunas,
  linhas,
}: {
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
}) {
  const somaveis = colunas.filter((coluna) => coluna.tipo === "moeda" || coluna.tipo === "numero");
  const totais = Object.fromEntries(
    somaveis.map((coluna) => [
      coluna.chave,
      linhas.reduce((soma, linha) => soma + (typeof linha[coluna.chave] === "number" ? Number(linha[coluna.chave]) : 0), 0),
    ]),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {colunas.map((coluna, indice) => {
              const direita = coluna.tipo === "moeda" || coluna.tipo === "numero";
              return (
                <th
                  key={coluna.chave}
                  scope="col"
                  className={cn(
                    "py-2.5 font-medium",
                    indice === 0 ? "px-5 text-left" : "px-3",
                    indice === colunas.length - 1 && "px-5",
                    direita ? "text-right" : "text-left",
                  )}
                >
                  {coluna.rotulo}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length} className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum registro para os filtros aplicados.
              </td>
            </tr>
          ) : (
            linhas.map((linha, indiceLinha) => (
              <tr key={indiceLinha} className="border-b border-border last:border-0">
                {colunas.map((coluna, indice) => {
                  const direita = coluna.tipo === "moeda" || coluna.tipo === "numero";
                  return (
                    <td
                      key={coluna.chave}
                      className={cn(
                        "py-2.5",
                        indice === 0 ? "px-5" : "px-3",
                        indice === colunas.length - 1 && "px-5",
                        direita && "tabular text-right",
                      )}
                    >
                      {formatarCelula(linha[coluna.chave], coluna.tipo)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {linhas.length > 0 && somaveis.length > 0 ? (
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-muted font-semibold">
              {colunas.map((coluna, indice) => {
                const direita = coluna.tipo === "moeda" || coluna.tipo === "numero";
                return (
                  <td
                    key={coluna.chave}
                    className={cn(
                      "py-2.5",
                      indice === 0 ? "px-5" : "px-3",
                      indice === colunas.length - 1 && "px-5",
                      direita && "tabular text-right",
                    )}
                  >
                    {indice === 0
                      ? "Totais"
                      : direita
                        ? formatarCelula(totais[coluna.chave] ?? 0, coluna.tipo)
                        : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function PainelRelatorio({
  titulo,
  descricao,
  voltarHref,
  voltarRotulo = "Voltar aos relatórios",
  resumoFiltros,
  nomeArquivo,
  filtros,
  kpis,
  colunas,
  linhas,
  tabelasExtras = [],
  children,
}: {
  titulo: string;
  descricao?: string;
  voltarHref: string;
  voltarRotulo?: string;
  resumoFiltros: string;
  nomeArquivo: string;
  filtros: ReactNode;
  kpis?: { rotulo: string; valor: string; nota?: string; tom?: "neutro" | "positivo" | "negativo" | "atencao" }[];
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  tabelasExtras?: FolhaRelatorio[];
  children?: ReactNode;
}) {
  const folhas: FolhaRelatorio[] = [{ nome: titulo.slice(0, 31), colunas, linhas }, ...tabelasExtras];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={voltarHref} className="text-xs font-medium text-brand hover:underline">
          ← {voltarRotulo}
        </Link>
        <BotoesExportar
          titulo={titulo}
          resumoFiltros={resumoFiltros}
          nomeArquivo={nomeArquivo}
          folhas={folhas}
        />
      </div>

      <Card>
        <CardHeader titulo="Filtros" descricao="Os resultados, totais e arquivos exportados respeitam exatamente o que estiver aplicado aqui." />
        <CardBody>{filtros}</CardBody>
      </Card>

      {kpis && kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Kpi key={kpi.rotulo} rotulo={kpi.rotulo} valor={kpi.valor} nota={kpi.nota} tom={kpi.tom} />
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader titulo={titulo} descricao={descricao ?? resumoFiltros} />
        <CardBody className="px-0 py-0">
          <Tabela colunas={colunas} linhas={linhas} />
        </CardBody>
      </Card>

      {tabelasExtras.map((tabela) => (
        <Card key={tabela.nome}>
          <CardHeader titulo={tabela.nome} />
          <CardBody className="px-0 py-0">
            <Tabela colunas={tabela.colunas} linhas={tabela.linhas} />
          </CardBody>
        </Card>
      ))}

      {children}
    </div>
  );
}
