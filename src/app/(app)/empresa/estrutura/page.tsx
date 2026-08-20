import type { ReactNode } from "react";
import { Building2, MapPin, Plus, Trash2, Users, UsersRound } from "lucide-react";

import {
  adicionarArea,
  adicionarColaborador,
  adicionarUnidade,
  atualizarColaboradores,
  removerArea,
  removerCargo,
  removerColaborador,
  removerUnidade,
} from "@/app/(app)/empresa/actions";
import { FormCargo } from "@/components/empresa/form-cargo";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { CampoSelect } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { data as formatarData } from "@/lib/format";
import { getColaboradores } from "@/lib/dados";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

const TIPO_UNIDADE = {
  matriz: "Matriz",
  filial: "Filial",
  cd: "Centro de distribuição",
  loja: "Loja",
} as const;

const TIPOS_UNIDADE = [
  ["matriz", "Matriz"],
  ["filial", "Filial"],
  ["loja", "Loja"],
  ["cd", "Centro de distribuição"],
] as const;

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
  const podeEditar = Boolean(empresaId);

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
          Selecione um cliente na aba Dados gerais para consultar a estrutura.
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
    return <p className="text-sm text-destructive">Não foi possível carregar a equipe por área.</p>;
  }

  const listaCargos = cargos ?? [];
  const totalCargos = listaCargos.length;
  const totalPosicoes = listaCargos.reduce((soma, cargo) => soma + cargo.quantidade, 0);
  const totalColaboradores = Math.max(empresa.qtd_funcionarios ?? 0, totalPosicoes);
  const pessoas = await getColaboradores(empresa.id);

  return (
    <div className="space-y-4">
    <div className="grid min-w-0 gap-4 xl:grid-cols-3">
      <PainelEstrutura
        titulo="Colaboradores"
        valor={String(totalColaboradores)}
        descricao={`${totalPosicoes} alocados em cargos`}
        icone={<Users className="size-4" aria-hidden />}
        acao={podeEditar ? (
          <FormColaboradores
            empresaId={empresa.id}
            valorAtual={totalColaboradores}
            minimo={totalPosicoes}
          />
        ) : null}
      >
        <p className="text-sm text-muted-foreground">
          Use esse número como visão geral da equipe. Os cargos abaixo detalham onde essas pessoas estão alocadas.
        </p>
      </PainelEstrutura>

      <PainelEstrutura
        titulo="Unidades e filiais"
        valor={String(listaUnidades.length)}
        descricao={listaUnidades.length === 1 ? "1 local cadastrado" : `${listaUnidades.length} locais cadastrados`}
        icone={<Building2 className="size-4" aria-hidden />}
        acao={podeEditar ? <FormUnidade empresaId={empresa.id} /> : null}
      >
        {listaUnidades.length ? (
          <div className="space-y-2">
            {listaUnidades.map((unidade) => (
              <div key={unidade.id} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{unidade.nome}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden />
                      {unidade.cidade ?? "Cidade não informada"}
                      {unidade.uf ? `/${unidade.uf}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tom={unidade.tipo === "matriz" ? "marca" : "neutro"}>
                      {TIPO_UNIDADE[unidade.tipo as keyof typeof TIPO_UNIDADE] ?? unidade.tipo}
                    </Badge>
                    {podeEditar ? (
                      <form action={removerUnidade.bind(null, empresa.id, unidade.id)}>
                        <BotaoIcone title="Remover unidade">
                          <Trash2 className="size-3.5" aria-hidden />
                        </BotaoIcone>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EstadoVazio icone={<Building2 className="size-5" />} texto="Nenhuma unidade cadastrada." />
        )}
      </PainelEstrutura>

      <PainelEstrutura
        titulo="Áreas e cargos"
        valor={String(listaAreas.length)}
        descricao={`${totalCargos} cargos · ${totalPosicoes} posições`}
        icone={<UsersRound className="size-4" aria-hidden />}
        acao={podeEditar ? <FormArea empresaId={empresa.id} /> : null}
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
                      <div className="flex shrink-0 items-center gap-1.5">
                        <form action={removerArea.bind(null, empresa.id, area.id)}>
                          <BotaoIcone title="Remover área e cargos">
                            <Trash2 className="size-3.5" aria-hidden />
                          </BotaoIcone>
                        </form>
                      </div>
                    ) : null}
                  </header>
                    <ul className="mt-3 space-y-1.5">
                    {cargosArea.length ? cargosArea.map((cargo) => (
                      <li key={cargo.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-muted-foreground">{cargo.nome}</span>
                        <span className="flex items-center gap-2">
                          <strong className="tabular">{cargo.quantidade}</strong>
                          {podeEditar ? (
                            <form action={removerCargo.bind(null, empresa.id, cargo.id)}>
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
                      )) : <li className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</li>}
                    </ul>
                    {podeEditar ? <FormCargo empresaId={empresa.id} areaId={area.id} /> : null}
                  </section>
                );
              })}
          </div>
        ) : (
          <EstadoVazio icone={<UsersRound className="size-5" />} texto="Nenhuma área ou cargo cadastrado." />
        )}
      </PainelEstrutura>
    </div>

    <Card>
      <CardBody className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Equipe com aniversário</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre nome e data de nascimento — os aniversariantes do dia aparecem na tela de início.
            </p>
          </div>
          {podeEditar ? (
            <details>
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
                <Plus className="size-4" aria-hidden />
                Pessoa
              </summary>
              <form
                action={adicionarColaborador.bind(null, empresa.id)}
                className="mt-3 grid min-w-[16rem] gap-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Nome
                  <input
                    name="nome"
                    required
                    placeholder="Nome completo"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <CampoData
                  id={`nasc-colab-${empresa.id}`}
                  name="data_nascimento"
                  rotulo="Nascimento"
                  required
                />
                <button
                  type="submit"
                  className="self-end rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90"
                >
                  Adicionar
                </button>
              </form>
            </details>
          ) : null}
        </header>

        {pessoas.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {pessoas.map((pessoa) => (
              <li key={pessoa.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{pessoa.nome}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular text-muted-foreground">{formatarData(pessoa.dataNascimento)}</span>
                  {podeEditar ? (
                    <form action={removerColaborador.bind(null, empresa.id, pessoa.id)}>
                      <BotaoIcone title="Remover colaborador">
                        <Trash2 className="size-3.5" aria-hidden />
                      </BotaoIcone>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVazio
            icone={<Users className="size-5" />}
            texto="Nenhuma pessoa cadastrada com data de nascimento."
          />
        )}
      </CardBody>
    </Card>
    </div>
  );
}

function PainelEstrutura({
  titulo,
  valor,
  descricao,
  icone,
  acao,
  children,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-[360px] min-w-0 overflow-hidden">
      <CardBody className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
          </div>
          <span className="text-muted-foreground">{icone}</span>
        </header>
        {acao ? <div className="min-w-0">{acao}</div> : null}
        <div className="min-w-0 max-h-[420px] overflow-y-auto pr-1">{children}</div>
      </CardBody>
    </Card>
  );
}

function FormColaboradores({
  empresaId,
  valorAtual,
  minimo,
}: {
  empresaId: string;
  valorAtual: number;
  minimo: number;
}) {
  return (
    <details>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
        <Plus className="size-4" aria-hidden />
        Colaboradores
      </summary>
      <form action={atualizarColaboradores.bind(null, empresaId)} className="mt-3 flex gap-2">
        <input
          name="qtd_funcionarios"
          required
          type="number"
          min={minimo}
          defaultValue={valorAtual}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          Salvar
        </button>
      </form>
    </details>
  );
}

function FormUnidade({ empresaId }: { empresaId: string }) {
  return (
    <details>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
        <Plus className="size-4" aria-hidden />
        Unidade
      </summary>
      <form action={adicionarUnidade.bind(null, empresaId)} className="mt-3 grid min-w-0 gap-3">
        <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
          Nome da unidade
          <input name="nome" required placeholder="Ex.: Filial Centro" className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
        </label>
        <CampoSelect
          id={`tipo-unidade-${empresaId}`}
          name="tipo"
          rotulo="Tipo de unidade"
          defaultValue="filial"
          opcoes={TIPOS_UNIDADE.map(([valor, rotulo]) => ({ valor, rotulo }))}
        />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px] gap-2">
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Cidade
            <input name="cidade" placeholder="Cidade" className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            UF
            <input name="uf" maxLength={2} placeholder="UF" className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground uppercase" />
          </label>
        </div>
        <button className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          Adicionar unidade
        </button>
      </form>
    </details>
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
          <input name="nome" required placeholder="Ex.: Financeiro" className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
        </label>
        <button className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          Adicionar
        </button>
      </form>
    </details>
  );
}

function BotaoIcone({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-negative-soft hover:text-negative"
    >
      {children}
    </button>
  );
}

function EstadoVazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
      {icone}
      {texto}
    </div>
  );
}
