"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

import {
  desativarContaBancaria,
  salvarContaBancaria,
  type EstadoContaBancaria,
} from "@/app/(app)/cadastros/contas-bancarias/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
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
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarContaBancaria, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) setAberto(false);
  }, [estado]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
        Nova conta
      </button>

      <Modal
        aberto={aberto}
        titulo="Nova conta bancária"
        descricao="Contas usadas no fluxo de caixa e nos lançamentos."
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          {estado.erro ? <p className="text-sm text-negative">{estado.erro}</p> : null}
          {estado.ok ? (
            <p className="flex items-center gap-1.5 text-sm text-positive">
              <CheckCircle2 className="size-4" aria-hidden />
              Conta salva.
            </p>
          ) : null}
          <input type="hidden" name="empresaId" value={empresaId} />
          <CampoTexto
            id="nome"
            name="nome"
            rotulo="Nome"
            placeholder="Ex.: Conta principal Bradesco"
            required
            erro={estado.campos?.nome}
          />
          <CampoTexto id="banco" name="banco" rotulo="Banco" placeholder="Opcional" />
          <CampoSelect
            id="tipo"
            name="tipo"
            rotulo="Tipo"
            defaultValue="corrente"
            opcoes={TIPOS}
            erro={estado.campos?.tipo}
          />
          <CampoTexto
            id="saldoInicial"
            name="saldoInicial"
            rotulo="Saldo inicial"
            tipo="number"
            step="0.01"
            defaultValue="0"
            erro={estado.campos?.saldoInicial}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <BotaoSalvar />
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
    <form action={acao}>
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
    </form>
  );
}

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}
