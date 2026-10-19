"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, ClipboardList, Info } from "lucide-react";

import {
  atualizarExecucaoDiagnostico,
  type EstadoExecucaoDiagnostico,
} from "@/app/(app)/diagnostico/acoes";
import { CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { Modal } from "@/components/ui/modal";
import {
  PROGRESSO_DIAGNOSTICO,
  ROTULO_AREA,
  ROTULO_PROGRESSO_DIAGNOSTICO,
} from "@/lib/avaliacoes";
import type { DiagnosticoItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO: EstadoExecucaoDiagnostico = {};

/** Registra execução por área — separado da nota de avaliação. */
export function DialogoExecucaoDiagnostico({ item }: { item: DiagnosticoItem }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(atualizarExecucaoDiagnostico, ESTADO);
  const hoje = new Date().toISOString().slice(0, 10);
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  useEffect(() => {
    if (estado.ok) {
      const t = setTimeout(() => setAberto(false), 600);
      return () => clearTimeout(t);
    }
  }, [estado.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        <ClipboardList className="size-3.5" aria-hidden />
        {item.progresso > 0 ? "Atualizar execução" : "Registrar execução"}
      </button>

      <Modal
        aberto={aberto}
        titulo={`Execução · ${ROTULO_AREA[item.categoria]}`}
        descricao="O que foi feito, data e andamento. A nota de avaliação não é alterada."
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4" key={`${item.id}-${aberto}`}>
          <input type="hidden" name="itemId" value={item.id} />
          <Aviso estado={estado} />

          <p className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Nota de avaliação atual:{" "}
            <span className="font-medium text-foreground">{item.nota}/100</span>
            {item.observacao ? ` · ${item.observacao}` : null}
          </p>

          <div>
            <label htmlFor={`realizado-${item.id}`} className="text-sm font-medium">
              O que foi realizado
            </label>
            <textarea
              id={`realizado-${item.id}`}
              name="realizado"
              rows={4}
              maxLength={4000}
              defaultValue={String(valor("realizado", item.realizado))}
              placeholder="Descreva as ações executadas nesta área"
              className={cn(
                "mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
                estado.campos?.realizado ? "border-negative" : "border-border",
              )}
            />
            {estado.campos?.realizado ? (
              <p className="mt-1 text-xs text-negative">{estado.campos.realizado}</p>
            ) : null}
          </div>

          <CampoData
            id={`data-${item.id}`}
            name="dataRealizacao"
            rotulo="Data de realização"
            defaultValue={String(
              valor("dataRealizacao", item.dataRealizacao ?? hoje) || hoje,
            )}
            erro={estado.campos?.dataRealizacao}
          />

          <fieldset>
            <legend className="text-sm font-medium">Andamento</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {PROGRESSO_DIAGNOSTICO.map((opcao) => (
                <label key={opcao.valor} className="cursor-pointer">
                  <input
                    type="radio"
                    name="progresso"
                    value={opcao.valor}
                    defaultChecked={
                      Number(valor("progresso", item.progresso)) === opcao.valor
                    }
                    className="peer sr-only"
                  />
                  <span className="flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                    {opcao.rotulo}
                  </span>
                </label>
              ))}
            </div>
            {estado.campos?.progresso ? (
              <p className="mt-1 text-xs text-negative">{estado.campos.progresso}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Status atual: {ROTULO_PROGRESSO_DIAGNOSTICO[item.progresso]}
              </p>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
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

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-40"
    >
      {pending ? "Salvando…" : "Salvar execução"}
    </button>
  );
}

function Aviso({ estado }: { estado: EstadoExecucaoDiagnostico }) {
  if (!estado.ok && !estado.erro) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
        estado.ok
          ? "border-positive/20 bg-positive-soft text-positive"
          : "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {estado.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <p className="text-sm">{estado.ok ? "Execução salva." : estado.erro}</p>
    </div>
  );
}
