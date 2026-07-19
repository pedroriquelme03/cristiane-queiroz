"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import {
  salvarTitulo,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { PlanoConta, Titulo } from "@/lib/types";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoTitulo({
  tipo,
  contas,
}: {
  tipo: Titulo["tipo"];
  contas: PlanoConta[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarTitulo, ESTADO_INICIAL);

  const ehPagar = tipo === "pagar";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
        {ehPagar ? "Nova conta a pagar" : "Nova conta a receber"}
      </button>

      <Modal
        aberto={aberto}
        titulo={ehPagar ? "Nova conta a pagar" : "Nova conta a receber"}
        descricao="Obrigação ou direito com data de vencimento"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} />
          <input type="hidden" name="tipo" value={tipo} />

          <CampoTexto
            id="contraparte"
            rotulo={ehPagar ? "Fornecedor" : "Cliente"}
            required
            defaultValue={estado.valores?.contraparte}
            erro={estado.campos?.contraparte}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="emissao"
              rotulo="Emissão"
              tipo="date"
              defaultValue={estado.valores?.emissao}
              erro={estado.campos?.emissao}
            />
            <CampoTexto
              id="vencimento"
              rotulo="Vencimento"
              tipo="date"
              required
              defaultValue={estado.valores?.vencimento}
              erro={estado.campos?.vencimento}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="valor"
              rotulo="Valor"
              inputMode="decimal"
              placeholder="0,00"
              required
              defaultValue={estado.valores?.valor}
              erro={estado.campos?.valor}
            />
            <CampoTexto
              id="valorPago"
              rotulo="Valor já pago"
              inputMode="decimal"
              placeholder="0,00"
              dica="A situação do título vem daqui"
              defaultValue={estado.valores?.valorPago}
              erro={estado.campos?.valorPago}
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
