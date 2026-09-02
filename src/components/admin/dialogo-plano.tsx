"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Pencil, Plus } from "lucide-react";

import { salvarPlano, type EstadoAdmin } from "@/app/(app)/admin/acoes";
import { CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { Plano } from "@/lib/types";

const ESTADO_INICIAL: EstadoAdmin = {};
/*  teste*/
/** Cria (sem plano) ou edita (com plano). */
export function DialogoPlano({ plano }: { plano?: Plano }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarPlano, ESTADO_INICIAL);

  const editando = Boolean(plano);
  const v = (campo: keyof Plano) => estado.valores?.[campo];

  return (
    <>
      {editando ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
        >
          <Plus className="size-3.5" aria-hidden />
          Novo plano
        </button>
      )}

      <Modal
        aberto={aberto}
        titulo={editando ? `Editar plano ${plano!.nome}` : "Novo plano"}
        descricao="Estes valores aparecem para o cliente na vitrine de planos"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          {estado.ok ? (
            <Faixa tom="ok" texto="Plano salvo." />
          ) : estado.erro ? (
            <Faixa tom="info" texto={estado.erro} />
          ) : null}

          {plano ? <input type="hidden" name="id" value={plano.id} /> : null}

          <CampoTexto
            id="nome"
            rotulo="Nome"
            required
            defaultValue={v("nome") ?? plano?.nome}
            erro={estado.campos?.nome}
          />
          <CampoTexto
            id="descricao"
            rotulo="Descrição"
            placeholder="Uma linha que resume o plano"
            defaultValue={v("descricao") ?? plano?.descricao}
            erro={estado.campos?.descricao}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id="precoMensal"
              rotulo="Preço mensal (R$)"
              inputMode="decimal"
              placeholder="0,00"
              required
              defaultValue={v("precoMensal") ?? plano?.precoMensal?.toString()}
              erro={estado.campos?.precoMensal}
            />
            <CampoTexto
              id="precoAnual"
              rotulo="Preço anual (R$)"
              inputMode="decimal"
              placeholder="Opcional"
              dica="Deixe em branco se não houver ciclo anual"
              defaultValue={v("precoAnual") ?? plano?.precoAnual?.toString() ?? ""}
              erro={estado.campos?.precoAnual}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              id="trialDias"
              rotulo="Teste grátis (dias)"
              inputMode="numeric"
              placeholder="30"
              dica="Novos clientes deste plano começam o teste com esta duração."
              defaultValue={v("trialDias") ?? plano?.trialDias?.toString() ?? "30"}
              erro={estado.campos?.trialDias}
            />
            <CampoTexto
              id="limiteUsuarios"
              rotulo="Limite de usuários"
              inputMode="numeric"
              placeholder="Ilimitado"
              defaultValue={v("limiteUsuarios") ?? plano?.limiteUsuarios?.toString() ?? ""}
              erro={estado.campos?.limiteUsuarios}
            />
            <CampoTexto
              id="limiteEmpresas"
              rotulo="Limite de empresas"
              inputMode="numeric"
              placeholder="Ilimitado"
              defaultValue={v("limiteEmpresas") ?? plano?.limiteEmpresas?.toString() ?? ""}
              erro={estado.campos?.limiteEmpresas}
            />
          </div>

          <div>
            <label htmlFor="recursos" className="text-sm font-medium">
              Recursos incluídos
            </label>
            <p className="text-xs text-muted-foreground">Um por linha</p>
            <textarea
              id="recursos"
              name="recursos"
              rows={4}
              defaultValue={v("recursos") ?? plano?.recursos.join("\n")}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="publico"
              defaultChecked={plano ? plano.publico : true}
              className="size-4 rounded border-border"
            />
            Visível para os clientes na vitrine de planos
          </label>

          <Rodape onCancelar={() => setAberto(false)} editando={editando} />
        </form>
      </Modal>
    </>
  );
}

function Faixa({ tom, texto }: { tom: "ok" | "info"; texto: string }) {
  const ok = tom === "ok";
  return (
    <div
      role="status"
      className={
        ok
          ? "flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-3 py-2.5"
          : "flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5"
      }
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <p className={ok ? "text-sm text-positive" : "text-sm text-muted-foreground"}>{texto}</p>
    </div>
  );
}

function Rodape({ onCancelar, editando }: { onCancelar: () => void; editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Fechar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-40"
      >
        {pending ? "Salvando…" : editando ? "Salvar alterações" : "Criar plano"}
      </button>
    </div>
  );
}
