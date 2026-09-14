import { FiltrosRelatorioForm } from "@/components/relatorios/filtros-relatorio";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { getDre, getMovimentosDre, getPlanoContas } from "@/lib/dados";
import { moeda } from "@/lib/format";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { comEmpresa, textoResumoFiltros } from "@/lib/relatorios/filtros";
import { ROTULO_GRUPO_DRE } from "@/lib/plano-contas-padrao";

export default async function RelatorioDrePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresaId, filtros, intervalo } = await carregarContextoRelatorio(searchParams);
  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const [linhasDre, movimentos, contas] = await Promise.all([
    getDre(intervalo.inicio, intervalo.fim, empresaId),
    getMovimentosDre(intervalo.inicio, intervalo.fim, empresaId),
    getPlanoContas(empresaId),
  ]);

  const linhasFiltradas = filtros.contas.length
    ? linhasDre.filter((linha) => filtros.contas.includes(linha.planoContaId))
    : linhasDre;

  const movimentosFiltrados = filtros.contas.length
    ? movimentos.filter((movimento) => movimento.planoContaId && filtros.contas.includes(movimento.planoContaId))
    : movimentos;

  const realizado = linhasFiltradas.reduce((soma, linha) => soma + linha.realizado, 0);
  const previsto = linhasFiltradas.reduce((soma, linha) => soma + linha.previsto, 0);

  return (
    <PainelRelatorio
      titulo="Relatório da DRE gerencial"
      descricao="Realizado pela data de emissão, com orçado e desvio por classificação."
      voltarHref={comEmpresa("/financeiro/relatorios", empresaId)}
      resumoFiltros={textoResumoFiltros({ ...filtros, campoData: "emissao" }, intervalo, contas)}
      nomeArquivo="relatorio-dre"
      filtros={
        <FiltrosRelatorioForm
          action="/financeiro/relatorios/dre"
          filtros={{ ...filtros, campoData: "emissao" }}
          contas={contas}
          empresaId={empresaId}
          mostrarTipo={false}
          mostrarOrigem={false}
          mostrarSituacao={false}
          mostrarCampoData={false}
          mostrarBusca={false}
        />
      }
      kpis={[
        { rotulo: "Realizado", valor: moeda(realizado), tom: realizado >= 0 ? "positivo" : "negativo" },
        { rotulo: "Orçado", valor: moeda(previsto) },
        { rotulo: "Desvio", valor: moeda(realizado - previsto) },
        { rotulo: "Movimentos", valor: String(movimentosFiltrados.length) },
      ]}
      colunas={[
        { chave: "codigo", rotulo: "Código" },
        { chave: "conta", rotulo: "Classificação" },
        { chave: "grupo", rotulo: "Grupo DRE" },
        { chave: "realizado", rotulo: "Realizado", tipo: "moeda" },
        { chave: "previsto", rotulo: "Orçado", tipo: "moeda" },
        { chave: "desvio", rotulo: "Desvio", tipo: "moeda" },
      ]}
      linhas={linhasFiltradas.map((linha) => ({
        codigo: linha.codigo,
        conta: linha.conta,
        grupo: ROTULO_GRUPO_DRE[linha.grupoDre],
        realizado: linha.realizado,
        previsto: linha.previsto,
        desvio: linha.realizado - linha.previsto,
      }))}
      tabelasExtras={[
        {
          nome: "Movimentos do realizado",
          colunas: [
            { chave: "data", rotulo: "Data", tipo: "data" },
            { chave: "descricao", rotulo: "Descrição" },
            { chave: "contraparte", rotulo: "Cliente / fornecedor" },
            { chave: "tipo", rotulo: "Tipo" },
            { chave: "valor", rotulo: "Valor", tipo: "moeda" },
          ],
          linhas: movimentosFiltrados.map((movimento) => ({
            data: movimento.data,
            descricao: movimento.descricao,
            contraparte: movimento.contraparte ?? "—",
            tipo: movimento.tipo === "entrada" ? "Entrada" : "Saída",
            valor: movimento.tipo === "entrada" ? movimento.valor : -movimento.valor,
          })),
        },
      ]}
    />
  );
}
