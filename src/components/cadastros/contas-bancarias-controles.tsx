"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  desativarContaBancaria,
  salvarContaBancaria,
  type EstadoContaBancaria,
} from "@/app/(app)/cadastros/contas-bancarias/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { Modal } from "@/components/ui/modal";
import type { ContaBancaria } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoContaBancaria = {};

const TIPOS = [
  { valor: "corrente", rotulo: "Conta corrente" },
  { valor: "poupanca", rotulo: "Poupança" },
  { valor: "caixa", rotulo: "Caixa" },
  { valor: "aplicacao", rotulo: "Aplicação" },
];

export function DialogoNovaContaBancaria({ empresaId }: { empresaId: string }) {
  return <DialogoContaBancaria empresaId={empresaId} />;
}

export function EditarContaBancaria({
  conta,
  empresaId,
}: {
  conta: ContaBancaria;
  empresaId: string;
}) {
  return <DialogoContaBancaria empresaId={empresaId} conta={conta} />;
}

function DialogoContaBancaria({
  empresaId,
  conta,
}: {
  empresaId: string;
  conta?: ContaBancaria;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarContaBancaria, ESTADO_INICIAL);
  const editando = Boolean(conta);
  const sufixo = conta?.id ?? "nova";
  const hoje = new Date().toISOString().slice(0, 10);
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  useEffect(() => {
    if (estado.ok) setAberto(false);
  }, [estado.ok]);

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
        {editando ? "Editar" : "Nova conta"}
      </button>

      <Modal
        aberto={aberto}
        titulo={editando ? "Editar conta" : "Nova conta bancária / caixa"}
        descricao="Saldo inicial e data de referência alimentam o fluxo de caixa sem duplicar movimentações."
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4" key={conta?.id ?? "nova"}>
          {estado.erro ? <p className="text-sm text-negative">{estado.erro}</p> : null}
          {estado.ok ? (
            <p className="flex items-center gap-1.5 text-sm text-positive">
              <CheckCircle2 className="size-4" aria-hidden />
              Conta salva.
            </p>
          ) : null}
          <input type="hidden" name="empresaId" value={empresaId} />
          {conta ? <input type="hidden" name="id" value={conta.id} /> : null}

          <CampoTexto
            id={`nome-${sufixo}`}
            name="nome"
            rotulo="Nome *"
            placeholder="Ex.: Conta principal Bradesco ou Caixa loja"
            required
            defaultValue={String(valor("nome", conta?.nome))}
            erro={estado.campos?.nome}
          />
          <CampoTexto
            id={`banco-${sufixo}`}
            name="banco"
            rotulo="Banco"
            placeholder="Opcional"
            defaultValue={String(valor("banco", conta?.banco ?? ""))}
          />
          <CampoSelect
            id={`tipo-${sufixo}`}
            name="tipo"
            rotulo="Tipo *"
            defaultValue={String(valor("tipo", conta?.tipo ?? "corrente"))}
            opcoes={TIPOS}
            erro={estado.campos?.tipo}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoMoeda
              id={`saldo-inicial-${sufixo}`}
              name="saldoInicial"
              rotulo="Saldo inicial *"
              defaultValue={
                conta
                  ? conta.saldoInicial
                  : Number(valor("saldoInicial", "0") || 0) || 0
              }
              erro={estado.campos?.saldoInicial}
              dica="Saldo na data de referência (não muda a cada baixa)."
            />
            <CampoData
              id={`data-saldo-${sufixo}`}
              name="dataSaldoInicial"
              rotulo="Data de referência *"
              required
              defaultValue={String(
                valor("dataSaldoInicial", conta?.dataSaldoInicial ?? hoje) || hoje,
              )}
              erro={estado.campos?.dataSaldoInicial}
              dica="A partir desta data as movimentações atualizam o saldo."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <BotaoSalvar editando={editando} />
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RemoverContaBancaria({
  conta,
  empresaId,
}: {
  conta: ContaBancaria;
  empresaId: string;
}) {
  const [estado, acao] = useActionState(desativarContaBancaria, ESTADO_INICIAL);

  return (
    <form
      action={acao}
      onSubmit={(event) => {
        if (!confirm(`Remover a conta "${conta.nome}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="id" value={conta.id} />
      <button
        type="submit"
        title="Remover conta"
        aria-label={`Remover ${conta.nome}`}
        className={cn(
          "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-negative-soft hover:text-negative",
          estado.erro && "text-negative",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
      {estado.erro ? <p className="mt-1 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}

function BotaoSalvar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
    >
      {pending ? "Salvando…" : editando ? "Salvar alterações" : "Salvar"}
    </button>
  );
}
