import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkGerarRelatorio } from "@/components/relatorios/link-gerar-relatorio";
import { Kpi } from "@/components/ui/kpi";
import { RegistrosGrupoInterativos } from "@/components/financeiro/dre-interativa";
import { getCompetenciaAtual, getDre, getMovimentosDre, intervaloDoMes } from "@/lib/dados";
import { competenciaExtenso, moeda, percentual } from "@/lib/format";
import type { GrupoDre } from "@/lib/types";
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
  const [linhas, movimentos] = await Promise.all([
    getDre(inicio, fim, empresaId),
    getMovimentosDre(inicio, fim, empresaId),
  ]);

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

      <Card>
        <CardHeader
          titulo="DRE gerencial"
          descricao={`Linhas = Classificações de Cadastros. Realizado x orçado de ${competenciaExtenso(competencia)}. Realizado pela data de emissão. AV = participação na receita bruta.`}
          acao={<LinkGerarRelatorio href="/financeiro/relatorios/dre" empresaId={empresaId} />}
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
    </>
  );
}
