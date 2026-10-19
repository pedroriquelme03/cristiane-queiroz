import { Clock3 } from "lucide-react";

import { GraficoRadar } from "@/components/graficos/grafico-radar";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { DialogoAvaliacao } from "@/components/avaliacoes/dialogo-avaliacao";
import { DialogoExecucaoDiagnostico } from "@/components/diagnostico/dialogo-execucao";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkGerarRelatorio } from "@/components/relatorios/link-gerar-relatorio";
import { Progresso } from "@/components/ui/progresso";
import {
  ROTULO_AREA,
  ROTULO_PROGRESSO_DIAGNOSTICO,
} from "@/lib/avaliacoes";
import { getDiagnosticos, getHistoricoDiagnostico } from "@/lib/dados";
import { competenciaExtenso, data as formatarData, dataHora } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import type { ProgressoDiagnostico } from "@/lib/types";

/** Faixas de leitura da nota, para o gestor saber o que fazer com ela. */
function faixa(nota: number) {
  if (nota >= 75) return { rotulo: "Consolidado", tom: "positivo" as const };
  if (nota >= 50) return { rotulo: "Em evolução", tom: "marca" as const };
  if (nota >= 30) return { rotulo: "Frágil", tom: "atencao" as const };
  return { rotulo: "Crítico", tom: "negativo" as const };
}

function tomProgresso(progresso: ProgressoDiagnostico) {
  if (progresso === 100) return "positivo" as const;
  if (progresso === 50) return "marca" as const;
  if (progresso === 30) return "atencao" as const;
  return "neutro" as const;
}

