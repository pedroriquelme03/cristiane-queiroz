import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Info,
  OctagonAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { GraficoSaldo } from "@/components/graficos/grafico-saldo";
import { MiniSerie } from "@/components/graficos/mini-serie";
import { ResumoReceitasDashboard } from "@/components/financeiro/resumo-receitas-dashboard";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Progresso } from "@/components/ui/progresso";
import { cn } from "@/lib/utils";
import {
  getAlertas,
  getCompetenciaAtual,
  getDre,
  getFluxoProjetado,
  getIndicadores,
  getKpis,
  getLancamentos,
  getPlanosAcao,
  intervaloDoMes,
} from "@/lib/dados";
import {
  competenciaExtenso,
  data as formatarData,
  moeda,
  percentual,
  valorIndicador,
} from "@/lib/format";
import type { Alerta, PlanoAcao } from "@/lib/types";

const ICONE_ALERTA = {
  critico: OctagonAlert,
  atencao: AlertTriangle,
  info: Info,
} as const;

const ROTULO_STATUS: Record<PlanoAcao["status"], string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const COR_ALERTA = {
  critico: "mt-0.5 size-4 shrink-0 text-negative",
  atencao: "mt-0.5 size-4 shrink-0 text-warning",
  info: "mt-0.5 size-4 shrink-0 text-brand",
} as const;

