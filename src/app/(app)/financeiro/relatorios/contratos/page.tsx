import { FiltrosRelatorioForm } from "@/components/relatorios/filtros-relatorio";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { getPlanoContas, getTitulos } from "@/lib/dados";
import { moeda } from "@/lib/format";
import { agruparContratos, filtrarContratos, ROTULO_SITUACAO_CONTRATO } from "@/lib/relatorios/contratos";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { comEmpresa, textoResumoFiltros } from "@/lib/relatorios/filtros";
import { rotuloSituacaoTitulo } from "@/lib/relatorios/titulos";

export default async function RelatorioContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresaId, filtros, intervalo } = await carregarContextoRelatorio(searchParams);
  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const [pagar, receber, contas] = await Promise.all([
    getTitulos("pagar", empresaId),
    getTitulos("receber", empresaId),
    getPlanoContas(empresaId),
  ]);
  const contratos = filtrarContratos(agruparContratos([...pagar, ...receber]), filtros, intervalo);
  const nomeConta = (id: string | null) =>
    id ? (contas.find((conta) => conta.id === id)?.nome ?? "—") : "Sem classificação";

  const parcelas = contratos.flatMap((contrato) =>
    contrato.parcelas.map((parcela) => ({
      cliente: contrato.cliente,
      parcela: parcela.documento ?? "—",
      classificacao: nomeConta(parcela.planoContaId),
      vencimento: parcela.vencimento,
      pagamento: parcela.dataPagamento,
      situacao: rotuloSituacaoTitulo(parcela),
      valor: parcela.valor,
      liquidado: parcela.valorPago,
      saldo: parcela.valor - parcela.valorPago,
    })),
  );

  return (
    <PainelRelatorio
      titulo="Relatório de contratos"
      descricao="Contas e recebimentos fixos agrupados: cliente, parcelas, vencimentos e situação."
      voltarHref={comEmpresa("/financeiro/relatorios", empresaId)}
      resumoFiltros={textoResumoFiltros(filtros, intervalo, contas)}
      nomeArquivo="relatorio-contratos"
      filtros={
        <FiltrosRelatorioForm
          action="/financeiro/relatorios/contratos"
          filtros={filtros}
          contas={contas}
          empresaId={empresaId}
          mostrarTipo
          mostrarOrigem={false}
        />
      }
      kpis={[
        { rotulo: "Contratos", valor: String(contratos.length) },
        { rotulo: "Valor total", valor: moeda(contratos.reduce((soma, item) => soma + item.valorTotal, 0)) },
        {
          rotulo: "Pago / recebido",
          valor: moeda(contratos.reduce((soma, item) => soma + item.valorPago, 0)),
          tom: "positivo",
        },
        {
          rotulo: "A vencer",
          valor: moeda(contratos.reduce((soma, item) => soma + item.valorAVencer, 0)),
          tom: "atencao",
        },
      ]}
      colunas={[
        { chave: "cliente", rotulo: "Cliente / fornecedor" },
        { chave: "tipo", rotulo: "Tipo" },
        { chave: "classificacao", rotulo: "Classificação" },
        { chave: "valorTotal", rotulo: "Valor total", tipo: "moeda" },
        { chave: "parcelas", rotulo: "Qtd. parcelas", tipo: "numero" },
        { chave: "valorParcela", rotulo: "Valor da parcela", tipo: "moeda" },
        { chave: "pagas", rotulo: "Pagas / recebidas", tipo: "numero" },
        { chave: "aVencer", rotulo: "A vencer", tipo: "numero" },
        { chave: "vencimentos", rotulo: "Datas de vencimento" },
        { chave: "situacao", rotulo: "Situação" },
      ]}
      linhas={contratos.map((contrato) => ({
        cliente: contrato.cliente,
        tipo: contrato.tipo === "receber" ? "A receber" : "A pagar",
        classificacao: nomeConta(contrato.planoContaId),
        valorTotal: contrato.valorTotal,
        parcelas: contrato.quantidadeParcelas,
        valorParcela: contrato.valorParcela,
        pagas: contrato.parcelasPagas,
        aVencer: contrato.parcelasAVencer,
        vencimentos: contrato.vencimentos
          .map((data) => data.slice(8, 10) + "/" + data.slice(5, 7) + "/" + data.slice(0, 4))
          .join(", "),
        situacao: ROTULO_SITUACAO_CONTRATO[contrato.situacao],
      }))}
      tabelasExtras={[
        {
          nome: "Parcelas dos contratos",
          colunas: [
            { chave: "cliente", rotulo: "Cliente / fornecedor" },
            { chave: "parcela", rotulo: "Documento" },
            { chave: "classificacao", rotulo: "Classificação" },
            { chave: "vencimento", rotulo: "Vencimento", tipo: "data" },
            { chave: "pagamento", rotulo: "Pagamento / recebimento", tipo: "data" },
            { chave: "situacao", rotulo: "Situação da parcela" },
            { chave: "valor", rotulo: "Valor", tipo: "moeda" },
            { chave: "liquidado", rotulo: "Pago / recebido", tipo: "moeda" },
            { chave: "saldo", rotulo: "Saldo", tipo: "moeda" },
          ],
          linhas: parcelas,
        },
      ]}
    />
  );
}
