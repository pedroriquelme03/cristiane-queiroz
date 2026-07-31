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
  if (!admin) agora.setDate(agora.getDate() + 1);
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
        {admin ? "Nova reunião" : "Solicitar nova reunião"}
      </button>

      <Modal
        aberto={aberto}
        titulo={admin ? "Nova reunião" : "Solicitar nova reunião"}
        descricao={admin ? "Registro de reunião, treinamento, ata e gravação" : "Informe uma data desejada para a consultoria avaliar"}
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} admin={admin} />

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

          <div className={admin ? "grid gap-4 sm:grid-cols-2" : undefined}>
            {admin ? (
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
            ) : null}
            <CampoTexto
              id="data"
              rotulo={admin ? "Data e hora" : "Data e hora desejadas"}
              tipo="datetime-local"
              defaultValue={estado.valores?.data ?? dataPadrao}
              erro={estado.campos?.data}
              required
            />
          </div>

          <CampoTexto
            id="titulo"
            rotulo={admin ? "Título" : "Assunto"}
            placeholder={admin ? "Ex.: Reunião mensal de resultados" : "Ex.: Dúvidas sobre o fluxo de caixa"}
            defaultValue={estado.valores?.titulo}
            erro={estado.campos?.titulo}
            required
          />

          {admin ? (
            <CampoTexto
              id="participantes"
              rotulo="Participantes"
              placeholder="Consultoria CQ, sócios e financeiro"
              defaultValue={estado.valores?.participantes}
              erro={estado.campos?.participantes}
              required
            />
          ) : null}

          <CampoArea
            id="ata"
            rotulo={admin ? "Pauta / ata" : "Motivo ou observações"}
            placeholder={admin ? "Assuntos previstos, decisões tomadas ou próximos passos." : "Descreva brevemente o assunto que deseja tratar."}
            defaultValue={estado.valores?.ata}
            erro={estado.campos?.ata}
          />

          {admin ? (
            <CampoTexto
              id="gravacaoUrl"
              rotulo="Link da gravação"
              tipo="url"
              placeholder="https://..."
              defaultValue={estado.valores?.gravacaoUrl}
              erro={estado.campos?.gravacaoUrl}
            />
          ) : null}

          <Rodape onCancelar={() => setAberto(false)} texto={admin ? "Salvar" : "Enviar solicitação"} />
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

function Aviso({ estado, admin }: { estado: EstadoReuniao; admin: boolean }) {
  if (estado.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-3 py-2.5"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
        <p className="text-sm text-positive">
          {admin ? "Reunião registrada." : "Solicitação enviada para a consultoria."}
        </p>
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

function Rodape({ onCancelar, texto }: { onCancelar: () => void; texto: string }) {
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
        {pending ? "Salvando..." : texto}
      </button>
    </div>
  );
}
