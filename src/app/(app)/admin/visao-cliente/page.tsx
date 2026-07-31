import { redirect } from "next/navigation";
import { Building2, Landmark, Users } from "lucide-react";

import { SeletorCliente } from "./seletor-cliente";
import DashboardPage from "@/app/(app)/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { cnpj as formatarCnpj } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const NOME_SEGMENTO: Record<string, string> = {
  alimentacao: "Alimentação",
  comercio: "Comércio",
  geral: "Geral",
  hotelaria: "Hotelaria",
  industria: "Indústria",
  servicos: "Serviços",
};

export async function ConteudoVisaoCliente({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const supabase = await createClient();
  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("*")
    .order("razao_social");

  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar os clientes.</p>;
  }

  const lista = empresas ?? [];
  const empresa = lista.find((item) => item.id === empresaId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          titulo="Visão do cliente"
          descricao="Escolha um cliente para consultar o contexto dele sem sair do painel administrativo."
        />
        <CardBody className="max-w-xl">
          <SeletorCliente empresas={lista} empresaSelecionadaId={empresa?.id} />
        </CardBody>
      </Card>

      {!empresa ? (
        <Card>
          <CardBody className="py-12 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Selecione um cliente para abrir sua visão.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você verá os dados cadastrais e, na próxima etapa, os números financeiros próprios dele.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-brand/20 bg-brand-soft/40 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground">
                {(empresa.razao_social || empresa.nome_fantasia).slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand">Visualizando cliente</p>
                <p className="truncate text-base font-semibold">{empresa.razao_social}</p>
                <p className="truncate text-sm text-muted-foreground">{empresa.nome_fantasia}</p>
              </div>
            </div>
          </div>

          <DashboardPage empresaId={empresa.id} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              rotulo="CNPJ"
              valor={empresa.cnpj ? formatarCnpj(empresa.cnpj) : "Não informado"}
              icone={<Building2 className="size-4" />}
            />
            <Kpi
              rotulo="Segmento"
              valor={NOME_SEGMENTO[empresa.segmento] ?? empresa.segmento ?? "Não informado"}
              icone={<Landmark className="size-4" />}
            />
            <Kpi
              rotulo="Unidades"
              valor={String(Array.isArray(empresa.unidades) ? empresa.unidades.length : 0)}
              icone={<Building2 className="size-4" />}
            />
            <Kpi
              rotulo="Colaboradores"
              valor={String(empresa.qtd_funcionarios ?? 0)}
              icone={<Users className="size-4" />}
            />
          </div>

        </>
      )}
    </div>
  );
}

export default function VisaoClientePage() {
  redirect("/visao-cliente");
}
