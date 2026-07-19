"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Plus } from "lucide-react";

import {
  salvarLancamento,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { PlanoConta } from "@/lib/types";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoLancamento({ contas }: { contas: PlanoConta[] }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarLancamento, ESTADO_INICIAL);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
        Novo lançamento
      </button>

      <Modal
        aberto={aberto}
        titulo="Novo lançamento"
        descricao="Movimentação já realizada de entrada ou saída do caixa"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="data"
              rotulo="Data"
              tipo="date"
              defaultValue={estado.valores?.data ?? hoje}
              required
              erro={estado.campos?.data}
            />
            <CampoSelect
              id="tipo"
              rotulo="Tipo"
              opcoes={[
                { valor: "entrada", rotulo: "Entrada" },
                { valor: "saida", rotulo: "Saída" },
              ]}
              defaultValue={estado.valores?.tipo}
              erro={estado.campos?.tipo}
            />
          </div>

          <CampoTexto
            id="descricao"
            rotulo="Descrição"
            placeholder="Ex.: Recebimento de hospedagem"
            required
            defaultValue={estado.valores?.descricao}
            erro={estado.campos?.descricao}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="valor"
              rotulo="Valor"
              inputMode="decimal"
              placeholder="0,00"
              dica="Sempre positivo — o tipo define o sinal"
              defaultValue={estado.valores?.valor}
              required
              erro={estado.campos?.valor}
            />
            <CampoTexto
              id="contraparte"
              rotulo="Cliente / fornecedor"
              placeholder="Opcional"
              defaultValue={estado.valores?.contraparte}
              erro={estado.campos?.contraparte}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id="planoContaId"
              rotulo="Classificação"
              opcoes={[
                { valor: "", rotulo: "— sem classificação —" },
                ...contas.map((c) => ({
                  valor: c.id,
                  rotulo: `${c.codigo} ${c.nome}`,
                })),
              ]}
              defaultValue={estado.valores?.planoContaId}
              erro={estado.campos?.planoContaId}
            />
            <CampoTexto
              id="documento"
              rotulo="Documento"
              placeholder="Opcional"
              defaultValue={estado.valores?.documento}
              erro={estado.campos?.documento}
            />
          </div>

          <Rodape onCancelar={() => setAberto(false)} />
        </form>
      </Modal>
    </>
  );
}

export function Aviso({ estado }: { estado: EstadoFormulario }) {
  if (estado.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-3 py-2.5"
      >
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-positive"
          aria-hidden
        />
        <p className="text-sm text-positive">Lançamento salvo.</p>
      </div>
    );
  }

  if (estado.erro) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5"
      >
        <Info
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">{estado.erro}</p>
      </div>
    );
  }

  return null;
}

export function Rodape({ onCancelar }: { onCancelar: () => void }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-40"
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
