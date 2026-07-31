import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getCompetenciaAtual, getDre, intervaloDoMes } from "@/lib/dados";
import { competenciaExtenso, moeda, percentual } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Tolerância antes de a conta ser tratada como desvio relevante. */
const TOLERANCIA = 0.1;

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa } = await searchParams;
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);
  const linhas = (await getDre(inicio, fim, empresaId)).filter(
    (l) => l.realizado !== 0 || l.previsto !== 0,
  );

  const receitas = linhas.filter((l) => l.tipo === "receita");
  const gastos = linhas.filter((l) => l.tipo !== "receita");

  const totalPrevisto = linhas.reduce((s, l) => s + l.previsto, 0);
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);

  /**
   * Um desvio é favorável quando sobra dinheiro: receita acima do previsto ou
   * gasto abaixo. Como os gastos vêm negativos, a conta é a mesma nos dois casos.
   */
  const desvios = linhas
    .map((l) => ({
      ...l,
      desvio: l.realizado - l.previsto,
      desvioRelativo:
        l.previsto !== 0 ? ((l.realizado - l.previsto) / Math.abs(l.previsto)) * 100 : 0,
    }))
    .filter((l) => Math.abs(l.desvioRelativo) > TOLERANCIA * 100)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

  const maiorEscala = Math.max(
    ...linhas.map((l) => Math.max(Math.abs(l.previsto), Math.abs(l.realizado))),
    1,
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Resultado orçado" valor={moeda(totalPrevisto)} />
        <Kpi
          rotulo="Resultado realizado"
          valor={moeda(totalRealizado)}
          tom={totalRealizado >= 0 ? "positivo" : "negativo"}
        />
        <Kpi
          rotulo="Desvio total"
          valor={moeda(totalRealizado - totalPrevisto)}
          tom={totalRealizado >= totalPrevisto ? "positivo" : "negativo"}
          nota={percentual(
            totalPrevisto !== 0
              ? ((totalRealizado - totalPrevisto) / Math.abs(totalPrevisto)) * 100
              : null,
          )}
        />
        <Kpi
          rotulo="Contas fora da tolerância"
          valor={String(desvios.length)}
          tom={desvios.length > 3 ? "atencao" : "neutro"}
          nota={`Tolerância de ${percentual(TOLERANCIA * 100, 0)}`}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Maiores desvios"
          descricao={`Contas que fugiram mais de ${percentual(TOLERANCIA * 100, 0)} do orçado em ${competenciaExtenso(competencia)}`}
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Conta</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Orçado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Realizado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Desvio</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {desvios.map((linha) => {
                  const favoravel = linha.desvio > 0;
                  return (
                    <tr key={linha.planoContaId} className="border-b border-border last:border-0">
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        <span className="tabular text-xs text-muted-foreground">
                          {linha.codigo}
                        </span>{" "}
                        {linha.conta}
                      </th>
                      <td className="tabular px-3 py-2.5 text-right text-muted-foreground">
                        {moeda(linha.previsto)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-medium">
                        {moeda(linha.realizado)}
                      </td>
                      <td
                        className={cn(
                          "tabular px-3 py-2.5 text-right font-medium",
                          favoravel ? "text-positive" : "text-negative",
                        )}
                      >
                        {linha.desvio > 0 ? "+" : ""}
                        {moeda(linha.desvio)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Badge tom={favoravel ? "positivo" : "negativo"}>
                          {favoravel ? "Favorável" : "Desfavorável"}{" "}
                          {percentual(Math.abs(linha.desvioRelativo), 0)}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <ComparativoCard
          titulo="Receitas: previsto x realizado"
          linhas={receitas}
          escala={maiorEscala}
        />
        <ComparativoCard
          titulo="Custos e despesas: previsto x realizado"
          linhas={gastos}
          escala={maiorEscala}
        />
      </div>
    </>
  );
}

/**
 * Barras pareadas em HTML. Duas séries, então há legenda; cada barra também
 * carrega o valor em texto, o que dispensa depender só da cor.
 */
function ComparativoCard({
  titulo,
  linhas,
  escala,
}: {
  titulo: string;
  linhas: { planoContaId: string; conta: string; previsto: number; realizado: number }[];
  escala: number;
}) {
  return (
    <Card>
      <CardHeader titulo={titulo} />
      <CardBody className="space-y-4">
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--eixo)]" />
            Orçado
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--serie-saldo)]" />
            Realizado
          </li>
        </ul>

        {linhas.map((linha) => (
          <div key={linha.planoContaId} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{linha.conta}</span>
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {moeda(linha.realizado)} de {moeda(linha.previsto)}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="h-1.5 w-full rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-[var(--eixo)]"
                  style={{ width: `${(Math.abs(linha.previsto) / escala) * 100}%` }}
                />
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-[var(--serie-saldo)]"
                  style={{ width: `${(Math.abs(linha.realizado) / escala) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
