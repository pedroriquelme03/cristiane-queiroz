import { GraficoMovimento } from "@/components/graficos/grafico-movimento";
import { GraficoSaldo } from "@/components/graficos/grafico-saldo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import {
  getCompetenciaAtual,
  getFluxoDiario,
  getFluxoProjetado,
  getLancamentos,
  getPlanoContas,
  intervaloDoMes,
} from "@/lib/dados";
import { competenciaExtenso, data as formatarData, moeda } from "@/lib/format";

export default async function FluxoDeCaixaPage() {
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);

  const [fluxo, projecao, lancamentos, contas] = await Promise.all([
    getFluxoDiario(inicio, fim),
    getFluxoProjetado(90),
    getLancamentos(inicio, fim),
    getPlanoContas(),
  ]);

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.nome ?? "Sem classificação";

  const entradas = fluxo.reduce((s, p) => s + p.entradas, 0);
  const saidas = fluxo.reduce((s, p) => s + p.saidas, 0);
  const saldoFinal = fluxo[fluxo.length - 1]?.saldoAcumulado ?? 0;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Entradas no mês" valor={moeda(entradas)} tom="positivo" />
        <Kpi rotulo="Saídas no mês" valor={moeda(saidas)} tom="negativo" />
        <Kpi
          rotulo="Resultado de caixa"
          valor={moeda(entradas - saidas)}
          tom={entradas - saidas >= 0 ? "positivo" : "negativo"}
        />
        <Kpi rotulo="Saldo ao fim do período" valor={moeda(saldoFinal)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Entradas e saídas"
            descricao={`Movimento diário de ${competenciaExtenso(competencia)}`}
          />
          <CardBody>
            <GraficoMovimento pontos={fluxo} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Saldo diário"
            descricao="Saldo acumulado ao longo do mês"
          />
          <CardBody>
            <GraficoSaldo pontos={fluxo} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          titulo="Projeção de caixa"
          descricao="Próximos 90 dias, considerando os títulos em aberto"
        />
        <CardBody>
          <GraficoSaldo pontos={projecao} chave="saldoProjetado" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Lançamentos do período"
          descricao={`${lancamentos.length} movimentações em ${competenciaExtenso(competencia)}`}
        />
        <CardBody className="px-0 py-0">
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Data</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Descrição</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Classificação</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Contraparte</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="tabular px-5 py-2.5 whitespace-nowrap">
                      {formatarData(l.data)}
                    </td>
                    <td className="px-3 py-2.5">{l.descricao}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {nomeConta(l.planoContaId)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {l.contraparte ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={
                          l.tipo === "entrada"
                            ? "tabular font-medium text-positive"
                            : "tabular font-medium text-negative"
                        }
                      >
                        {l.tipo === "entrada" ? "+" : "−"}
                        {moeda(l.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