export default async function DashboardPage({ empresaId }: { empresaId?: string }) {
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);
  const [kpis, projecao, indicadores, acoes, alertas, linhasDre, lancamentos] = await Promise.all([
    getKpis(competencia, empresaId),
    getFluxoProjetado(90, empresaId),
    getIndicadores(empresaId),
    getPlanosAcao(empresaId),
    getAlertas(empresaId),
    getDre(inicio, fim, empresaId),
    getLancamentos(inicio, fim, empresaId),
  ]);

  const acoesAtivas = acoes.filter((a) => a.status === "em_andamento");
  const concluidas = acoes.filter((a) => a.status === "concluido").length;
  const menorSaldoProjetado = projecao.length
    ? projecao.reduce(
        (menor, p) => (p.saldoProjetado < menor.saldoProjetado ? p : menor),
        projecao[0],
      )
    : null;
  const sufixoEmpresa = empresaId ? `?empresa=${encodeURIComponent(empresaId)}` : "";
  const receitaRealizada = linhasDre
    .filter((linha) => linha.tipo === "receita")
    .reduce((total, linha) => total + linha.realizado, 0);
  const receitaOrcada = linhasDre
    .filter((linha) => linha.tipo === "receita")
    .reduce((total, linha) => total + linha.previsto, 0);
  const resultadoOrcado = linhasDre.reduce((total, linha) => total + linha.previsto, 0);
  const maiorDesvio = [...linhasDre]
    .filter((linha) => linha.realizado !== 0 || linha.previsto !== 0)
    .sort((a, b) => Math.abs(b.realizado - b.previsto) - Math.abs(a.realizado - a.previsto))[0];
  const prioridades = [
    kpis.contasPagarVencidas > 0
      ? {
          titulo: "Regularizar contas vencidas",
          descricao: `${moeda(kpis.contasPagarVencidas)} em pagamentos atrasados podem gerar juros e interromper serviços.`,
          href: `/financeiro/contas-a-pagar${sufixoEmpresa}`,
          acao: "Ver contas a pagar",
        }
      : null,
    kpis.inadimplencia > 0
      ? {
          titulo: "Cobrar valores em atraso",
          descricao: `${moeda(kpis.inadimplencia)} em recebimentos pendentes merece acompanhamento imediato.`,
          href: `/financeiro/contas-a-receber${sufixoEmpresa}`,
          acao: "Ver contas a receber",
        }
      : null,
    menorSaldoProjetado && menorSaldoProjetado.saldoProjetado < 0
      ? {
          titulo: "Revisar o caixa projetado",
          descricao: `O saldo previsto chega a ${moeda(menorSaldoProjetado.saldoProjetado)} em ${formatarData(menorSaldoProjetado.data)}.`,
          href: `/financeiro/fluxo-de-caixa${sufixoEmpresa}`,
          acao: "Abrir fluxo de caixa",
        }
      : null,
  ].filter((prioridade): prioridade is NonNullable<typeof prioridade> => prioridade !== null);

  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard executivo"
        descricao={`Posição consolidada de ${competenciaExtenso(competencia)}`}
      />

      {/* KPIs — a leitura de 1 minuto */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          rotulo="Saldo em caixa"
          valor={moeda(kpis.saldoCaixa)}
          tom={kpis.saldoCaixa >= 0 ? "neutro" : "negativo"}
          nota="Posição de hoje"
          icone={<Wallet className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Faturamento do mês"
          valor={moeda(kpis.faturamentoMes)}
          nota={`Despesas de ${moeda(kpis.despesasMes)}`}
          icone={<ArrowUpCircle className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo={kpis.resultadoMes >= 0 ? "Lucro do período" : "Prejuízo do período"}
          valor={moeda(kpis.resultadoMes)}
          tom={kpis.resultadoMes >= 0 ? "positivo" : "negativo"}
          nota={`Margem de ${percentual(kpis.margemMes)}`}
          icone={
            kpis.resultadoMes >= 0 ? (
              <TrendingUp className="size-4" aria-hidden />
            ) : (
              <TrendingDown className="size-4" aria-hidden />
            )
          }
        />
        <Kpi
          rotulo="Contas a pagar"
          valor={moeda(kpis.contasPagar)}
          tom={kpis.contasPagarVencidas > 0 ? "atencao" : "neutro"}
          nota={
            kpis.contasPagarVencidas > 0
              ? `${moeda(kpis.contasPagarVencidas)} vencidos`
              : "Nenhum título vencido"
          }
          icone={<ArrowDownCircle className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Contas a receber"
          valor={moeda(kpis.contasReceber)}
          tom={kpis.inadimplencia > 0 ? "atencao" : "neutro"}
          nota={
            kpis.inadimplencia > 0
              ? `${moeda(kpis.inadimplencia)} em atraso`
              : "Sem inadimplência"
          }
          icone={<ArrowUpCircle className="size-4" aria-hidden />}
        />
      </div>

      <Card className="border-warning/30">
        <CardHeader
          titulo="Prioridades financeiras"
          descricao={
            prioridades.length
              ? "Ações que merecem atenção agora."
              : "Nenhuma pendência financeira crítica identificada para este período."
          }
        />
        {prioridades.length ? (
          <CardBody className="grid gap-3 lg:grid-cols-3">
            {prioridades.map((prioridade) => (
              <article
                key={prioridade.titulo}
                className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 p-3"
              >
                <div className="flex gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{prioridade.titulo}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {prioridade.descricao}
                    </p>
                  </div>
                </div>
                <Link
                  href={prioridade.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  {prioridade.acao}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </article>
            ))}
          </CardBody>
        ) : null}
      </Card>

      <ResumoReceitasDashboard
        linhas={linhasDre}
        lancamentos={lancamentos}
        href={`/financeiro/receitas${sufixoEmpresa}`}
      />

      <Card>
        <CardHeader
          titulo="Desempenho versus plano"
          descricao="Leitura rápida do realizado frente ao orçamento do mês."
          acao={<Link href={`/financeiro/orcamento${sufixoEmpresa}`} className="text-xs font-medium text-brand hover:underline">Abrir orçamento</Link>}
        />
        <CardBody className="grid gap-5 lg:grid-cols-3">
          <ComparativoExecutivo
            rotulo="Receita"
            realizado={receitaRealizada}
            previsto={receitaOrcada}
            favoravelMaior
          />
          <ComparativoExecutivo
            rotulo="Resultado"
            realizado={kpis.resultadoMes}
            previsto={resultadoOrcado}
            favoravelMaior
          />
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">Principal desvio</p>
            {maiorDesvio ? <><p className="mt-1 truncate text-sm font-medium">{maiorDesvio.conta}</p><p className={cn("mt-1 text-lg font-semibold tabular", maiorDesvio.realizado - maiorDesvio.previsto >= 0 ? "text-positive" : "text-negative")}>{maiorDesvio.realizado - maiorDesvio.previsto >= 0 ? "+" : ""}{moeda(maiorDesvio.realizado - maiorDesvio.previsto)}</p><p className="mt-1 text-xs text-muted-foreground">realizado vs. orçado</p></> : <p className="mt-1 text-sm text-muted-foreground">Sem movimentos no período.</p>}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Fluxo de caixa projetado"
            descricao="Saldo atual acrescido dos títulos em aberto, pelos próximos 90 dias"
            acao={
              <Link
                href={`/financeiro/fluxo-de-caixa${sufixoEmpresa}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                Ver detalhe
              </Link>
            }
          />
          <CardBody>
            <GraficoSaldo pontos={projecao} chave="saldoProjetado" />
            <p className="mt-3 text-xs text-muted-foreground">
              Menor saldo previsto:{" "}
              {menorSaldoProjetado ? (
                <>
                  <strong
                    className={
                      menorSaldoProjetado.saldoProjetado < 0
                        ? "font-medium text-negative"
                        : "font-medium text-foreground"
                    }
                  >
                    {moeda(menorSaldoProjetado.saldoProjetado)}
                  </strong>{" "}
                  em {formatarData(menorSaldoProjetado.data)}
                </>
              ) : (
                "sem projeção cadastrada"
              )}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Principais alertas"
            descricao={`${alertas.length} pontos de atenção`}
          />
          <CardBody className="space-y-3">
            {alertas.map((alerta: Alerta) => {
              const Icone = ICONE_ALERTA[alerta.severidade];
              return (
                <article key={alerta.id} className="flex gap-2.5">
                  <Icone className={COR_ALERTA[alerta.severidade]} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alerta.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {alerta.descricao}
                    </p>
                  </div>
                </article>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Evolução dos indicadores"
            descricao="Últimos 12 meses"
            acao={
              <Link
                href={`/indicadores${sufixoEmpresa}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                Ver todos
              </Link>
            }
          />
          <CardBody className="px-0 py-0">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Indicadores com valor atual, variação no período e tendência
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2 text-left font-medium">
                    Indicador
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Atual
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Variação
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Tendência
                  </th>
                </tr>
              </thead>
              <tbody>
                {indicadores.slice(0, 6).map((indicador) => {
                  const serie = indicador.valores;
                  const primeiro = serie[0]?.valor ?? 0;
                  const atual = serie[serie.length - 1]?.valor ?? 0;
                  const variacao = primeiro !== 0 ? ((atual - primeiro) / Math.abs(primeiro)) * 100 : 0;
                  const favoravel =
                    indicador.direcaoMeta === "maior_melhor"
                      ? atual > primeiro
                      : atual < primeiro;

                  return (
                    <tr
                      key={indicador.id}
                      className="border-b border-border last:border-0"
                    >
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        {indicador.nome}
                      </th>
                      <td className="tabular px-3 py-2.5 text-right font-medium">
                        {valorIndicador(atual, indicador.unidade)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge tom={favoravel ? "positivo" : "negativo"}>
                          {variacao >= 0 ? "+" : ""}
                          {percentual(variacao)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-5 pl-3">
                        <div className="flex justify-end">
                          <MiniSerie
                            valores={serie.map((v) => v.valor)}
                            positivo={favoravel}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Ações em andamento"
            descricao={`${concluidas} de ${acoes.length} ações já concluídas`}
            acao={
              <Link
                href={`/plano-de-acao${sufixoEmpresa}`}
                className="text-xs font-medium text-brand hover:underline"
              >
                Ver plano
              </Link>
            }
          />
          <CardBody className="space-y-4">
            {acoesAtivas.map((acao) => (
              <article key={acao.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-snug">{acao.acao}</p>
                  <span className="tabular shrink-0 text-xs font-medium text-muted-foreground">
                    {acao.percentual}%
                  </span>
                </div>
                <Progresso
                  valor={acao.percentual}
                  tom={acao.percentual >= 70 ? "positivo" : "marca"}
                />
                <p className="text-xs text-muted-foreground">
                  {acao.responsavel} · prazo {formatarData(acao.prazo)} ·{" "}
                  {ROTULO_STATUS[acao.status]}
                </p>
              </article>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ComparativoExecutivo({ rotulo, realizado, previsto, favoravelMaior }: { rotulo: string; realizado: number; previsto: number; favoravelMaior: boolean }) {
  const desvio = realizado - previsto;
  const favoravel = favoravelMaior ? desvio >= 0 : desvio <= 0;
  const percentualExecucao = previsto !== 0 ? (realizado / Math.abs(previsto)) * 100 : 0;
  return <div className="space-y-2"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{rotulo}</p><span className={cn("text-xs font-medium tabular", favoravel ? "text-positive" : "text-negative")}>{desvio >= 0 ? "+" : ""}{percentual(previsto !== 0 ? (desvio / Math.abs(previsto)) * 100 : null)}</span></div><p className="text-xl font-semibold tabular">{moeda(realizado)}</p><div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className={cn("h-full rounded-full", favoravel ? "bg-positive" : "bg-negative")} style={{ width: `${Math.min(Math.abs(percentualExecucao), 100)}%` }} /></div><p className="text-xs text-muted-foreground">Orçado: {moeda(previsto)} · {percentual(percentualExecucao, 0)} executado</p></div>;
}
