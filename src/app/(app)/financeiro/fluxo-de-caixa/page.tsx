import {
  DialogoLancamento,
  ExcluirLancamento,
} from "@/components/financeiro/dialogo-lancamento";
import { FiltroMesFluxo } from "@/components/financeiro/filtro-mes-fluxo";
import { GraficoMovimento } from "@/components/graficos/grafico-movimento";
import { GraficoSaldo } from "@/components/graficos/grafico-saldo";
import { Badge } from "@/components/ui/badge";
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
  listarCompetenciasOpcoes,
  mesclarTitulosNoFluxo,
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
  const [competencia, opcoesCompetencia] = await Promise.all([
    getCompetenciaAtual(),
    listarCompetenciasOpcoes(empresaIdAtiva),
  ]);
  const { inicio, fim } = intervaloDoMes(competencia);

  if (sessao.role === "admin" && !empresaIdAtiva) {
    return (
      <>
        <FiltroMesFluxo competencia={competencia} opcoes={opcoesCompetencia} />
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma empresa no topo para ver o fluxo de caixa.
          </CardBody>
        </Card>
      </>
    );
  }

  const diaAnterior = (() => {
    const [ano, mes, dia] = inicio.split("-").map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia - 1));
    return d.toISOString().slice(0, 10);
  })();

  const [fluxoRealizado, projecao, lancamentos, contas, previsto, saldoInicial] = await Promise.all([
    getFluxoDiario(inicio, fim, empresaIdAtiva),
    getFluxoProjetado(90, empresaIdAtiva),
    getLancamentos(inicio, fim, empresaIdAtiva),
    getPlanoContas(empresaIdAtiva),
    getPrevistoPeriodo(inicio, fim, empresaIdAtiva),
    empresaIdAtiva ? saldoEmCaixa(empresaIdAtiva, diaAnterior) : Promise.resolve(0),
  ]);

  // Inclui parcelas de contas fixas (e demais títulos) no dia do vencimento.
  const fluxo = mesclarTitulosNoFluxo(
    fluxoRealizado,
    previsto.titulosNoMes.map((titulo) => ({
      vencimento: titulo.vencimento,
      tipo: titulo.tipo,
      saldo: titulo.saldo,
    })),
    saldoInicial,
  );

  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.nome ?? "Sem classificação";

  const entradasRealizadas = lancamentos
    .filter((item) => item.tipo === "entrada")
    .reduce((soma, item) => soma + item.valor, 0);
  const saidasRealizadas = lancamentos
    .filter((item) => item.tipo === "saida")
    .reduce((soma, item) => soma + item.valor, 0);

  // KPIs do mês: realizado + títulos com vencimento neste mês (ex.: parcela da conta fixa).
  const entradas = entradasRealizadas + previsto.aReceber;
  const saidas = saidasRealizadas + previsto.aPagar;
  const resultado = entradas - saidas;

  const saldoRealizado = fluxoRealizado.length
    ? fluxoRealizado[fluxoRealizado.length - 1].saldoAcumulado
    : saldoInicial;
  const saldoFinal = saldoRealizado + previsto.aReceber - previsto.aPagar;

  const contasFixasNoMes = previsto.titulosNoMes.filter(
    (titulo) => titulo.fixa && titulo.tipo === "pagar",
  );
  const recebimentosFixosNoMes = previsto.titulosNoMes.filter(
    (titulo) => titulo.fixa && titulo.tipo === "receber",
  );
  const totalFixasPagar = contasFixasNoMes.reduce((soma, titulo) => soma + titulo.saldo, 0);
  const totalFixasReceber = recebimentosFixosNoMes.reduce((soma, titulo) => soma + titulo.saldo, 0);

  const notaRealizadoPrevisto = (
    realizado: number,
    previstoValor: number,
    rotuloPrevisto: string,
    destaqueFixo?: number,
    rotuloFixo?: string,
  ) => {
    if (realizado <= 0 && previstoValor <= 0) return undefined;
    const partes: string[] = [];
    if (realizado > 0) partes.push(`${moeda(realizado)} realizadas`);
    if (previstoValor > 0) partes.push(`${moeda(previstoValor)} ${rotuloPrevisto}`);
    if (destaqueFixo && destaqueFixo > 0 && rotuloFixo) {
      partes.push(`inclui ${moeda(destaqueFixo)} em ${rotuloFixo}`);
    }
    return partes.join(" · ");
  };

  return (
    <>
      <FiltroMesFluxo competencia={competencia} opcoes={opcoesCompetencia} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Entradas no mês"
          valor={moeda(entradas)}
          tom="positivo"
          nota={notaRealizadoPrevisto(
            entradasRealizadas,
            previsto.aReceber,
            "a receber no vencimento",
            totalFixasReceber,
            "recebimentos fixos",
          )}
        />
        <Kpi
          rotulo="Saídas no mês"
          valor={moeda(saidas)}
          tom="negativo"
          nota={notaRealizadoPrevisto(
            saidasRealizadas,
            previsto.aPagar,
            "a pagar no vencimento",
            totalFixasPagar,
            "contas fixas",
          )}
        />
        <Kpi
          rotulo="Resultado de caixa"
          valor={moeda(resultado)}
          tom={resultado >= 0 ? "positivo" : "negativo"}
          nota={
            previsto.aReceber || previsto.aPagar
              ? "Realizado + títulos com vencimento no mês (contas e recebimentos fixos)"
              : undefined
          }
        />
        <Kpi
          rotulo="Saldo ao fim do período"
          valor={moeda(saldoFinal)}
          nota={
            previsto.aReceber || previsto.aPagar
              ? `${moeda(saldoRealizado)} realizado + previsto do mês`
              : undefined
          }
        />
      </div>

      {recebimentosFixosNoMes.length ? (
        <TabelaRecorrentesMes
          titulo="Recebimentos fixos no mês"
          descricao={`${recebimentosFixosNoMes.length} parcela${recebimentosFixosNoMes.length === 1 ? "" : "s"} a receber com vencimento em ${competenciaExtenso(competencia)}`}
          itens={recebimentosFixosNoMes}
          total={totalFixasReceber}
          tomTotal="positivo"
          rotuloTotal="Total dos recebimentos fixos no mês"
        />
      ) : null}

      {contasFixasNoMes.length ? (
        <TabelaRecorrentesMes
          titulo="Contas fixas no mês"
          descricao={`${contasFixasNoMes.length} parcela${contasFixasNoMes.length === 1 ? "" : "s"} a pagar com vencimento em ${competenciaExtenso(competencia)}`}
          itens={contasFixasNoMes}
          total={totalFixasPagar}
          tomTotal="negativo"
          rotuloTotal="Total das contas fixas no mês"
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Entradas e saídas"
            descricao={`Movimento diário de ${competenciaExtenso(competencia)} (realizado + vencimentos do mês)`}
          />
          <CardBody>
            <GraficoMovimento pontos={fluxo} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Saldo diário"
            descricao="Saldo acumulado ao longo do mês, com títulos no vencimento"
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
          descricao={`${lancamentos.length} movimentações realizadas em ${competenciaExtenso(competencia)}`}
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
                      Nenhuma movimentação realizada no período.
                      {previsto.titulosNoMes.length
                        ? " Contas e recebimentos com vencimento no mês já entram nos KPIs e nos gráficos acima."
                        : null}
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

function TabelaRecorrentesMes({
  titulo,
  descricao,
  itens,
  total,
  tomTotal,
  rotuloTotal,
}: {
  titulo: string;
  descricao: string;
  itens: Array<{
    id: string;
    vencimento: string;
    contraparte: string;
    tipo: "pagar" | "receber";
    saldo: number;
  }>;
  total: number;
  tomTotal: "positivo" | "negativo";
  rotuloTotal: string;
}) {
  const positivo = tomTotal === "positivo";
  return (
    <Card>
      <CardHeader titulo={titulo} descricao={descricao} />
      <CardBody className="px-0 py-0">
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 text-left font-medium">Vencimento</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Cliente / descrição</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Valor do mês</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((tituloItem) => (
                <tr key={tituloItem.id} className="border-b border-border last:border-0">
                  <td className="tabular px-5 py-2.5 whitespace-nowrap">
                    {formatarData(tituloItem.vencimento)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      {tituloItem.contraparte}
                      <Badge tom={positivo ? "positivo" : "neutro"}>
                        {positivo ? "Recebimento fixo" : "Conta fixa"}
                      </Badge>
                    </span>
                  </td>
                  <td
                    className={
                      positivo
                        ? "tabular px-5 py-2.5 text-right font-medium text-positive"
                        : "tabular px-5 py-2.5 text-right font-medium text-negative"
                    }
                  >
                    {positivo ? "+" : "−"}
                    {moeda(tituloItem.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-muted/40 text-sm">
                <td colSpan={2} className="px-5 py-2.5 font-medium">
                  {rotuloTotal}
                </td>
                <td
                  className={
                    positivo
                      ? "tabular px-5 py-2.5 text-right font-medium text-positive"
                      : "tabular px-5 py-2.5 text-right font-medium text-negative"
                  }
                >
                  {positivo ? "+" : "−"}
                  {moeda(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
