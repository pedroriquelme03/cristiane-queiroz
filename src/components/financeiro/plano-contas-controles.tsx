"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Pencil, Plus, Trash2, WandSparkles } from "lucide-react";

import {
  carregarPlanoContasPadrao,
  desativarContaPlano,
  salvarContaPlano,
  type EstadoPlanoContas,
} from "@/app/(app)/financeiro/plano-de-contas/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { ROTULO_GRUPO_DRE, ROTULO_TIPO_CONTA } from "@/lib/plano-contas-padrao";
import type { PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO: EstadoPlanoContas = {};

export function DialogoNovaConta({ empresaId }: { empresaId: string }) {
  return <DialogoConta empresaId={empresaId} />;
}

export function EditarConta({ conta, empresaId }: { conta: PlanoConta; empresaId: string }) {
  return <DialogoConta empresaId={empresaId} conta={conta} />;
}

function DialogoConta({ empresaId, conta }: { empresaId: string; conta?: PlanoConta }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarContaPlano, ESTADO);
  const editando = Boolean(conta);
  const sufixo = conta?.id ?? "nova";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn(
          "flex items-center gap-1.5 font-medium",
          editando
            ? "text-xs text-muted-foreground hover:text-foreground"
            : "rounded-lg bg-brand px-3 py-1.5 text-xs text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
        {editando ? "Editar" : "Nova classificação"}
      </button>
      <Modal
        aberto={aberto}
        titulo={editando ? "Editar classificação" : "Nova classificação"}
        descricao={
          editando
            ? "Altere código, nome, tipo ou grupo da DRE desta linha"
            : "Conta do plano de contas usada em lançamentos e títulos"
        }
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4" key={conta?.id ?? "nova"}>
          <Aviso estado={estado} textoSucesso={editando ? "Classificação atualizada." : "Classificação salva."} />
          <input type="hidden" name="empresaId" value={empresaId} />
          {conta ? <input type="hidden" name="id" value={conta.id} /> : null}
          {editando ? (
            <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono text-sm tabular">{conta?.codigo}</p>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              O código é gerado automaticamente conforme o grupo DRE (ex.: 5.2.05).
            </p>
          )}
          <CampoTexto
            id={`nome-${sufixo}`}
            name="nome"
            rotulo="Nome"
            required
            placeholder="Aluguel"
            defaultValue={conta?.nome}
            erro={estado.campos?.nome}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id={`tipo-${sufixo}`}
              name="tipo"
              rotulo="Tipo"
              required
              defaultValue={conta?.tipo ?? "despesa"}
              opcoes={Object.entries(ROTULO_TIPO_CONTA).map(([valor, rotulo]) => ({ valor, rotulo }))}
              erro={estado.campos?.tipo}
            />
            <CampoSelect
              id={`grupo-dre-${sufixo}`}
              name="grupoDre"
              rotulo="Grupo DRE"
              required
              defaultValue={conta?.grupoDre ?? "despesa_administrativa"}
              opcoes={Object.entries(ROTULO_GRUPO_DRE).map(([valor, rotulo]) => ({ valor, rotulo }))}
              erro={estado.campos?.grupoDre}
              dica={editando ? undefined : "Define o prefixo do código sequencial"}
            />
          </div>
          <Rodape onCancelar={() => setAberto(false)} texto={editando ? "Salvar alterações" : "Salvar"} />
        </form>
      </Modal>
    </>
  );
}

export function BotaoPlanoPadrao({ empresaId }: { empresaId: string }) {
  const [estado, acao] = useActionState(carregarPlanoContasPadrao, ESTADO);
  return (
    <form action={acao} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="empresaId" value={empresaId} />
      <BotaoPadrao />
      {estado.erro ? <p className="text-xs text-negative">{estado.erro}</p> : null}
      {estado.ok ? <p className="text-xs text-positive">Plano padrão carregado.</p> : null}
    </form>
  );
}

function BotaoPadrao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-brand/50 disabled:opacity-50"
    >
      <WandSparkles className="size-3.5" aria-hidden />
      {pending ? "Carregando…" : "Carregar plano padrão"}
    </button>
  );
}

export function RemoverConta({ conta, empresaId }: { conta: PlanoConta; empresaId: string }) {
  const [estado, acao] = useActionState(desativarContaPlano, ESTADO);
  return (
    <form
      action={acao}
      onSubmit={(event) => {
        if (!confirm(`Remover a classificação "${conta.nome}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="id" value={conta.id} />
      <button type="submit" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative">
        <Trash2 className="size-3.5" aria-hidden />
        Remover
      </button>
      {estado.erro ? <p className="mt-1 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}

function Aviso({
  estado,
  textoSucesso = "Classificação salva.",
}: {
  estado: EstadoPlanoContas;
  textoSucesso?: string;
}) {
  if (estado.erro) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-negative/20 bg-negative-soft px-3 py-2 text-sm text-negative">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {estado.erro}
      </div>
    );
  }
  if (estado.ok) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg border border-positive/20 bg-positive/10 px-3 py-2 text-sm text-positive">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {textoSucesso}
      </div>
    );
  }
  return null;
}

function Rodape({ onCancelar, texto = "Salvar" }: { onCancelar: () => void; texto?: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50",
        )}
      >
        {pending ? "Salvando…" : texto}
      </button>
    </div>
  );
}
