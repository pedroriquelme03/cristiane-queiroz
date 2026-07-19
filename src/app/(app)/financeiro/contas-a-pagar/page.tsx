import { TabelaTitulos } from "@/components/financeiro/tabela-titulos";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getTitulos, statusEfetivo } from "@/lib/dados";
import { diasAte, moeda } from "@/lib/format";

export default async function ContasAPagarPage() {
  const titulos = await getTitulos("pagar");

  const abertos = titulos.filter((t) => statusEfetivo(t) === "aberto");
  const vencidos = titulos.filter((t) => statusEfetivo(t) === "vencido");
  const pagos = titulos.filter((t) => t.status === "pago");

  const soma = (lista: typeof titulos) =>
    lista.reduce((s, t) => s + t.valor - t.valorPago, 0);

  // Concentração de vencimentos: quanto vence nos próximos 7 dias
  const emSete = abertos.filter((t) => diasAte(t.vencimento) <= 7);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Total em aberto" valor={moeda(soma(abertos) + soma(vencidos))} />
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
          rotulo="Pagos no histórico"
          valor={moeda(pagos.reduce((s, t) => s + t.valor, 0))}
          nota={`${pagos.length} títulos quitados`}
        />
      </div>

      {vencidos.length > 0 ? (
        <Card>
          <CardHeader
            titulo="Títulos vencidos"
            descricao="Prioridade de negociação — risco de juros e de corte de fornecimento"
          />
          <CardBody className="px-0 py-0">
            <TabelaTitulos titulos={vencidos} rotuloContraparte="Fornecedor" />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Contas a pagar em aberto"
          descricao="Ordenadas por vencimento"
        />
        <CardBody className="px-0 py-0">
          <TabelaTitulos titulos={abertos} rotuloContraparte="Fornecedor" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Histórico de pagamentos" descricao="Títulos já quitados" />
        <CardBody className="px-0 py-0">
          <TabelaTitulos titulos={pagos} rotuloContraparte="Fornecedor" />
        </CardBody>
      </Card>
    </>
  );
}
