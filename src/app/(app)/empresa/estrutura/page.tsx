import { Building2, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getEmpresa } from "@/lib/dados";

/**
 * Organograma da operação. Ainda estático — quando a tabela `unidades` e um
 * cadastro de cargos existirem no Supabase, isto passa a ser alimentado por lá.
 */
const ORGANOGRAMA = [
  {
    area: "Direção",
    cargos: [{ nome: "Sócios-diretores", quantidade: 2 }],
  },
  {
    area: "Administrativo e financeiro",
    cargos: [
      { nome: "Gerente administrativo", quantidade: 1 },
      { nome: "Analista financeiro", quantidade: 2 },
      { nome: "Auxiliar administrativo", quantidade: 1 },
    ],
  },
  {
    area: "Hospedagem",
    cargos: [
      { nome: "Gerente de hospedagem", quantidade: 1 },
      { nome: "Recepção", quantidade: 6 },
      { nome: "Governança e camareiras", quantidade: 8 },
    ],
  },
  {
    area: "Alimentos e bebidas",
    cargos: [
      { nome: "Chef de cozinha", quantidade: 1 },
      { nome: "Cozinha", quantidade: 5 },
      { nome: "Salão e bar", quantidade: 4 },
    ],
  },
  {
    area: "Manutenção e apoio",
    cargos: [
      { nome: "Manutenção", quantidade: 2 },
      { nome: "Jardinagem e limpeza", quantidade: 1 },
    ],
  },
];

const TIPO_UNIDADE = {
  matriz: "Matriz",
  filial: "Filial",
  cd: "Centro de distribuição",
  loja: "Loja",
} as const;

export default async function EstruturaPage() {
  const empresa = await getEmpresa();

  const totalOrganograma = ORGANOGRAMA.reduce(
    (soma, area) => soma + area.cargos.reduce((s, c) => s + c.quantidade, 0),
    0,
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Colaboradores"
          valor={String(empresa.qtdFuncionarios)}
          icone={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Unidades"
          valor={String(empresa.unidades.length)}
          icone={<Building2 className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Áreas no organograma"
          valor={String(ORGANOGRAMA.length)}
          nota={`${totalOrganograma} posições mapeadas`}
        />
      </div>

      <Card>
        <CardHeader titulo="Unidades e filiais" />
        <CardBody className="space-y-3">
          {empresa.unidades.map((unidade) => (
            <div
              key={unidade.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Building2 className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{unidade.nome}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden />
                    {unidade.cidade} · {unidade.uf}
                  </p>
                </div>
              </div>
              <Badge tom={unidade.tipo === "matriz" ? "marca" : "neutro"}>
                {TIPO_UNIDADE[unidade.tipo]}
              </Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Organograma"
          descricao="Distribuição das posições por área"
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ORGANOGRAMA.map((area) => {
            const total = area.cargos.reduce((s, c) => s + c.quantidade, 0);
            return (
              <section
                key={area.area}
                className="rounded-lg border border-border p-4"
              >
                <header className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{area.area}</h3>
                  <span className="tabular text-xs text-muted-foreground">
                    {total}
                  </span>
                </header>
                <ul className="mt-2.5 space-y-1.5">
                  {area.cargos.map((cargo) => (
                    <li
                      key={cargo.nome}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">{cargo.nome}</span>
                      <span className="tabular font-medium">{cargo.quantidade}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
