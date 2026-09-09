"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

import {
  ajustarMesesRestantesContaFixa,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { ContaFixaAgrupada } from "@/lib/titulos";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoMesesRestantes({
  grupo,
  empresaId,
}: {
  grupo: ContaFixaAgrupada;
  empresaId: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(ajustarMesesRestantesContaFixa, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) {
      setAberto(false);
      router.refresh();
    }
  }, [estado, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-surface-muted"
        title="Alterar meses restantes"
      >
        <span className="tabular font-medium">{grupo.mesesRestantes}</span>
        <span className="text-muted-foreground">
          {grupo.mesesRestantes === 1 ? "mês" : "meses"}
        </span>
        <CalendarRange
          className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </button>

      <Modal
        aberto={aberto}
        titulo="Meses restantes"
        descricao={`${grupo.titulo.contraparte} — hoje restam ${grupo.mesesRestantes} mês(es)`}
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Parcelas atualizadas." />
          <input type="hidden" name="empresaId" value={empresaId} />
          <input type="hidden" name="tituloId" value={grupo.titulo.id} />
          <CampoTexto
            id={`meses-restantes-${grupo.titulo.id}`}
            name="mesesRestantes"
            tipo="number"
            rotulo="Quantidade de meses restantes *"
            required
            min={1}
            max={60}
            defaultValue={String(estado.valores?.mesesRestantes ?? grupo.mesesRestantes)}
            erro={estado.campos?.mesesRestantes}
            dica="Aumentar gera novas parcelas. Reduzir remove as futuras sem baixa."
          />
          <Rodape onCancelar={() => setAberto(false)} texto="Salvar" />
        </form>
      </Modal>
    </>
  );
}
