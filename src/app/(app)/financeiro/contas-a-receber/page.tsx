import { DialogoTitulo } from "@/components/financeiro/dialogo-titulo";
import { TabelaTitulos } from "@/components/financeiro/tabela-titulos";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getPlanoContas, getTitulos, statusEfetivo } from "@/lib/dados";
import { moeda, percentual } from "@/lib/format";

export default async function ContasAReceberPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa } = await searchParams;
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const [titulos, contas] = await Promise.all([
    getTitulos("receber", empresaId),
    getPlanoContas(empresaId),
  ]);

  const abertos = titulos.filter((t) => statusEfetivo(t) === "aberto");
  const vencidos = titulos.filter((t) => statusEfetivo(t) === "vencido");
  const recebidos = titulos.filter((t) => t.status === "pago");

  const soma = (lista: typeof titulos) =>
    lista.reduce((s, t) => s + t.valor - t.valorPago, 0);

  const totalAberto = soma(abertos) + soma(vencidos);
  const taxaInadimplencia = totalAberto > 0 ? (soma(vencidos) / totalAberto) * 100 : 0;

  // Concentração por cliente: quanto do total em aberto está no maior devedor
  const porCliente = [...abertos, ...vencidos].reduce<Record<string, number>>(
    (acc, t) => {
      acc[t.contraparte] = (acc[t.contraparte] ?? 0) + t.valor - t.valorPago;
      return acc;
    },
    {},
  );
  const ranking = Object.entries(porCliente).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Total a receber" valor={moeda(totalAberto)} />
        <Kpi
          rotulo="Em atraso"
          valor={moeda(soma(vencidos))}
          tom={vencidos.length ? "negativo" : "neutro"}
          nota={`${vencidos.length} títulos`}
        />
        <Kpi
          rotulo="Inadimplência"
          valor={percentual(taxaInadimplencia)}
          tom={taxaInadimplencia > 5 ? "atencao" : "positivo"}
          nota="Meta: abaixo de 5%"
        />
        <Kpi
          rotulo="Recebido no histórico"
          valor={moeda(recebidos.reduce((s, t) => s + t.valor, 0))}
          nota={`${recebidos.length} títulos liquidados`}
        />
      </div>

      {vencidos.length > 0 ? (
        <Card>
          <CardHeader
            titulo="Inadimplência"
            descricao="Títulos vencidos — acionar a régua de cobrança"
          />
          <CardBody className="px-0 py-0">
            <TabelaTitulos titulos={vencidos} rotuloContraparte="Cliente" />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Recebimentos previstos"
          descricao="Ordenados por vencimento"
          acao={<DialogoTitulo tipo="receber" contas={contas} />}
        />
        <CardBody className="px-0 py-0">
          <TabelaTitulos titulos={abertos} rotuloContraparte="Cliente" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Concentração por cliente"
          descricao="Quanto do saldo em aberto está em cada cliente"
        />
        <CardBody className="space-y-2.5">
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum recebimento em aberto.
            </p>
          ) : (
            ranking.map(([cliente, valor]) => (
              <div key={cliente} className="flex items-center gap-3">
                <span className="w-52 shrink-0 truncate text-sm">{cliente}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(valor / ranking[0][1]) * 100}%` }}
                  />
                </div>
                <span className="tabular w-28 shrink-0 text-right text-sm font-medium">
                  {moeda(valor)}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </>
  );
}
