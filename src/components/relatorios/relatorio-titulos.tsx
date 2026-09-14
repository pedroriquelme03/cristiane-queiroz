import { FiltrosRelatorioForm } from "@/components/relatorios/filtros-relatorio";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { getPlanoContas, getTitulos } from "@/lib/dados";
import { moeda } from "@/lib/format";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { comEmpresa, textoResumoFiltros, type FiltrosRelatorio } from "@/lib/relatorios/filtros";
import { filtrarTitulos, rotuloSituacaoTitulo } from "@/lib/relatorios/titulos";
import type { Titulo } from "@/lib/types";

export async function RelatorioTitulos({
  tipo,
  searchParams,
}: {
  tipo: Titulo["tipo"];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { empresaId, filtros: filtrosBrutos, intervalo } = await carregarContextoRelatorio(searchParams);
  const filtros: FiltrosRelatorio = { ...filtrosBrutos, tipo };

  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const receber = tipo === "receber";
  const [titulos, contas] = await Promise.all([
    getTitulos(tipo, empresaId),
    getPlanoContas(empresaId),
  ]);
  const filtrados = filtrarTitulos(titulos, filtros, intervalo);
  const nomeConta = (id: string | null) =>
    id ? (contas.find((conta) => conta.id === id)?.nome ?? "—") : "Sem classificação";

  const total = filtrados.reduce((soma, titulo) => soma + titulo.valor, 0);
  const liquidado = filtrados.reduce((soma, titulo) => soma + titulo.valorPago, 0);
  const saldo = filtrados.reduce((soma, titulo) => soma + titulo.valor - titulo.valorPago, 0);
  const rotuloContraparte = receber ? "Cliente" : "Fornecedor";
  const titulo = receber ? "Relatório de contas a receber" : "Relatório de contas a pagar";
  const action = receber
    ? "/financeiro/relatorios/contas-a-receber"
    : "/financeiro/relatorios/contas-a-pagar";

  return (
    <PainelRelatorio
      titulo={titulo}
      voltarHref={comEmpresa("/financeiro/relatorios", empresaId)}
      resumoFiltros={textoResumoFiltros(filtros, intervalo, contas)}
      nomeArquivo={receber ? "relatorio-contas-a-receber" : "relatorio-contas-a-pagar"}
      filtros={
        <FiltrosRelatorioForm
          action={action}
          filtros={filtros}
          contas={contas}
          empresaId={empresaId}
          tipoFixo={tipo}
        />
      }
      kpis={[
        { rotulo: "Lançamentos", valor: String(filtrados.length) },
        { rotulo: "Valor total", valor: moeda(total) },
        {
          rotulo: receber ? "Recebido" : "Pago",
          valor: moeda(liquidado),
          tom: "positivo",
        },
        {
          rotulo: receber ? "A receber" : "A pagar",
          valor: moeda(saldo),
          tom: saldo > 0 ? "atencao" : "neutro",
        },
      ]}
      colunas={[
        { chave: "contraparte", rotulo: rotuloContraparte },
        { chave: "documento", rotulo: "Documento" },
        { chave: "classificacao", rotulo: "Classificação" },
        { chave: "emissao", rotulo: "Emissão", tipo: "data" },
        { chave: "vencimento", rotulo: "Vencimento", tipo: "data" },
        { chave: "pagamento", rotulo: receber ? "Recebimento" : "Pagamento", tipo: "data" },
        { chave: "situacao", rotulo: "Situação" },
        { chave: "valor", rotulo: "Valor", tipo: "moeda" },
        { chave: "liquidado", rotulo: receber ? "Recebido" : "Pago", tipo: "moeda" },
        { chave: "saldo", rotulo: "Saldo", tipo: "moeda" },
      ]}
      linhas={filtrados.map((tituloItem) => ({
        contraparte: tituloItem.contraparte,
        documento: tituloItem.documento ?? "—",
        classificacao: nomeConta(tituloItem.planoContaId),
        emissao: tituloItem.emissao,
        vencimento: tituloItem.vencimento,
        pagamento: tituloItem.dataPagamento,
        situacao: rotuloSituacaoTitulo(tituloItem),
        valor: tituloItem.valor,
        liquidado: tituloItem.valorPago,
        saldo: tituloItem.valor - tituloItem.valorPago,
      }))}
    />
  );
}
