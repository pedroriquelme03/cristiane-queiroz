import { Building2, Users, UsersRound } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export default async function OrganogramaPage({
  searchParams,
}: PageProps<"/empresa/organograma">) {
  const [sessao, { empresa: empresaParam }] = await Promise.all([
    getSessao(),
    searchParams,
  ]);
  const empresaId =
    sessao.role === "admin" && typeof empresaParam === "string"
      ? empresaParam
      : sessao.empresaId;

  const supabase = await createClient();
  const [
    { data: empresa, error: empresaError },
    { data: areas, error: areasError },
  ] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia, qtd_funcionarios")
      .eq("id", empresaId)
      .maybeSingle(),
    supabase
      .from("estrutura_areas")
      .select("id, nome, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem")
      .order("nome"),
  ]);

  if (empresaError || areasError) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar o organograma da empresa.
      </p>
    );
  }

  if (!empresa) {
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-muted-foreground">
          Selecione um cliente na aba Dados gerais para ver o organograma.
        </CardBody>
      </Card>
    );
  }

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
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar os cargos do organograma.
      </p>
    );
  }

  const listaCargos = cargos ?? [];
  const totalPosicoes = listaCargos.reduce((soma, cargo) => soma + cargo.quantidade, 0);
  const totalColaboradores = Math.max(empresa.qtd_funcionarios ?? 0, totalPosicoes);
  const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social;

  if (!listaAreas.length) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <UsersRound className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium">Organograma ainda vazio</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cadastre áreas e cargos na aba{" "}
            <strong className="font-medium text-foreground">Estrutura</strong> para
            que o organograma seja montado automaticamente.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Organograma</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Montado a partir das áreas e cargos cadastrados na Estrutura.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UsersRound className="size-3.5" aria-hidden />
              {listaAreas.length} {listaAreas.length === 1 ? "área" : "áreas"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {totalPosicoes} {totalPosicoes === 1 ? "posição" : "posições"}
            </span>
          </div>
        </header>

        <div className="organograma min-w-0 overflow-x-auto pb-2">
          <ul>
            <li>
              {/* Raiz: a empresa */}
              <NodeRaiz
                nome={nomeEmpresa}
                totalColaboradores={totalColaboradores}
                totalAreas={listaAreas.length}
              />

              <ul>
                {listaAreas.map((area) => {
                  const cargosArea = listaCargos.filter(
                    (cargo) => cargo.area_id === area.id,
                  );
                  const pessoasArea = cargosArea.reduce(
                    (soma, cargo) => soma + cargo.quantidade,
                    0,
                  );
                  return (
                    <li key={area.id}>
                      <NodeArea nome={area.nome} pessoas={pessoasArea} />

                      {cargosArea.length ? (
                        <ul>
                          {cargosArea.map((cargo) => (
                            <li key={cargo.id}>
                              <NodeCargo
                                nome={cargo.nome}
                                quantidade={cargo.quantidade}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

function NodeRaiz({
  nome,
  totalColaboradores,
  totalAreas,
}: {
  nome: string;
  totalColaboradores: number;
  totalAreas: number;
}) {
  return (
    <div className="flex w-56 flex-col items-center rounded-xl border border-brand bg-brand px-4 py-3 text-center text-brand-foreground shadow-[0_8px_24px_-16px_rgba(15,61,76,0.8)]">
      <span className="grid size-9 place-items-center rounded-lg bg-white/15">
        <Building2 className="size-5" aria-hidden />
      </span>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{nome}</p>
      <p className="mt-1 text-xs text-brand-foreground/80">
        {totalColaboradores} colaboradores · {totalAreas}{" "}
        {totalAreas === 1 ? "área" : "áreas"}
      </p>
    </div>
  );
}

function NodeArea({ nome, pessoas }: { nome: string; pessoas: number }) {
  return (
    <div className="flex w-48 flex-col items-center rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-center">
      <p className="line-clamp-2 text-sm font-semibold leading-tight">{nome}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden />
        {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}
      </p>
    </div>
  );
}

function NodeCargo({ nome, quantidade }: { nome: string; quantidade: number }) {
  return (
    <div className="flex w-40 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left">
      <span className="min-w-0 truncate text-xs text-foreground">{nome}</span>
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand tabular">
        {quantidade}
      </span>
    </div>
  );
}
