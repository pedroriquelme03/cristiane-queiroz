import { DialogoNovaCategoria } from "@/components/financeiro/dialogo-categoria-fixa";
import { DialogoParcelaCartao } from "@/components/financeiro/dialogo-parcela-cartao";
import { DialogoTitulo } from "@/components/financeiro/dialogo-titulo";
import { TabelaContasFixas } from "@/components/financeiro/tabela-contas-fixas";
import { TabelaTitulos } from "@/components/financeiro/tabela-titulos";
import { LinkGerarRelatorio } from "@/components/relatorios/link-gerar-relatorio";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { agruparContasFixas, getPlanoContas, getTitulos, statusEfetivo } from "@/lib/dados";
import { diasAte, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";

export default async function ContasAPagarPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa }, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const podeEditar = Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const [titulos, contas] = await Promise.all([
    getTitulos("pagar", empresaIdAtiva),
    getPlanoContas(empresaIdAtiva),
  ]);

  const abertos = titulos.filter(
    (t) => !t.fixa && ["aberto", "parcial"].includes(statusEfetivo(t)),
  );
  const vencidos = titulos.filter((t) => !t.fixa && statusEfetivo(t) === "vencido");
  const pagos = titulos.filter((t) => t.status === "pago");
  const fixas = agruparContasFixas(
    titulos.filter((t) => t.fixa && ["aberto", "parcial", "vencido"].includes(statusEfetivo(t))),
  );

  const soma = (lista: typeof titulos) =>
    lista.reduce((s, t) => s + t.valor - t.valorPago, 0);
  const somaFixas = fixas.reduce((s, g) => s + g.saldo, 0);
  const totalMensalFixas = fixas.reduce((s, g) => s + g.valorMensal, 0);

  // Inclui avulsos e parcelas de contas fixas com vencimento de hoje até 7 dias.
  const emSete = titulos.filter((t) => {
    const situacao = statusEfetivo(t);
    if (!["aberto", "parcial"].includes(situacao)) return false;
    const dias = diasAte(t.vencimento);
    return dias >= 0 && dias <= 7;
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Total em aberto" valor={moeda(soma(abertos) + soma(vencidos) + somaFixas)} />
        <Kpi
          rotulo="Vencidos"
          valor={moeda(soma(vencidos))}
          tom={vencidos.length ? "negativo" : "neutro"}
          nota={`${vencidos.length} títulos`}
        />
        <Kpi
          rotulo="Vencem em 7 dias"
          valor={moeda(soma(emSete))}
          tom={emSete.length ? "atencao" : "neutro"}
          nota={`${emSete.length} títulos`}
        />
        <Kpi
          rotulo="Total mensal (fixas)"
          valor={moeda(totalMensalFixas)}
          nota={`${fixas.length} conta${fixas.length === 1 ? "" : "s"} · soma das parcelas`}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Contas fixas"
          descricao="Uma linha por cadastro — parcelas mensais agrupadas com meses restantes a pagar."
          acao={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <LinkGerarRelatorio href="/financeiro/relatorios/contratos" empresaId={empresaIdAtiva} rotulo="Relatório de contratos" />
              {podeEditar ? (
                <>
                  <DialogoNovaCategoria empresaId={empresaIdAtiva} tipoPadrao="despesa" />
                  <DialogoParcelaCartao contas={contas} empresaId={empresaIdAtiva} />
                  <DialogoTitulo tipo="pagar" contas={contas} empresaId={empresaIdAtiva} fixaPadrao />
                </>
              ) : null}
            </div>
          }
        />
        <CardBody className="px-0 py-0">
          <TabelaContasFixas
            grupos={fixas}
            tipo="pagar"
            rotuloContraparte="Fornecedor"
            contas={contas}
            empresaId={empresaIdAtiva}
            podeEditar={podeEditar}
          />
        </CardBody>
      </Card>

      {vencidos.length > 0 ? (
        <Card>
          <CardHeader
            titulo="Títulos vencidos"
            descricao="Prioridade de negociação — risco de juros e de corte de fornecimento"
          />
          <CardBody className="px-0 py-0">
            <TabelaTitulos titulos={vencidos} rotuloContraparte="Fornecedor" contas={contas} empresaId={empresaIdAtiva} podeEditar={podeEditar} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Contas a pagar em aberto"
          descricao="Ordenadas por vencimento"
          acao={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <LinkGerarRelatorio href="/financeiro/relatorios/contas-a-pagar" empresaId={empresaIdAtiva} />
              {podeEditar ? <DialogoTitulo tipo="pagar" contas={contas} empresaId={empresaIdAtiva} /> : null}
            </div>
          }
        />
        <CardBody className="px-0 py-0">
          <TabelaTitulos titulos={abertos} rotuloContraparte="Fornecedor" contas={contas} empresaId={empresaIdAtiva} podeEditar={podeEditar} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Histórico de pagamentos" descricao="Títulos já quitados" />
        <CardBody className="px-0 py-0">
          <TabelaTitulos titulos={pagos} rotuloContraparte="Fornecedor" contas={contas} empresaId={empresaIdAtiva} podeEditar={podeEditar} />
        </CardBody>
      </Card>
    </>
  );
}
