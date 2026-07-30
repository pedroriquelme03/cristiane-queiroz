import { Building2, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

const TIPO_UNIDADE = {
  matriz: "Matriz",
  filial: "Filial",
  cd: "Centro de distribuição",
  loja: "Loja",
} as const;

export default async function EstruturaPage({
  searchParams,
}: PageProps<"/empresa/estrutura">) {
  const [sessao, { empresa: empresaParam }] = await Promise.all([
    getSessao(),
    searchParams,
  ]);
  const empresaId =
    sessao.role === "admin" && typeof empresaParam === "string"
      ? empresaParam
      : sessao.empresaId;
  const supabase = await createClient();
  const [{ data: empresa, error: empresaError }, { data: unidades, error: unidadesError }, { data: areas, error: areasError }] =
    await Promise.all([
      supabase
        .from("empresas")
        .select("id, razao_social, qtd_funcionarios")
        .eq("id", empresaId)
        .maybeSingle(),
      supabase
        .from("unidades")
        .select("id, nome, tipo, cidade, uf")
        .eq("empresa_id", empresaId)
        .order("nome"),
      supabase
        .from("estrutura_areas")
        .select("id, nome, ordem")
        .eq("empresa_id", empresaId)
        .order("ordem")
        .order("nome"),
    ]);

  if (empresaError || unidadesError || areasError) {
    return <p className="text-sm text-destructive">Não foi possível carregar a estrutura da empresa.</p>;
  }

  if (!empresa) {
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-muted-foreground">
          Selecione um cliente na aba “Dados gerais” para consultar a estrutura.
        </CardBody>
      </Card>
    );
  }

  const listaUnidades = unidades ?? [];
  const listaAreas = areas ?? [];
  const { data: cargos, error: cargosError } = listaAreas.length
    ? await supabase
        .from("estrutura_cargos")
        .select("id, area_id, nome, quantidade, ordem")
        .eq("empresa_id", empresaId)
        .in("area_id", listaAreas.map((area) => area.id))
        .order("ordem")
        .order("nome")
    : { data: [], error: null };

  if (cargosError) {
    return <p className="text-sm text-destructive">Não foi possível carregar o organograma da empresa.</p>;
  }

  const totalOrganograma = (cargos ?? []).reduce((soma, cargo) => soma + cargo.quantidade, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          rotulo="Colaboradores"
          valor={String(empresa.qtd_funcionarios ?? 0)}
          icone={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Unidades"
          valor={String(listaUnidades.length)}
          icone={<Building2 className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Áreas no organograma"
          valor={String(listaAreas.length)}
          nota={`${totalOrganograma} posições mapeadas`}
        />
      </div>

      <Card>
        <CardHeader titulo="Unidades e filiais" descricao={empresa.razao_social} />
        <CardBody className="space-y-3">
          {listaUnidades.length ? listaUnidades.map((unidade) => (
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
                {TIPO_UNIDADE[unidade.tipo as keyof typeof TIPO_UNIDADE] ?? unidade.tipo}
              </Badge>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada para esta empresa.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Organograma" descricao="Distribuição das posições por área" />
        <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listaAreas.length ? listaAreas.map((area) => {
            const cargosArea = (cargos ?? []).filter((cargo) => cargo.area_id === area.id);
            const total = cargosArea.reduce((soma, cargo) => soma + cargo.quantidade, 0);
            return <section key={area.id} className="rounded-lg border border-border p-4">
              <header className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{area.nome}</h3>
                <span className="tabular text-xs text-muted-foreground">{total}</span>
              </header>
              <ul className="mt-2.5 space-y-1.5">
                {cargosArea.length ? cargosArea.map((cargo) => (
                  <li key={cargo.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{cargo.nome}</span>
                    <span className="tabular font-medium">{cargo.quantidade}</span>
                  </li>
                )) : <li className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</li>}
              </ul>
            </section>;
          }) : <p className="text-sm text-muted-foreground">Nenhuma estrutura organizacional cadastrada para esta empresa.</p>}
        </CardBody>
      </Card>
    </>
  );
}
