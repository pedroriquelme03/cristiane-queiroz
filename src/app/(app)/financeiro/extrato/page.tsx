import { CheckCircle2, AlertTriangle } from "lucide-react";

import { AcessoLancamentoOrigem } from "@/components/financeiro/acesso-lancamento-origem";
import { FiltroExtrato } from "@/components/financeiro/filtro-extrato";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import {
  getCompetenciaAtual,
  getContasBancarias,
  getExtratoConta,
  getPlanoContas,
  intervaloDoMes,
} from "@/lib/dados";
import { data as formatarData, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0]?.trim() ?? "" : valor?.trim() ?? "";
}

export default async function ExtratoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = typeof params.empresa === "string" ? params.empresa : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const podeEditar =
    Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");

  const competencia = await getCompetenciaAtual();
  const padrao = intervaloDoMes(competencia);
  let inicio = primeiro(params.inicio) || padrao.inicio;
  let fim = primeiro(params.fim) || padrao.fim;
  if (inicio > fim) {
    const troca = inicio;
    inicio = fim;
    fim = troca;
  }

  if (sessao.role === "admin" && !empresaIdAtiva) {
    return (
      <>
        <FiltroExtrato contas={[]} contaId="" inicio={inicio} fim={fim} />
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma empresa no topo para ver o extrato por conta.
          </CardBody>
        </Card>
      </>
    );
  }

  const [contasBancarias, planoContas] = await Promise.all([
    getContasBancarias(empresaIdAtiva),
    getPlanoContas(empresaIdAtiva),
  ]);

  const contaParam = primeiro(params.conta);
  const contaId =
    contasBancarias.find((c) => c.id === contaParam)?.id ?? contasBancarias[0]?.id ?? "";

  if (!contaId) {
    return (
      <>
        <FiltroExtrato
          contas={contasBancarias}
          contaId=""
          inicio={inicio}
          fim={fim}
          empresaId={empresaIdAtiva}
        />
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            Cadastre uma conta bancária em Cadastros → Contas bancárias para gerar o extrato.
          </CardBody>
        </Card>
      </>
    );
  }

  const extrato = await getExtratoConta(contaId, inicio, fim, empresaIdAtiva);
  if (!extrato) {
    return (
      <>
        <FiltroExtrato
          contas={contasBancarias}
          contaId={contaId}
          inicio={inicio}
          fim={fim}
          empresaId={empresaIdAtiva}
        />
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            Conta não encontrada para esta empresa.
          </CardBody>
        </Card>
      </>
    );
  }

  const nomeClassificacao = (id: string | null) =>
    id ? (planoContas.find((c) => c.id === id)?.nome ?? "—") : "Sem classificação";

  const identidade = extrato.saldoAnterior + extrato.entradas - extrato.saidas;

  return (
    <>
      <FiltroExtrato
        contas={contasBancarias}
        contaId={contaId}
        inicio={inicio}
        fim={fim}
        empresaId={empresaIdAtiva}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Saldo anterior"
          valor={moeda(extrato.saldoAnterior)}
          nota={`Até ${formatarData(inicio)} · ref. ${formatarData(extrato.conta.dataSaldoInicial)}`}
        />
        <Kpi
          rotulo="Entradas"
          valor={moeda(extrato.entradas)}
          tom="positivo"
          nota={`${extrato.movimentos.filter((m) => m.tipo === "entrada").length} lançamentos`}
        />
        <Kpi
          rotulo="Saídas"
          valor={moeda(extrato.saidas)}
          tom="negativo"
          nota={`${extrato.movimentos.filter((m) => m.tipo === "saida").length} lançamentos`}
        />
        <Kpi
          rotulo="Saldo final"
          valor={moeda(extrato.saldoFinal)}
          tom={extrato.saldoFinal >= 0 ? "positivo" : "negativo"}
          nota={
            extrato.conferido
              ? "Saldo anterior + entradas − saídas"
              : "Divergência na conferência de saldo"
          }
        />
      </div>

      <div
        className={
          extrato.conferido
            ? "flex flex-wrap items-center gap-2 rounded-xl border border-positive/30 bg-positive/5 px-4 py-3 text-sm"
            : "flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm"
        }
      >
        {extrato.conferido ? (
          <CheckCircle2 className="size-4 shrink-0 text-positive" aria-hidden />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
        )}
        <span className="font-medium">
          {extrato.conferido ? "Conferência ok" : "Conferência com divergência"}
        </span>
        <span className="text-muted-foreground">
          {moeda(extrato.saldoAnterior)} + {moeda(extrato.entradas)} − {moeda(extrato.saidas)} ={" "}
          {moeda(identidade)}
          {extrato.conferido
            ? ` · bate com o saldo final ${moeda(extrato.saldoFinal)}`
            : ` · saldo final exibido ${moeda(extrato.saldoFinal)}`}
        </span>
        <Badge tom={extrato.conferido ? "positivo" : "neutro"}>
          {extrato.conta.nome}
        </Badge>
      </div>

      <Card>
        <CardHeader
          titulo="Movimentações do período"
          descricao={`${extrato.movimentos.length} lançamento${extrato.movimentos.length === 1 ? "" : "s"} em ${extrato.conta.nome} de ${formatarData(inicio)} a ${formatarData(fim)}`}
        />
        <CardBody className="px-0 py-0">
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">
                    Descrição
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">
                    Classificação
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Valor
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Origem
                  </th>
                </tr>
              </thead>
              <tbody>
                {extrato.movimentos.map((mov) => (
                  <tr key={mov.id} className="border-b border-border last:border-0">
                    <td className="tabular px-5 py-2.5 whitespace-nowrap">
                      {formatarData(mov.data)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{mov.descricao}</div>
                      {mov.contraparte ? (
                        <div className="text-xs text-muted-foreground">{mov.contraparte}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {nomeClassificacao(mov.planoContaId)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={
                          mov.tipo === "entrada"
                            ? "tabular font-medium text-positive"
                            : "tabular font-medium text-negative"
                        }
                      >
                        {mov.tipo === "entrada" ? "+" : "−"}
                        {moeda(mov.valor)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <AcessoLancamentoOrigem
                        movimento={mov}
                        contas={planoContas}
                        empresaId={empresaIdAtiva}
                        podeEditar={podeEditar}
                      />
                    </td>
                  </tr>
                ))}
                {extrato.movimentos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma movimentação nesta conta no período. O saldo final permanece igual ao
                      saldo anterior.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-muted/40 text-sm">
                  <td colSpan={3} className="px-5 py-2.5 font-medium">
                    Totais do período
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="tabular text-positive">+{moeda(extrato.entradas)}</div>
                    <div className="tabular text-negative">−{moeda(extrato.saidas)}</div>
                  </td>
                  <td className="tabular px-5 py-2.5 text-right font-medium">
                    {moeda(extrato.saldoFinal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
