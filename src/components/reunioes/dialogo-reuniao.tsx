"use client";

import { useActionState, useState } from "react";
import type { TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Plus } from "lucide-react";

import { salvarReuniao, type EstadoReuniao } from "@/app/(app)/reunioes/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface EmpresaOpcao {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
}

const ESTADO_INICIAL: EstadoReuniao = {};

export function DialogoReuniao({
  empresas,
  empresaIdAtual,
  admin,
}: {
  empresas: EmpresaOpcao[];
  empresaIdAtual?: string;
  admin: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarReuniao, ESTADO_INICIAL);
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  const dataPadrao = agora.toISOString().slice(0, 16);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
      >
        <Plus className="size-4" aria-hidden />
        Nova reunião
      </button>

      <Modal
        aberto={aberto}
        titulo="Nova reunião"
        descricao="Registro de reunião, treinamento, ata e gravação"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} />

          {admin ? (
            <CampoSelect
              id="empresaId"
              rotulo="Empresa"
              defaultValue={estado.valores?.empresaId ?? empresaIdAtual ?? ""}
              opcoes={[
                { valor: "", rotulo: "Selecione uma empresa" },
                ...empresas.map((empresa) => ({
                  valor: empresa.id,
                  rotulo: empresa.razao_social ?? empresa.nome_fantasia ?? "Empresa sem nome",
                })),
              ]}
              erro={estado.campos?.empresaId}
            />
          ) : (
            <input type="hidden" name="empresaId" value={empresaIdAtual ?? ""} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id="tipo"
              rotulo="Tipo"
              defaultValue={estado.valores?.tipo ?? "reuniao"}
              opcoes={[
                { valor: "reuniao", rotulo: "Reunião" },
                { valor: "treinamento", rotulo: "Treinamento" },
              ]}
              erro={estado.campos?.tipo}
            />
            <CampoTexto
              id="data"
              rotulo="Data e hora"
              tipo="datetime-local"
              defaultValue={estado.valores?.data ?? dataPadrao}
              erro={estado.campos?.data}
              required
            />
          </div>

          <CampoTexto
            id="titulo"
            rotulo="Título"
            placeholder="Ex.: Reunião mensal de resultados"
            defaultValue={estado.valores?.titulo}
            erro={estado.campos?.titulo}
            required
          />

          <CampoTexto
            id="participantes"
            rotulo="Participantes"
            placeholder="Consultoria CQ, sócios e financeiro"
            defaultValue={estado.valores?.participantes}
            erro={estado.campos?.participantes}
            required
          />

          <CampoArea
            id="ata"
            rotulo="Pauta / ata"
            placeholder="Assuntos previstos, decisões tomadas ou próximos passos."
            defaultValue={estado.valores?.ata}
            erro={estado.campos?.ata}
          />

          <CampoTexto
            id="gravacaoUrl"
            rotulo="Link da gravação"
            tipo="url"
            placeholder="https://..."
            defaultValue={estado.valores?.gravacaoUrl}
            erro={estado.campos?.gravacaoUrl}
          />

          <Rodape onCancelar={() => setAberto(false)} />
        </form>
      </Modal>
    </>
  );
}

function CampoArea({
  id,
  rotulo,
  erro,
  ...resto
}: {
  id: string;
  rotulo: string;
  erro?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name" | "className">) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <textarea
        id={id}
        name={id}
        rows={4}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={cn(
          "mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
          erro ? "border-negative" : "border-border",
        )}
        {...resto}
      />
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function Aviso({ estado }: { estado: EstadoReuniao }) {
  if (estado.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-3 py-2.5"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
        <p className="text-sm text-positive">Reunião registrada.</p>
      </div>
    );
  }

  if (estado.erro) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{estado.erro}</p>
      </div>
    );
  }

  return null;
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
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
