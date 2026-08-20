import { Plus, Trash2, Users } from "lucide-react";

import {
  adicionarColaborador,
  atualizarColaboradores,
  removerColaborador,
} from "@/app/(app)/empresa/actions";
import {
  AvisoSemEmpresa,
  BotaoIconeCadastro,
  EstadoVazioCadastro,
  PainelCadastro,
} from "@/components/cadastros/ui";
import { Card, CardBody } from "@/components/ui/card";
import { CampoData } from "@/components/ui/campo-data";
import { getColaboradores } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { data as formatarData } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export default async function CadastroColaboradoresPage({
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
  const [{ data: empresa, error: empresaError }, { data: cargos }] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, qtd_funcionarios")
      .eq("id", empresaId)
      .maybeSingle(),
    supabase.from("estrutura_cargos").select("quantidade").eq("empresa_id", empresaId),
  ]);

  if (empresaError || !empresa) {
    return <p className="text-sm text-destructive">Não foi possível carregar os colaboradores.</p>;
  }

  const totalPosicoes = (cargos ?? []).reduce((soma, cargo) => soma + cargo.quantidade, 0);
  const totalColaboradores = Math.max(empresa.qtd_funcionarios ?? 0, totalPosicoes);
  const pessoas = await getColaboradores(empresa.id);

  return (
    <div className="space-y-4">
      <PainelCadastro
        titulo="Total de colaboradores"
        valor={String(totalColaboradores)}
        descricao={`${totalPosicoes} alocados em cargos`}
        icone={<Users className="size-4" aria-hidden />}
        acao={
          podeEditar ? (
            <FormTotalColaboradores
              empresaId={empresa.id}
              valorAtual={totalColaboradores}
              minimo={totalPosicoes}
            />
          ) : null
        }
      >
        <p className="text-sm text-muted-foreground">
          Use esse número como visão geral da equipe. Os cargos em Áreas e cargos detalham onde as
          pessoas estão alocadas.
        </p>
      </PainelCadastro>

      <Card>
        <CardBody className="space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Equipe com aniversário</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre nome e data de nascimento — os aniversariantes do dia aparecem na tela de
                início.
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
                <li
                  key={pessoa.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{pessoa.nome}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-muted-foreground">
                      {formatarData(pessoa.dataNascimento)}
                    </span>
                    {podeEditar ? (
                      <form action={removerColaborador.bind(null, empresa.id, pessoa.id)}>
                        <BotaoIconeCadastro title="Remover colaborador">
                          <Trash2 className="size-3.5" aria-hidden />
                        </BotaoIconeCadastro>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazioCadastro
              icone={<Users className="size-5" />}
              texto="Nenhuma pessoa cadastrada com data de nascimento."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FormTotalColaboradores({
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
        Ajustar total
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
