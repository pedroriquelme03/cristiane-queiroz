import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkGerarRelatorio } from "@/components/relatorios/link-gerar-relatorio";
import { Badge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import { RegistrosGrupoInterativos } from "@/components/financeiro/dre-interativa";
import {
  conferirRealizadoDre,
  getCompetenciaAtual,
  getDre,
  getLancamentosForaDaDre,
  getMovimentosDre,
  intervaloDoMes,
} from "@/lib/dados";
import { competenciaExtenso, data as formatarData, moeda, percentual } from "@/lib/format";
import type { GrupoDre, ItemForaDre } from "@/lib/types";
import { cn } from "@/lib/utils";

const NOME_GRUPO: Record<GrupoDre, string> = {
  receita_bruta: "Receita bruta",
  deducoes: "(−) Deduções sobre a receita",
  custo_variavel: "(−) Custos variáveis",
  despesa_pessoal: "(−) Despesas com pessoal",
  despesa_administrativa: "(−) Despesas administrativas",
  despesa_comercial: "(−) Despesas comerciais",
  despesa_financeira: "(−) Despesas financeiras",
  investimento: "(−) Investimentos",
  nao_operacional: "Resultado não operacional",
  outros: "Outros",
};

const ROTULO_MOTIVO: Record<ItemForaDre["motivo"], string> = {
  baixa_titulo: "Baixa de título (só caixa)",
  sem_classificacao: "Sem classificação",
  marcado_sem_dre: "Marcado sem impacto na DRE",
};

/** Ordem de apresentação e onde entram os subtotais. */
const ESTRUTURA: (
  | { tipo: "grupo"; grupo: GrupoDre }
  | { tipo: "subtotal"; rotulo: string; ate: GrupoDre[] }
)[] = [
  { tipo: "grupo", grupo: "receita_bruta" },
  { tipo: "grupo", grupo: "deducoes" },
  { tipo: "subtotal", rotulo: "= Receita líquida", ate: ["receita_bruta", "deducoes"] },
  { tipo: "grupo", grupo: "custo_variavel" },
  {
    tipo: "subtotal",
    rotulo: "= Margem de contribuição",
    ate: ["receita_bruta", "deducoes", "custo_variavel"],
  },
  { tipo: "grupo", grupo: "despesa_pessoal" },
  { tipo: "grupo", grupo: "despesa_administrativa" },
  { tipo: "grupo", grupo: "despesa_comercial" },
  { tipo: "grupo", grupo: "despesa_financeira" },
  {
    tipo: "subtotal",
    rotulo: "= Resultado operacional",
    ate: [
      "receita_bruta", "deducoes", "custo_variavel", "despesa_pessoal",
      "despesa_administrativa", "despesa_comercial", "despesa_financeira",
    ],
  },
  { tipo: "grupo", grupo: "investimento" },
  { tipo: "grupo", grupo: "nao_operacional" },
  { tipo: "grupo", grupo: "outros" },
  {
    tipo: "subtotal",
    rotulo: "= Resultado do período",
    ate: [
      "receita_bruta", "deducoes", "custo_variavel", "despesa_pessoal",
      "despesa_administrativa", "despesa_comercial", "despesa_financeira",
      "investimento", "nao_operacional", "outros",
    ],
  },
];

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa } = await searchParams;
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);
  const [linhas, movimentos, foraDaDre] = await Promise.all([
    getDre(inicio, fim, empresaId),
    getMovimentosDre(inicio, fim, empresaId),
    getLancamentosForaDaDre(inicio, fim, empresaId),
  ]);
  const conferencia = conferirRealizadoDre(linhas, movimentos);

  const porGrupo = (grupo: GrupoDre) =>
    linhas.filter((l) => l.grupoDre === grupo);

  const somar = (grupos: GrupoDre[], campo: "realizado" | "previsto") =>
    linhas
      .filter((l) => grupos.includes(l.grupoDre))
      .reduce((s, l) => s + l[campo], 0);

  const receitaBruta = somar(["receita_bruta"], "realizado");
  const resultado = somar(
    ESTRUTURA[ESTRUTURA.length - 1].tipo === "subtotal"
      ? (ESTRUTURA[ESTRUTURA.length - 1] as { ate: GrupoDre[] }).ate
      : [],
    "realizado",
  );
  const margemContribuicao = somar(
    ["receita_bruta", "deducoes", "custo_variavel"],
    "realizado",
  );

  /** Análise vertical: quanto a linha representa da receita bruta. */
  const av = (valor: number) =>
    receitaBruta !== 0 ? (Math.abs(valor) / receitaBruta) * 100 : 0;

  const baixas = foraDaDre.filter((item) => item.motivo === "baixa_titulo");
  const outrosFora = foraDaDre.filter((item) => item.motivo !== "baixa_titulo");

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Receita bruta" valor={moeda(receitaBruta)} />
        <Kpi
          rotulo="Margem de contribuição"
          valor={moeda(margemContribuicao)}
          nota={percentual(av(margemContribuicao)) + " da receita"}
        />
        <Kpi
          rotulo="Resultado do período"
          valor={moeda(resultado)}
          tom={resultado >= 0 ? "positivo" : "negativo"}
        />
        <Kpi
          rotulo="Margem líquida"
          valor={percentual(receitaBruta ? (resultado / receitaBruta) * 100 : null)}
          tom={resultado >= 0 ? "positivo" : "negativo"}
        />
      </div>

      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">Regra da DRE · regime de competência</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>
              <strong className="font-medium text-foreground">Títulos</strong> entram pela{" "}
              <strong className="font-medium text-foreground">data de emissão</strong>{" "}
              (se vazia, usa o vencimento), com classificação e “impacta DRE”.
            </li>
            <li>
              <strong className="font-medium text-foreground">Lançamentos manuais/importados</strong>{" "}
              entram pela <strong className="font-medium text-foreground">data do lançamento</strong>,
              com classificação e “impacta DRE”.
            </li>
            <li>
              <strong className="font-medium text-foreground">Baixas (pagamentos)</strong>{" "}
              <em>não</em> entram na DRE — evitam duplicar o título. Elas vão só para o fluxo de
              caixa na data do pagamento.
            </li>
          </ul>
        </div>
      </div>

      <div
        className={
          conferencia.conferido
            ? "flex flex-wrap items-center gap-2 rounded-xl border border-positive/30 bg-positive/5 px-4 py-3 text-sm"
            : "flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm"
        }
      >
        {conferencia.conferido ? (
          <CheckCircle2 className="size-4 shrink-0 text-positive" aria-hidden />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
        )}
        <span className="font-medium">
          {conferencia.conferido
            ? "Totais conferidos com os lançamentos de origem"
            : "Divergência entre linhas e movimentos de origem"}
        </span>
        <span className="text-muted-foreground">
          Linhas {moeda(conferencia.realizadoLinhas)} · movimentos{" "}
          {moeda(conferencia.realizadoMovimentos)}
          {conferencia.divergenciasPorConta.length
            ? ` · ${conferencia.divergenciasPorConta.length} conta(s) divergente(s)`
            : null}
        </span>
        <Badge tom={conferencia.conferido ? "positivo" : "atencao"}>
          {movimentos.length} origem{movimentos.length === 1 ? "" : "ns"}
        </Badge>
      </div>

      <Card>
        <CardHeader
          titulo="DRE gerencial"
          descricao={`Linhas = Classificações. Realizado × orçado de ${competenciaExtenso(competencia)}. Competência (não caixa). AV = participação na receita bruta. Orçado vem dos valores cadastrados em Financeiro → Orçamento.`}
          acao={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={
                  empresaId
                    ? `/financeiro/orcamento?empresa=${encodeURIComponent(empresaId)}`
                    : "/financeiro/orcamento"
                }
                className="text-xs font-medium text-brand hover:underline"
              >
                {linhas.reduce((s, l) => s + Math.abs(l.previsto), 0) === 0
                  ? "Cadastrar orçado"
                  : "Editar orçamento"}
              </Link>
              <LinkGerarRelatorio href="/financeiro/relatorios/dre" empresaId={empresaId} />
            </div>
          }
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Conta</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Realizado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">AV %</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Orçado</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma classificação cadastrada. Cadastre em Cadastros → Classificações para montar as linhas do DRE.
                    </td>
                  </tr>
                ) : null}
                {ESTRUTURA.map((bloco, i) => {
                  if (bloco.tipo === "subtotal") {
                    const real = somar(bloco.ate, "realizado");
                    const prev = somar(bloco.ate, "previsto");
                    return (
                      <tr
                        key={`sub-${i}`}
                        className="border-y-2 border-border bg-surface-muted font-semibold"
                      >
                        <th scope="row" className="px-5 py-2.5 text-left">
                          {bloco.rotulo}
                        </th>
                        <td
                          className={cn(
                            "tabular px-3 py-2.5 text-right",
                            real < 0 && "text-negative",
                          )}
                        >
                          {moeda(real)}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-muted-foreground">
                          {percentual(av(real))}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right font-normal text-muted-foreground">
                          {moeda(prev)}
                        </td>
                        <td className="tabular px-5 py-2.5 text-right">
                          {moeda(real - prev)}
                        </td>
                      </tr>
                    );
                  }

                  const contas = porGrupo(bloco.grupo);
                  if (contas.length === 0) return null;

                  return (
                    <RegistrosGrupoInterativos
                      key={bloco.grupo}
                      titulo={NOME_GRUPO[bloco.grupo]}
                      contas={contas}
                      movimentos={movimentos}
                      receitaBruta={receitaBruta}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {foraDaDre.length > 0 ? (
        <Card>
          <CardHeader
            titulo="No fluxo de caixa, fora da DRE"
            descricao={`${foraDaDre.length} lançamento${foraDaDre.length === 1 ? "" : "s"} com impacto no caixa neste mês que não entram na DRE — de propósito, não por falha de soma. Pagamentos de título já estão na DRE pela emissão do título.`}
          />
          <CardBody className="px-0 py-0">
            <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3 text-xs">
              {baixas.length ? (
                <Badge tom="neutro">{baixas.length} baixa{baixas.length === 1 ? "" : "s"}</Badge>
              ) : null}
              {outrosFora.filter((i) => i.motivo === "sem_classificacao").length ? (
                <Badge tom="atencao">
                  {outrosFora.filter((i) => i.motivo === "sem_classificacao").length} sem
                  classificação
                </Badge>
              ) : null}
              {outrosFora.filter((i) => i.motivo === "marcado_sem_dre").length ? (
                <Badge tom="neutro">
                  {outrosFora.filter((i) => i.motivo === "marcado_sem_dre").length} só caixa
                </Badge>
              ) : null}
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Descrição
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Motivo
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {foraDaDre.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="tabular px-5 py-2.5 whitespace-nowrap">
                        {formatarData(item.data)}
                      </td>
                      <td className="px-3 py-2.5">{item.descricao}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {ROTULO_MOTIVO[item.motivo]}
                      </td>
                      <td
                        className={cn(
                          "tabular px-5 py-2.5 text-right font-medium",
                          item.tipo === "entrada" ? "text-positive" : "text-negative",
                        )}
                      >
                        {item.tipo === "entrada" ? "+" : "−"}
                        {moeda(item.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
