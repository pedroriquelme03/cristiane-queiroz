"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, ClipboardCheck, Info, Pencil, Plus } from "lucide-react";

import {
  salvarAvaliacao,
  type EstadoAvaliacao,
} from "@/app/(app)/acoes-avaliacoes";
import { CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { AREAS_AVALIACAO, type TipoAvaliacao } from "@/lib/avaliacoes";
import { cn } from "@/lib/utils";

interface AvaliacaoInicial {
  competencia?: string;
  notas?: Partial<Record<(typeof AREAS_AVALIACAO)[number]["id"], number>>;
  observacoes?: string;
  observacoesAreas?: Partial<Record<(typeof AREAS_AVALIACAO)[number]["id"], string>>;
}

const ESTADO_INICIAL: EstadoAvaliacao = {};

export function DialogoAvaliacao({
  tipo,
  empresaId,
  inicial,
  modo = "novo",
}: {
  tipo: TipoAvaliacao;
  empresaId?: string;
  inicial?: AvaliacaoInicial;
  /** Editar preserva a competência do snapshot e só altera notas/observações. */
  modo?: "novo" | "editar";
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarAvaliacao, ESTADO_INICIAL);
  const diagnostico = tipo === "diagnostico";
  const editando = modo === "editar";
  const titulo = editando
    ? diagnostico
      ? "Editar diagnóstico"
      : "Editar avaliação"
    : diagnostico
      ? "Novo diagnóstico"
      : "Nova avaliação";
  const agora = new Date();
  const competenciaPadrao =
    inicial?.competencia?.slice(0, 7) ??
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (estado.ok) {
      const t = setTimeout(() => setAberto(false), 700);
      return () => clearTimeout(t);
    }
  }, [estado.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!empresaId}
        title={!empresaId ? "Selecione uma empresa" : titulo}
        className={cn(
          "flex items-center gap-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40",
          editando
            ? "text-xs text-muted-foreground hover:text-foreground"
            : "rounded-lg bg-brand px-3 py-2 text-sm text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {titulo}
      </button>

      <Modal
        aberto={aberto}
        titulo={titulo}
        descricao={
          editando
            ? "Altera apenas a avaliação (notas e observações). A execução por área fica intacta."
            : "Registre notas de 0 a 100 para cada área da empresa"
        }
        onFechar={() => setAberto(false)}
        className="max-w-2xl"
      >
        <form action={acao} className="space-y-5" key={`${modo}-${competenciaPadrao}-${aberto}`}>
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          <Aviso estado={estado} diagnostico={diagnostico} />

          {editando ? (
            <>
              <input type="hidden" name="competencia" value={competenciaPadrao} />
              <p className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Competência:{" "}
                <span className="font-medium text-foreground">{competenciaPadrao}</span>
              </p>
            </>
          ) : (
            <CampoTexto
              id="competencia"
              rotulo="Competência"
              tipo="month"
              defaultValue={estado.valores?.competencia ?? competenciaPadrao}
              erro={estado.campos?.competencia}
              required
            />
          )}

          <div className="space-y-3">
            {AREAS_AVALIACAO.map((area) => {
              const nomeNota = `nota_${area.id}`;
              const nomeObservacao = `observacao_${area.id}`;
              return (
                <fieldset
                  key={area.id}
                  className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-[130px_92px_1fr] sm:items-start"
                >
                  <legend className="sr-only">{area.rotulo}</legend>
                  <span className="pt-2 text-sm font-medium">{area.rotulo}</span>
                  <CampoTexto
                    id={nomeNota}
                    rotulo="Nota"
                    tipo="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={
                      estado.valores?.[nomeNota] ?? inicial?.notas?.[area.id] ?? 50
                    }
                    erro={estado.campos?.[nomeNota]}
                    required
                  />
                  {diagnostico ? (
                    <CampoTexto
                      id={nomeObservacao}
                      rotulo="Observação"
                      placeholder="Evidência ou próximo passo"
                      defaultValue={
                        estado.valores?.[nomeObservacao] ??
                        inicial?.observacoesAreas?.[area.id] ??
                        ""
                      }
                    />
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">
                      Avalie controles, rotina e consistência desta área.
                    </p>
                  )}
                </fieldset>
              );
            })}
          </div>

          {diagnostico ? (
            <CampoArea
              id="observacoes"
              rotulo="Conclusão geral"
              placeholder="Síntese do diagnóstico e prioridades identificadas"
              defaultValue={estado.valores?.observacoes ?? inicial?.observacoes ?? ""}
            />
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs text-muted-foreground">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              A maturidade geral será a média arredondada das oito áreas.
            </div>
          )}

          <Rodape onCancelar={() => setAberto(false)} />
        </form>
      </Modal>
    </>
  );
}

function CampoArea({
  id,
  rotulo,
  ...resto
}: {
  id: string;
  rotulo: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name">) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <textarea
        id={id}
        name={id}
        rows={4}
        className={cn(
          "mt-1 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm",
          "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
        )}
        {...resto}
      />
    </div>
  );
}

function Aviso({
  estado,
  diagnostico,
}: {
  estado: EstadoAvaliacao;
  diagnostico: boolean;
}) {
  if (!estado.ok && !estado.erro && !estado.campos?.empresaId) return null;
  const sucesso = Boolean(estado.ok);
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
        sucesso
          ? "border-positive/20 bg-positive-soft text-positive"
          : "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {sucesso ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <p className="text-sm">
        {sucesso
          ? `${diagnostico ? "Diagnóstico" : "Avaliação"} salvo com sucesso.`
          : estado.erro ?? estado.campos?.empresaId}
      </p>
    </div>
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
        {pending ? "Salvando..." : "Salvar avaliação"}
      </button>
    </div>
  );
}
