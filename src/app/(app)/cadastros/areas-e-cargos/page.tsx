import { Plus, Trash2, UsersRound } from "lucide-react";

import {
  adicionarArea,
  removerArea,
  removerCargo,
} from "@/app/(app)/empresa/actions";
import { FormCargo } from "@/components/empresa/form-cargo";
import {
  AvisoSemEmpresa,
  BotaoIconeCadastro,
  EstadoVazioCadastro,
  PainelCadastro,
} from "@/components/cadastros/ui";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export default async function CadastroAreasCargosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [sessao, params] = await Promise.all([getSessao(), searchParams]);
  const empresaId = empresaAtiva(sessao, params.empresa);
  const podeEditar = Boolean(empresaId);

  if (!empresaId) {
    return <AvisoSemEmpresa />;
  }

  const supabase = await createClient();
  const { data: areas, error: areasError } = await supabase
    .from("estrutura_areas")
    .select("id, nome, ordem")
    .eq("empresa_id", empresaId)
    .order("ordem")
    .order("nome");

  if (areasError) {
    return <p className="text-sm text-destructive">Não foi possível carregar as áreas.</p>;
  }

  const listaAreas = areas ?? [];
  const { data: cargos, error: cargosError } = listaAreas.length
    ? await supabase
        .from("estrutura_cargos")
        .select("id, area_id, nome, quantidade, ordem")
        .eq("empresa_id", empresaId)
        .in(
          "area_id",
          listaAreas.map((area) => area.id),
        )
        .order("ordem")
        .order("nome")
    : { data: [], error: null };

  if (cargosError) {
    return <p className="text-sm text-destructive">Não foi possível carregar os cargos.</p>;
  }

  const listaCargos = cargos ?? [];
  const totalCargos = listaCargos.length;
  const totalPosicoes = listaCargos.reduce((soma, cargo) => soma + cargo.quantidade, 0);

  return (
    <PainelCadastro
      titulo="Áreas e cargos"
      valor={String(listaAreas.length)}
      descricao={`${totalCargos} cargos · ${totalPosicoes} posições`}
      icone={<UsersRound className="size-4" aria-hidden />}
      acao={podeEditar ? <FormArea empresaId={empresaId} /> : null}
    >
      {listaAreas.length ? (
        <div className="space-y-3">
          {listaAreas.map((area) => {
            const cargosArea = listaCargos.filter((cargo) => cargo.area_id === area.id);
            const total = cargosArea.reduce((soma, cargo) => soma + cargo.quantidade, 0);
            return (
              <section key={area.id} className="rounded-lg border border-border px-3 py-3">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{area.nome}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{total} pessoas nesta área</p>
                  </div>
                  {podeEditar ? (
                    <form action={removerArea.bind(null, empresaId, area.id)}>
                      <BotaoIconeCadastro title="Remover área e cargos">
                        <Trash2 className="size-3.5" aria-hidden />
                      </BotaoIconeCadastro>
                    </form>
                  ) : null}
                </header>
                <ul className="mt-3 space-y-1.5">
                  {cargosArea.length ? (
                    cargosArea.map((cargo) => (
                      <li key={cargo.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">{cargo.nome}</span>
                        <span className="flex items-center gap-2">
                          <strong className="tabular">{cargo.quantidade}</strong>
                          {podeEditar ? (
                            <form action={removerCargo.bind(null, empresaId, cargo.id)}>
                              <button
                                type="submit"
                                title="Remover cargo"
                                aria-label="Remover cargo"
                                className="text-muted-foreground hover:text-negative"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </form>
                          ) : null}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</li>
                  )}
                </ul>
                {podeEditar ? <FormCargo empresaId={empresaId} areaId={area.id} /> : null}
              </section>
            );
          })}
        </div>
      ) : (
        <EstadoVazioCadastro
          icone={<UsersRound className="size-5" />}
          texto="Nenhuma área ou cargo cadastrado."
        />
      )}
    </PainelCadastro>
  );
}

function FormArea({ empresaId }: { empresaId: string }) {
  return (
    <details>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
        <Plus className="size-4" aria-hidden />
        Área
      </summary>
      <form action={adicionarArea.bind(null, empresaId)} className="mt-3 grid min-w-0 gap-2">
        <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
          Nome da área
          <input
            name="nome"
            required
            placeholder="Ex.: Financeiro"
            className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          Adicionar
        </button>
      </form>
    </details>
  );
}
