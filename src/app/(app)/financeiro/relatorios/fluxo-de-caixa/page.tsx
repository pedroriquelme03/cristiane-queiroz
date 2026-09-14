import { FiltrosRelatorioForm } from "@/components/relatorios/filtros-relatorio";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { getFluxoDiario, getLancamentos, getPlanoContas, getTitulos } from "@/lib/dados";
import { moeda } from "@/lib/format";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { comEmpresa, textoResumoFiltros } from "@/lib/relatorios/filtros";
import { filtrarLancamentos, filtrarTitulos, rotuloSituacaoTitulo } from "@/lib/relatorios/titulos";

function diasEntre(inicio: string, fim: string) {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export default async function RelatorioFluxoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresaId, filtros, intervalo } = await carregarContextoRelatorio(searchParams);
  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const incluirFluxoDiario = diasEntre(intervalo.inicio, intervalo.fim) <= 400;
  const [pagar, receber, contas, lancamentos, fluxo] = await Promise.all([
    getTitulos("pagar", empresaId),
    getTitulos("receber", empresaId),
    getPlanoContas(empresaId),
    getLancamentos(intervalo.inicio, intervalo.fim, empresaId),
    incluirFluxoDiario ? getFluxoDiario(intervalo.inicio, intervalo.fim, empresaId) : Promise.resolve([]),
  ]);

  const titulos = filtrarTitulos([...pagar, ...receber], filtros, intervalo);
  const movimentos = filtrarLancamentos(lancamentos, filtros, intervalo);
  const nomeConta = (id: string | null) =>
    id ? (contas.find((conta) => conta.id === id)?.nome ?? "—") : "Sem classificação";

  const entradas = fluxo.reduce((soma, ponto) => soma + ponto.entradas, 0)
    || movimentos.filter((item) => item.tipo === "entrada").reduce((soma, item) => soma + item.valor, 0);
  const saidas = fluxo.reduce((soma, ponto) => soma + ponto.saidas, 0)
    || movimentos.filter((item) => item.tipo === "saida").reduce((soma, item) => soma + item.valor, 0);
  const saldoFinal = fluxo.length
    ? fluxo[fluxo.length - 1].saldoAcumulado
    : entradas - saidas;

  return (
    <PainelRelatorio
      titulo="Relatório de fluxo de caixa"
      descricao="Movimento diário, lançamentos realizados e títulos no período filtrado."
      voltarHref={comEmpresa("/financeiro/relatorios", empresaId)}
      resumoFiltros={textoResumoFiltros(filtros, intervalo, contas)}
      nomeArquivo="relatorio-fluxo-de-caixa"
      filtros={
        <FiltrosRelatorioForm
          action="/financeiro/relatorios/fluxo-de-caixa"
          filtros={filtros}
          contas={contas}
          empresaId={empresaId}
          mostrarTipo
        />
      }
      kpis={[
        { rotulo: "Entradas", valor: moeda(entradas), tom: "positivo" },
        { rotulo: "Saídas", valor: moeda(saidas), tom: "negativo" },
        {
          rotulo: "Resultado",
          valor: moeda(entradas - saidas),
          tom: entradas - saidas >= 0 ? "positivo" : "negativo",
        },
        { rotulo: "Saldo acumulado", valor: moeda(saldoFinal) },
      ]}
      colunas={[
        { chave: "data", rotulo: "Data", tipo: "data" },
        { chave: "entradas", rotulo: "Entradas", tipo: "moeda" },
        { chave: "saidas", rotulo: "Saídas", tipo: "moeda" },
        { chave: "saldo", rotulo: "Saldo acumulado", tipo: "moeda" },
      ]}
      linhas={
        fluxo.length
          ? fluxo.map((ponto) => ({
              data: ponto.data,
              entradas: ponto.entradas,
              saidas: ponto.saidas,
              saldo: ponto.saldoAcumulado,
            }))
          : [
              {
                data: intervalo.inicio,
                entradas,
                saidas,
                saldo: saldoFinal,
              },
            ]
      }
      tabelasExtras={[
        {
          nome: "Lançamentos realizados",
          colunas: [
            { chave: "data", rotulo: "Data", tipo: "data" },
            { chave: "descricao", rotulo: "Descrição" },
            { chave: "contraparte", rotulo: "Contraparte" },
            { chave: "classificacao", rotulo: "Classificação" },
            { chave: "tipo", rotulo: "Tipo" },
            { chave: "valor", rotulo: "Valor", tipo: "moeda" },
          ],
          linhas: movimentos.map((item) => ({
            data: item.data,
            descricao: item.descricao,
            contraparte: item.contraparte ?? "—",
            classificacao: nomeConta(item.planoContaId),
            tipo: item.tipo === "entrada" ? "Entrada" : "Saída",
            valor: item.tipo === "entrada" ? item.valor : -item.valor,
          })),
        },
        {
          nome: "Títulos no período",
          colunas: [
            { chave: "contraparte", rotulo: "Cliente / fornecedor" },
            { chave: "tipo", rotulo: "Tipo" },
            { chave: "classificacao", rotulo: "Classificação" },
            { chave: "vencimento", rotulo: "Vencimento", tipo: "data" },
            { chave: "situacao", rotulo: "Situação" },
            { chave: "valor", rotulo: "Valor", tipo: "moeda" },
            { chave: "saldo", rotulo: "Saldo", tipo: "moeda" },
          ],
          linhas: titulos.map((titulo) => ({
            contraparte: titulo.contraparte,
            tipo: titulo.tipo === "receber" ? "A receber" : "A pagar",
            classificacao: nomeConta(titulo.planoContaId),
            vencimento: titulo.vencimento,
            situacao: rotuloSituacaoTitulo(titulo),
            valor: titulo.valor,
            saldo: titulo.valor - titulo.valorPago,
          })),
        },
      ]}
    />
  );
}
