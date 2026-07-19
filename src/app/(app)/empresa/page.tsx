import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmpresa } from "@/lib/dados";
import { cnpj as formatarCnpj, data as formatarData } from "@/lib/format";
import type { RegimeTributario, Segmento } from "@/lib/types";

const NOME_SEGMENTO: Record<Segmento, string> = {
  geral: "Geral",
  hotelaria: "Hotelaria",
  comercio: "Comércio",
  servicos: "Serviços",
  industria: "Indústria",
  alimentacao: "Alimentação",
};

const NOME_REGIME: Record<RegimeTributario, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

function anosDeOperacao(dataAbertura: string) {
  const abertura = new Date(`${dataAbertura}T12:00:00`);
  return Math.floor(
    (Date.now() - abertura.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export default async function EmpresaPage() {
  const empresa = await getEmpresa();

  const campos = [
    { rotulo: "Razão social", valor: empresa.razaoSocial },
    { rotulo: "Nome fantasia", valor: empresa.nomeFantasia },
    { rotulo: "CNPJ", valor: formatarCnpj(empresa.cnpj) },
    { rotulo: "Segmento", valor: NOME_SEGMENTO[empresa.segmento] },
    { rotulo: "Regime tributário", valor: NOME_REGIME[empresa.regimeTributario] },
    {
      rotulo: "Data de abertura",
      valor: `${formatarData(empresa.dataAbertura)} · ${anosDeOperacao(empresa.dataAbertura)} anos de operação`,
    },
  ];

  return (
    <Card>
      <CardHeader titulo="Dados gerais" descricao="Informações cadastrais da empresa" />
      <CardBody>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {campos.map((campo) => (
            <div key={campo.rotulo}>
              <dt className="text-xs font-medium text-muted-foreground">
                {campo.rotulo}
              </dt>
              <dd className="mt-0.5 text-sm">{campo.valor}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
