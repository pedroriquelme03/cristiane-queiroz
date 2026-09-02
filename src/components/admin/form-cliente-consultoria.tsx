"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { cadastrarClienteConsultoria } from "@/app/(app)/admin/clientes/acoes";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";

type EstadoForm = { error?: string; ok?: boolean } | null;

export function FormClienteConsultoria() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(cadastrarClienteConsultoria, null as EstadoForm);

  useEffect(() => {
    if (estado?.ok) {
      setAberto(false);
      router.refresh();
    }
  }, [estado, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90"
      >
        <Plus className="size-4" aria-hidden />
        Cliente
      </button>

      <Modal
        aberto={aberto}
        titulo="Novo cliente de consultoria"
        descricao="Informe nome, CPF ou CNPJ e o valor mensal pago"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          {estado?.error ? (
            <p className="text-sm text-negative" role="alert">
              {estado.error}
            </p>
          ) : null}

          <CampoTexto
            id="nome"
            rotulo="Nome *"
            required
            placeholder="Razão social ou nome"
          />
          <CampoTexto
            id="documento"
            rotulo="CPF ou CNPJ *"
            required
            inputMode="numeric"
            placeholder="Somente números"
            dica="11 dígitos para CPF, 14 para CNPJ"
          />
          <CampoMoeda id="valor_mensal" name="valor_mensal" rotulo="Valor mensal *" required />

          <Rodape onCancelar={() => setAberto(false)} />
        </form>
      </Modal>
    </>
  );
}

function Rodape({ onCancelar }: { onCancelar: () => void }) {
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
        {pending ? "Salvando…" : "Cadastrar"}
      </button>
    </div>
  );
}
