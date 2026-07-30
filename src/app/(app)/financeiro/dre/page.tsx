import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getCompetenciaAtual, getDre, intervaloDoMes } from "@/lib/dados";
import { competenciaExtenso, moeda, percentual } from "@/lib/format";
import type { GrupoDre, LinhaDre } from "@/lib/types";
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
  {
    tipo: "subtotal",
    rotulo: "= Resultado do período",
    ate: [
      "receita_bruta", "deducoes", "custo_variavel", "despesa_pessoal",
      "despesa_administrativa", "despesa_comercial", "despesa_financeira",
      "investimento", "nao_operacional",
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
  const linhas = await getDre(inicio, fim, empresaId);

  const porGrupo = (grupo: GrupoDre) =>
    linhas.filter((l) => l.grupoDre === grupo && (l.realizado !== 0 || l.previsto !== 0));

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
          descricao={`Realizado x orçado de ${competenciaExtenso(competencia)}. AV = participação na receita bruta.`}
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
                    <RegistrosGrupo
                      key={bloco.grupo}
                      titulo={NOME_GRUPO[bloco.grupo]}
                      contas={contas}
                      av={av}
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

function RegistrosGrupo({
  titulo,
  contas,
  av,
}: {
  titulo: string;
  contas: LinhaDre[];
  av: (valor: number) => number;
}) {
  const totalReal = contas.reduce((s, c) => s + c.realizado, 0);
  const totalPrev = contas.reduce((s, c) => s + c.previsto, 0);

  return (
    <>
      <tr className="border-b border-border bg-surface">
        <th scope="rowgroup" className="px-5 pt-4 pb-2 text-left text-xs font-semibold tracking-wide uppercase">
          {titulo}
        </th>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm font-semibold">
          {moeda(totalReal)}
        </td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-xs text-muted-foreground">
          {percentual(av(totalReal))}
        </td>
        <td className="tabular px-3 pt-4 pb-2 text-right text-sm text-muted-foreground">
          {moeda(totalPrev)}
        </td>
        <td className="tabular px-5 pt-4 pb-2 text-right text-sm">
          {moeda(totalReal - totalPrev)}
        </td>
      </tr>
      {contas.map((conta) => {
        const desvio = conta.realizado - conta.previsto;
        return (
          <tr key={conta.planoContaId} className="border-b border-border last:border-0">
            <th scope="row" className="py-2 pr-3 pl-9 text-left font-normal">
              <span className="tabular text-xs text-muted-foreground">{conta.codigo}</span>{" "}
              {conta.conta}
            </th>
            <td className="tabular px-3 py-2 text-right">{moeda(conta.realizado)}</td>
            <td className="tabular px-3 py-2 text-right text-muted-foreground">
              {percentual(av(conta.realizado))}
            </td>
            <td className="tabular px-3 py-2 text-right text-muted-foreground">
              {moeda(conta.previsto)}
            </td>
            <td
              className={cn(
                "tabular px-5 py-2 text-right",
                Math.abs(desvio) > Math.abs(conta.previsto) * 0.1 && desvio !== 0
                  ? "font-medium text-warning"
                  : "text-muted-foreground",
              )}
            >
              {moeda(desvio)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
