import {
  DialogoLancamento,
  ExcluirLancamento,
} from "@/components/financeiro/dialogo-lancamento";
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
  getPrevistoPeriodo,
  intervaloDoMes,
  saldoEmCaixa,
} from "@/lib/dados";
import { competenciaExtenso, data as formatarData, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";

export default async function FluxoDeCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa }, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const podeEditar = Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);

  const [fluxo, projecao, lancamentos, contas, previsto] = await Promise.all([
    getFluxoDiario(inicio, fim, empresaIdAtiva),
    getFluxoProjetado(90, empresaIdAtiva),
    getLancamentos(inicio, fim, empresaIdAtiva),
    getPlanoContas(empresaIdAtiva),
    getPrevistoPeriodo(inicio, fim, empresaIdAtiva),
  ]);

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.nome ?? "Sem classificação";

  const entradasRealizadas = fluxo.reduce((s, p) => s + p.entradas, 0);
  const saidasRealizadas = fluxo.reduce((s, p) => s + p.saidas, 0);
  const entradas = entradasRealizadas + previsto.aReceber;
  const saidas = saidasRealizadas + previsto.aPagar;
  const resultado = entradas - saidas;

  const saldoRealizado = fluxo.length
    ? fluxo[fluxo.length - 1].saldoAcumulado
    : empresaIdAtiva
      ? await saldoEmCaixa(empresaIdAtiva, fim)
      : 0;
  const saldoFinal = saldoRealizado + previsto.aReceber - previsto.aPagar;

  const notaRealizadoPrevisto = (realizado: number, previstoValor: number, rotuloPrevisto: string) => {
    if (realizado <= 0 && previstoValor <= 0) return undefined;
    if (realizado <= 0) return `${moeda(previstoValor)} ${rotuloPrevisto}`;
    if (previstoValor <= 0) return `${moeda(realizado)} realizadas`;
    return `${moeda(realizado)} realizadas · ${moeda(previstoValor)} ${rotuloPrevisto}`;
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Entradas no mês"
          valor={moeda(entradas)}
          tom="positivo"
          nota={notaRealizadoPrevisto(entradasRealizadas, previsto.aReceber, "a receber")}
        />
        <Kpi
          rotulo="Saídas no mês"
          valor={moeda(saidas)}
          tom="negativo"
          nota={notaRealizadoPrevisto(saidasRealizadas, previsto.aPagar, "a pagar")}
        />
        <Kpi
          rotulo="Resultado de caixa"
          valor={moeda(resultado)}
          tom={resultado >= 0 ? "positivo" : "negativo"}
          nota={
            previsto.aReceber || previsto.aPagar
              ? "Realizado + títulos com vencimento no mês"
              : undefined
          }
        />
        <Kpi
          rotulo="Saldo ao fim do período"
          valor={moeda(saldoFinal)}
          nota={
            previsto.aReceber || previsto.aPagar
              ? `${moeda(saldoRealizado)} realizado + previsto`
              : undefined
          }
        />
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
          acao={podeEditar ? <DialogoLancamento contas={contas} empresaId={empresaIdAtiva} /> : null}
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
                  {podeEditar ? <th scope="col" className="px-5 py-2.5 text-right font-medium">Ações</th> : null}
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
                    {podeEditar && empresaIdAtiva ? (
                      <td className="px-5 py-2.5">
                        {l.origem === "manual" ? (
                          <div className="flex items-center justify-end gap-3">
                            <DialogoLancamento contas={contas} empresaId={empresaIdAtiva} lancamento={l} />
                            <ExcluirLancamento lancamento={l} empresaId={empresaIdAtiva} />
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">Baixa automática</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {lancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={podeEditar ? 6 : 5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Nenhum lançamento no período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
