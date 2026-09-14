import { FiltrosRelatorioForm } from "@/components/relatorios/filtros-relatorio";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { getLancamentos, getPlanoContas, getTitulos } from "@/lib/dados";
import { moeda } from "@/lib/format";
import { ROTULO_TIPO_CONTA } from "@/lib/plano-contas-padrao";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { CONTA_SEM_CLASSIFICACAO, comEmpresa, textoResumoFiltros } from "@/lib/relatorios/filtros";
import { filtrarLancamentos, filtrarTitulos } from "@/lib/relatorios/titulos";

export default async function RelatorioPlanoDeContasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresaId, filtros, intervalo } = await carregarContextoRelatorio(searchParams);
  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const [pagar, receber, contas, lancamentos] = await Promise.all([
    getTitulos("pagar", empresaId),
    getTitulos("receber", empresaId),
    getPlanoContas(empresaId),
    getLancamentos(intervalo.inicio, intervalo.fim, empresaId),
  ]);

  const titulos = filtrarTitulos([...pagar, ...receber], filtros, intervalo);
  const movimentos = filtrarLancamentos(lancamentos, filtros, intervalo);
  const selecionadas = new Set(filtros.contas);

  const ids = new Set<string>();
  if (selecionadas.size > 0) {
    for (const id of selecionadas) ids.add(id);
  } else {
    for (const titulo of titulos) ids.add(titulo.planoContaId ?? CONTA_SEM_CLASSIFICACAO);
    for (const movimento of movimentos) ids.add(movimento.planoContaId ?? CONTA_SEM_CLASSIFICACAO);
    for (const conta of contas) ids.add(conta.id);
  }

  const linhas = [...ids]
    .map((id) => {
      const conta = id === CONTA_SEM_CLASSIFICACAO ? null : contas.find((item) => item.id === id);
      const titulosDaConta = titulos.filter((item) => (item.planoContaId ?? CONTA_SEM_CLASSIFICACAO) === id);
      const lancamentosDaConta = movimentos.filter((item) => (item.planoContaId ?? CONTA_SEM_CLASSIFICACAO) === id);
      const pago = titulosDaConta.filter((item) => item.tipo === "pagar").reduce((soma, item) => soma + item.valorPago, 0)
        + lancamentosDaConta.filter((item) => item.tipo === "saida").reduce((soma, item) => soma + item.valor, 0);
      const recebido = titulosDaConta.filter((item) => item.tipo === "receber").reduce((soma, item) => soma + item.valorPago, 0)
        + lancamentosDaConta.filter((item) => item.tipo === "entrada").reduce((soma, item) => soma + item.valor, 0);
      const aPagar = titulosDaConta.filter((item) => item.tipo === "pagar").reduce((soma, item) => soma + item.valor - item.valorPago, 0);
      const aReceber = titulosDaConta.filter((item) => item.tipo === "receber").reduce((soma, item) => soma + item.valor - item.valorPago, 0);

      return {
        codigo: conta?.codigo ?? "—",
        classificacao: conta?.nome ?? "Sem classificação",
        tipo: conta ? ROTULO_TIPO_CONTA[conta.tipo] : "—",
        quantidade: titulosDaConta.length + lancamentosDaConta.length,
        pago,
        recebido,
        aPagar,
        aReceber,
      };
    })
    .filter((linha) =>
      selecionadas.size > 0
        ? true
        : linha.quantidade > 0 || linha.pago !== 0 || linha.recebido !== 0 || linha.aPagar !== 0 || linha.aReceber !== 0,
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));

  return (
    <PainelRelatorio
      titulo="Relatório por plano de contas"
      descricao="Totais pagos, recebidos e em aberto por classificação."
      voltarHref={comEmpresa("/financeiro/relatorios", empresaId)}
      resumoFiltros={textoResumoFiltros(filtros, intervalo, contas)}
      nomeArquivo="relatorio-plano-de-contas"
      filtros={
        <FiltrosRelatorioForm
          action="/financeiro/relatorios/plano-de-contas"
          filtros={filtros}
          contas={contas}
          empresaId={empresaId}
          mostrarTipo
        />
      }
      kpis={[
        { rotulo: "Classificações", valor: String(linhas.length) },
        { rotulo: "Pago", valor: moeda(linhas.reduce((soma, linha) => soma + linha.pago, 0)), tom: "negativo" },
        { rotulo: "Recebido", valor: moeda(linhas.reduce((soma, linha) => soma + linha.recebido, 0)), tom: "positivo" },
        {
          rotulo: "Saldo líquido",
          valor: moeda(linhas.reduce((soma, linha) => soma + linha.recebido - linha.pago, 0)),
        },
      ]}
      colunas={[
        { chave: "codigo", rotulo: "Código" },
        { chave: "classificacao", rotulo: "Classificação" },
        { chave: "tipo", rotulo: "Tipo" },
        { chave: "quantidade", rotulo: "Lançamentos", tipo: "numero" },
        { chave: "pago", rotulo: "Pago", tipo: "moeda" },
        { chave: "recebido", rotulo: "Recebido", tipo: "moeda" },
        { chave: "aPagar", rotulo: "A pagar", tipo: "moeda" },
        { chave: "aReceber", rotulo: "A receber", tipo: "moeda" },
      ]}
      linhas={linhas}
    />
  );
}