export default async function DiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[]; competencia?: string | string[] }>;
}) {
  const [{ empresa: empresaParam, competencia: competenciaParam }, sessao] = await Promise.all([
    searchParams,
    getSessao(),
  ]);
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const competenciaFiltro =
    typeof competenciaParam === "string" ? competenciaParam.slice(0, 7) : "";

  const [diagnosticos, historico] = await Promise.all([
    getDiagnosticos(empresaIdAtiva),
    getHistoricoDiagnostico(empresaIdAtiva),
  ]);

  const podeExecutar = sessao.role === "admin" || sessao.role === "cliente";
  const ultimoDiagnostico = diagnosticos[diagnosticos.length - 1];
  const selecionado =
    diagnosticos.find((d) => d.competencia.slice(0, 7) === competenciaFiltro) ??
    ultimoDiagnostico;

  const acoesCabecalho = sessao.role === "admin" ? (
    <div className="flex flex-wrap items-end justify-end gap-2">
      <SeletorEmpresaAdmin className="w-full sm:w-72" />
      {selecionado ? (
        <DialogoAvaliacao
          tipo="diagnostico"
          empresaId={empresaIdAtiva}
          modo="editar"
          inicial={{
            competencia: selecionado.competencia,
            observacoes: selecionado.observacoes,
            notas: Object.fromEntries(
              selecionado.itens.map((item) => [item.categoria, item.nota]),
            ),
            observacoesAreas: Object.fromEntries(
              selecionado.itens.map((item) => [item.categoria, item.observacao]),
            ),
          }}
        />
      ) : null}
      <DialogoAvaliacao
        tipo="diagnostico"
        empresaId={empresaIdAtiva}
        modo="novo"
        inicial={
          ultimoDiagnostico
            ? {
                observacoes: ultimoDiagnostico.observacoes,
                notas: Object.fromEntries(
                  ultimoDiagnostico.itens.map((item) => [item.categoria, item.nota]),
                ),
                observacoesAreas: Object.fromEntries(
                  ultimoDiagnostico.itens.map((item) => [
                    item.categoria,
                    item.observacao,
                  ]),
                ),
              }
            : undefined
        }
      />
    </div>
  ) : undefined;

  if (diagnosticos.length === 0) {
    return (
      <>
        <CabecalhoPagina
          titulo="Diagnóstico empresarial"
          descricao="Avaliação por área e execução do plano de melhorias"
          acao={acoesCabecalho}
        />
        <Card>
          <CardBody className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum diagnóstico cadastrado para esta empresa.
          </CardBody>
        </Card>
      </>
    );
  }

  const inicial = diagnosticos[0];
  const atual = selecionado!;
  const ultimaAtualizacao =
    atual.itens.reduce<string | null>((maisRecente, item) => {
      if (!item.atualizadoEm) return maisRecente;
      if (!maisRecente || item.atualizadoEm > maisRecente) return item.atualizadoEm;
      return maisRecente;
    }, atual.atualizadoEm);

  const dadosRadar = atual.itens.map((item) => ({
    area: ROTULO_AREA[item.categoria],
    inicial: inicial.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0,
    atual: item.nota,
  }));

  const mediaAtual = Math.round(
    atual.itens.reduce((s, i) => s + i.nota, 0) / Math.max(atual.itens.length, 1),
  );
  const mediaInicial = Math.round(
    inicial.itens.reduce((s, i) => s + i.nota, 0) / Math.max(inicial.itens.length, 1),
  );
  const concluidasExecucao = atual.itens.filter((i) => i.progresso === 100).length;
  const avancadas = atual.itens.filter((i) => i.progresso > 0).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Diagnóstico empresarial"
        descricao={`Avaliação e execução — ${competenciaExtenso(atual.competencia)}`}
        acao={acoesCabecalho}
      />

      {diagnosticos.length > 1 ? (
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface px-4 py-3">
          {empresaIdAtiva ? (
            <input type="hidden" name="empresa" value={empresaIdAtiva} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Competência do diagnóstico</p>
            <p className="text-xs text-muted-foreground">
              Escolha o snapshot para editar a avaliação ou registrar a execução
            </p>
          </div>
          <label className="sr-only" htmlFor="competencia-diagnostico">
            Competência
          </label>
          <select
            id="competencia-diagnostico"
            name="competencia"
            defaultValue={atual.competencia.slice(0, 7)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {[...diagnosticos].reverse().map((d) => (
              <option key={d.id || d.competencia} value={d.competencia.slice(0, 7)}>
                {competenciaExtenso(d.competencia)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
          >
            Abrir
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Última atualização:{" "}
          <strong className="font-medium text-foreground">
            {ultimaAtualizacao ? dataHora(ultimaAtualizacao) : "—"}
          </strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          Execução: {concluidasExecucao}/{atual.itens.length} concluída
          {concluidasExecucao === 1 ? "" : "s"} · {avancadas} com andamento
        </span>
        <span className="ml-auto">
          <LinkGerarRelatorio href="/diagnostico/relatorio" empresaId={empresaIdAtiva} />
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Panorama das áreas"
            descricao={`Nota geral evoluiu de ${mediaInicial} para ${mediaAtual} em ${diagnosticos.length} avaliações`}
          />
          <CardBody>
            <GraficoRadar dados={dadosRadar} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Avaliação por área"
            descricao="Notas da consultoria (separadas da execução)"
          />
          <CardBody className="space-y-4">
            {atual.itens.map((item) => {
              const notaInicial =
                inicial.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0;
              const evolucao = item.nota - notaInicial;
              const classificacao = faixa(item.nota);

              return (
                <article key={item.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                      {ROTULO_AREA[item.categoria]}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge tom={classificacao.tom}>{classificacao.rotulo}</Badge>
                      <span className="tabular text-sm font-semibold">
                        {item.nota}
                        <span className="text-xs font-normal text-muted-foreground">
                          /100
                        </span>
                      </span>
                    </div>
                  </div>
                  <Progresso
                    valor={item.nota}
                    tom={
                      classificacao.tom === "negativo"
                        ? "negativo"
                        : classificacao.tom === "atencao"
                          ? "atencao"
                          : classificacao.tom === "positivo"
                            ? "positivo"
                            : "marca"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {evolucao >= 0 ? "+" : ""}
                    {evolucao} pontos desde a avaliação inicial
                    {item.observacao ? ` · ${item.observacao}` : ""}
                  </p>
                </article>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          titulo="Execução por área"
          descricao="O que foi realizado, data e andamento (0% / 30% / 50% / 100%) — independente da nota"
        />
        <CardBody className="space-y-4">
          {atual.itens.map((item) => (
            <article
              key={`exec-${item.id || item.categoria}`}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{ROTULO_AREA[item.categoria]}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Nota de avaliação: {item.nota}/100
                  </p>
                </div>
                <Badge tom={tomProgresso(item.progresso)}>
                  {ROTULO_PROGRESSO_DIAGNOSTICO[item.progresso]} ({item.progresso}%)
                </Badge>
              </div>
              <div className="mt-3">
                <Progresso
                  valor={item.progresso}
                  tom={
                    item.progresso === 100
                      ? "positivo"
                      : item.progresso >= 50
                        ? "marca"
                        : item.progresso > 0
                          ? "atencao"
                          : "marca"
                  }
                />
              </div>
              <p className="mt-2 text-sm">
                {item.realizado || (
                  <span className="text-muted-foreground">Nada registrado ainda.</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {item.dataRealizacao
                    ? `Realização: ${formatarData(item.dataRealizacao)}`
                    : "Sem data de realização"}
                  {item.atualizadoEm ? ` · Atualizado ${dataHora(item.atualizadoEm)}` : ""}
                </span>
                {podeExecutar && item.id && !item.id.startsWith("legado") ? (
                  <DialogoExecucaoDiagnostico item={item} />
                ) : null}
              </div>
            </article>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Histórico de avaliações"
          descricao="Evolução das notas a cada diagnóstico (não inclui andamento de execução)"
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">
                    Área
                  </th>
                  {diagnosticos.map((d) => (
                    <th
                      key={d.id || d.competencia}
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      {competenciaExtenso(d.competencia)}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Evolução
                  </th>
                </tr>
              </thead>
              <tbody>
                {atual.itens.map((item) => {
                  const notas = diagnosticos.map(
                    (d) =>
                      d.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0,
                  );
                  const evolucao = notas[notas.length - 1] - notas[0];
                  return (
                    <tr
                      key={item.categoria}
                      className="border-b border-border last:border-0"
                    >
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        {ROTULO_AREA[item.categoria]}
                      </th>
                      {notas.map((nota, i) => (
                        <td
                          key={diagnosticos[i].id || diagnosticos[i].competencia}
                          className="tabular px-3 py-2.5 text-right"
                        >
                          {nota}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right">
                        <Badge tom={evolucao > 0 ? "positivo" : "neutro"}>
                          {evolucao >= 0 ? "+" : ""}
                          {evolucao} pts
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Observações da consultoria" />
        <CardBody className="space-y-4">
          {[...diagnosticos].reverse().map((d) => (
            <article key={d.id || d.competencia} className="border-l-2 border-border pl-4">
              <p className="text-xs font-medium text-muted-foreground">
                {competenciaExtenso(d.competencia)}
              </p>
              <p className="mt-0.5 text-sm">{d.observacoes || "—"}</p>
            </article>
          ))}
        </CardBody>
      </Card>

      {historico.length ? (
        <Card>
          <CardHeader
            titulo="Histórico de alterações"
            descricao="Avaliações e registros de execução"
          />
          <CardBody className="space-y-3">
            {historico.slice(0, 20).map((evento) => (
              <article
                key={evento.id}
                className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                  <Clock3 className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">{evento.descricao}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {evento.tipo === "avaliacao" ? "Avaliação" : "Execução"} ·{" "}
                    {evento.autorNome} · {dataHora(evento.criadoEm)}
                  </p>
                </div>
              </article>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
