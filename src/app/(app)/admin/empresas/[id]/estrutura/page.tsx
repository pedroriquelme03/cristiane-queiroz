import Link from "next/link";
import { Building2, ChevronLeft, Plus, Trash2, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";

import {
  adicionarArea,
  adicionarCargo,
  adicionarUnidade,
  removerArea,
  removerCargo,
  removerUnidade,
} from "./actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const TIPOS_UNIDADE = [
  ["matriz", "Matriz"],
  ["filial", "Filial"],
  ["loja", "Loja"],
  ["cd", "Centro de distribuição"],
] as const;

export default async function EstruturaAdminPage({
  params,
}: PageProps<"/admin/empresas/[id]/estrutura">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: empresa }, { data: unidades }, { data: areas }] = await Promise.all([
    supabase.from("empresas").select("id, razao_social, nome_fantasia").eq("id", id).maybeSingle(),
    supabase.from("unidades").select("id, nome, tipo, cidade, uf").eq("empresa_id", id).order("nome"),
    supabase.from("estrutura_areas").select("id, nome, ordem").eq("empresa_id", id).order("ordem").order("nome"),
  ]);
  if (!empresa) notFound();

  const listaAreas = areas ?? [];
  const { data: cargos } = listaAreas.length
    ? await supabase
        .from("estrutura_cargos")
        .select("id, area_id, nome, quantidade, ordem")
        .eq("empresa_id", id)
        .in("area_id", listaAreas.map((area) => area.id))
        .order("ordem")
        .order("nome")
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/admin/empresas/${id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Voltar para dados da empresa
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Estrutura de {empresa.nome_fantasia || empresa.razao_social}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre unidades, áreas e cargos que serão exibidos para este cliente.
        </p>
      </div>

      <Card>
        <CardHeader titulo="Unidades e filiais" descricao="Cadastre os locais de operação da empresa." />
        <CardBody className="space-y-5">
          <form action={adicionarUnidade.bind(null, id)} className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_72px_auto]">
            <input name="nome" required placeholder="Nome da unidade" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <select name="tipo" defaultValue="filial" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              {TIPOS_UNIDADE.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
            <input name="cidade" placeholder="Cidade" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <input name="uf" maxLength={2} placeholder="UF" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase" />
            <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
              <Plus className="size-4" /> Adicionar
            </button>
          </form>
          {(unidades ?? []).length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {(unidades ?? []).map((unidade) => (
                <li key={unidade.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span><strong>{unidade.nome}</strong><span className="ml-2 text-muted-foreground">{unidade.tipo} · {unidade.cidade ?? "Cidade não informada"}{unidade.uf ? `/${unidade.uf}` : ""}</span></span>
                  <form action={removerUnidade.bind(null, id, unidade.id)}>
                    <button title="Remover unidade" className="text-muted-foreground hover:text-negative"><Trash2 className="size-4" /></button>
                  </form>
                </li>
              ))}
            </ul>
          ) : <EstadoVazio icone={<Building2 className="size-5" />} texto="Nenhuma unidade cadastrada." />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Organograma" descricao="Defina as áreas e os cargos que compõem a equipe." />
        <CardBody className="space-y-5">
          <form action={adicionarArea.bind(null, id)} className="flex max-w-md gap-3">
            <input name="nome" required placeholder="Nome da área, por exemplo: Financeiro" className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <button className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90"><Plus className="size-4" /> Área</button>
          </form>

          {listaAreas.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {listaAreas.map((area) => {
                const cargosArea = (cargos ?? []).filter((cargo) => cargo.area_id === area.id);
                return (
                  <section key={area.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">{area.nome}</h2>
                      <form action={removerArea.bind(null, id, area.id)}>
                        <button title="Remover área e seus cargos" className="text-muted-foreground hover:text-negative"><Trash2 className="size-4" /></button>
                      </form>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {cargosArea.map((cargo) => (
                        <li key={cargo.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">{cargo.nome}</span>
                          <span className="flex items-center gap-3"><strong>{cargo.quantidade}</strong><form action={removerCargo.bind(null, id, cargo.id)}><button title="Remover cargo" className="text-muted-foreground hover:text-negative"><Trash2 className="size-3.5" /></button></form></span>
                        </li>
                      ))}
                    </ul>
                    <form action={adicionarCargo.bind(null, id, area.id)} className="mt-4 grid grid-cols-[1fr_72px_auto] gap-2">
                      <input name="nome" required placeholder="Cargo" className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
                      <input name="quantidade" required type="number" min="0" defaultValue="1" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
                      <button className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-muted">Adicionar</button>
                    </form>
                  </section>
                );
              })}
            </div>
          ) : <EstadoVazio icone={<UsersRound className="size-5" />} texto="Nenhuma área cadastrada para esta empresa." />}
        </CardBody>
      </Card>
    </div>
  );
}

function EstadoVazio({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">{icone}{texto}</div>;
}
