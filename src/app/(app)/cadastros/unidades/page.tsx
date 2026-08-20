import { Building2, MapPin, Plus, Trash2 } from "lucide-react";

import { adicionarUnidade, removerUnidade } from "@/app/(app)/empresa/actions";
import {
  AvisoSemEmpresa,
  BotaoIconeCadastro,
  EstadoVazioCadastro,
  PainelCadastro,
} from "@/components/cadastros/ui";
import { Badge } from "@/components/ui/badge";
import { CampoSelect } from "@/components/ui/campo";
import { empresaAtiva } from "@/lib/empresa-ativa";
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

export default async function CadastroUnidadesPage({
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
  const { data: unidades, error } = await supabase
    .from("unidades")
    .select("id, nome, tipo, cidade, uf")
    .eq("empresa_id", empresaId)
    .order("nome");

  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar as unidades.</p>;
  }

  const lista = unidades ?? [];

  return (
    <PainelCadastro
      titulo="Unidades e filiais"
      valor={String(lista.length)}
      descricao={lista.length === 1 ? "1 local cadastrado" : `${lista.length} locais cadastrados`}
      icone={<Building2 className="size-4" aria-hidden />}
      acao={podeEditar ? <FormUnidade empresaId={empresaId} /> : null}
    >
      {lista.length ? (
        <div className="space-y-2">
          {lista.map((unidade) => (
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
                    <form action={removerUnidade.bind(null, empresaId, unidade.id)}>
                      <BotaoIconeCadastro title="Remover unidade">
                        <Trash2 className="size-3.5" aria-hidden />
                      </BotaoIconeCadastro>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EstadoVazioCadastro icone={<Building2 className="size-5" />} texto="Nenhuma unidade cadastrada." />
      )}
    </PainelCadastro>
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
          <input
            name="nome"
            required
            placeholder="Ex.: Filial Centro"
            className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
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
            <input
              name="cidade"
              placeholder="Cidade"
              className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            UF
            <input
              name="uf"
              maxLength={2}
              placeholder="UF"
              className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground uppercase"
            />
          </label>
        </div>
        <button className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          Adicionar unidade
        </button>
      </form>
    </details>
  );
}
