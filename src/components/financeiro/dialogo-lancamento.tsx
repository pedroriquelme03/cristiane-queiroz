"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirLancamento,
  salvarLancamento,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { Modal } from "@/components/ui/modal";
import { opcoesSelectClassificacao } from "@/lib/plano-contas-padrao";
import type { Lancamento, PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoLancamento({
  contas,
  empresaId,
  lancamento,
}: {
  contas: PlanoConta[];
  empresaId?: string;
  lancamento?: Lancamento;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarLancamento, ESTADO_INICIAL);
  const editando = Boolean(lancamento);
  const sufixo = lancamento?.id ?? "novo";
  const hoje = new Date().toISOString().slice(0, 10);
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!empresaId}
        title={!empresaId ? "Selecione uma empresa" : undefined}
        className={cn(
          "flex items-center gap-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40",
          editando
            ? "text-xs text-muted-foreground hover:text-foreground"
            : "rounded-lg bg-brand px-3 py-1.5 text-xs text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
        {editando ? "Editar" : "Novo lançamento"}
      </button>

      <Modal
        aberto={aberto}
        titulo={editando ? "Editar lançamento" : "Novo lançamento"}
        descricao="Movimentação já realizada de entrada ou saída do caixa"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso={editando ? "Lançamento atualizado." : "Lançamento salvo."} />
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          {lancamento ? <input type="hidden" name="id" value={lancamento.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoData
              id={`data-${sufixo}`}
              name="data"
              rotulo="Data"
              defaultValue={String(valor("data", lancamento?.data ?? hoje) || "")}
              required
              erro={estado.campos?.data}
            />
            <CampoSelect
              id={`tipo-${sufixo}`}
              name="tipo"
              rotulo="Tipo"
              opcoes={[
                { valor: "entrada", rotulo: "Entrada" },
                { valor: "saida", rotulo: "Saída" },
              ]}
              defaultValue={valor("tipo", lancamento?.tipo ?? "entrada")}
              erro={estado.campos?.tipo}
            />
          </div>

          <CampoTexto
            id={`descricao-${sufixo}`}
            name="descricao"
            rotulo="Descrição"
            placeholder="Ex.: Recebimento de hospedagem"
            required
            defaultValue={valor("descricao", lancamento?.descricao)}
            erro={estado.campos?.descricao}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id={`valor-${sufixo}`}
              name="valor"
              rotulo="Valor"
              inputMode="decimal"
              placeholder="0,00"
              dica="Sempre positivo — o tipo define o sinal"
              defaultValue={valor("valor", lancamento?.valor)}
              required
              erro={estado.campos?.valor}
            />
            <CampoTexto
              id={`contraparte-${sufixo}`}
              name="contraparte"
              rotulo="Cliente / fornecedor"
              placeholder="Opcional"
              defaultValue={valor("contraparte", lancamento?.contraparte)}
              erro={estado.campos?.contraparte}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id={`plano-conta-${sufixo}`}
              name="planoContaId"
              rotulo="Classificação"
              required
              opcoes={opcoesSelectClassificacao(contas, {
                placeholder: "Selecione a classificação",
              })}
              pesquisavel
              defaultValue={valor("planoContaId", lancamento?.planoContaId ?? contas[0]?.id)}
              erro={estado.campos?.planoContaId}
            />
            <CampoTexto
              id={`documento-${sufixo}`}
              name="documento"
              rotulo="Documento"
              placeholder="Opcional"
              defaultValue={valor("documento", lancamento?.documento)}
              erro={estado.campos?.documento}
            />
          </div>

          <CamposImpacto
            sufixo={sufixo}
            impactaDrePadrao={
              estado.valores?.impactaDre !== undefined
                ? estado.valores.impactaDre === "on" || estado.valores.impactaDre === "true"
                : (lancamento?.impactaDre ?? true)
            }
            impactaFluxoPadrao={
              estado.valores?.impactaFluxo !== undefined
                ? estado.valores.impactaFluxo === "on" || estado.valores.impactaFluxo === "true"
                : (lancamento?.impactaFluxo ?? true)
            }
            erro={estado.campos?.impactaDre}
            dicaDre="Competência pela data do lançamento (exige classificação)"
            dicaFluxo="Entra no saldo e no fluxo na data do caixa"
          />

          <Rodape onCancelar={() => setAberto(false)} texto={editando ? "Salvar alterações" : "Salvar"} />
        </form>
      </Modal>
    </>
  );
}

export function ExcluirLancamento({
  lancamento,
  empresaId,
}: {
  lancamento: Lancamento;
  empresaId: string;
}) {
  const [estado, acao] = useActionState(excluirLancamento, ESTADO_INICIAL);
  return (
    <form
      action={acao}
      onSubmit={(event) => {
        if (!confirm(`Excluir o lançamento "${lancamento.descricao}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={lancamento.id} />
      <input type="hidden" name="empresaId" value={empresaId} />
      <button type="submit" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative">
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      {estado.erro ? <p className="mt-1 max-w-48 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}

export function Aviso({
  estado,
  textoSucesso = "Registro salvo.",
}: {
  estado: EstadoFormulario;
  textoSucesso?: string;
}) {
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
      {estado.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <p className="text-sm">{estado.ok ? textoSucesso : estado.erro}</p>
    </div>
  );
}

export function Rodape({
  onCancelar,
  texto = "Salvar",
  desabilitado = false,
}: {
  onCancelar: () => void;
  texto?: string;
  desabilitado?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        Fechar
      </button>
      <button
        type="submit"
        disabled={pending || desabilitado}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-40"
      >
        {pending ? "Salvando..." : texto}
      </button>
    </div>
  );
}

/** Onde o valor impacta: DRE (competência) e/ou fluxo de caixa. */
export function CamposImpacto({
  sufixo,
  impactaDrePadrao = true,
  impactaFluxoPadrao = true,
  erro,
  dicaDre,
  dicaFluxo,
}: {
  sufixo: string;
  impactaDrePadrao?: boolean;
  impactaFluxoPadrao?: boolean;
  erro?: string;
  dicaDre?: string;
  dicaFluxo?: string;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border bg-surface-muted/40 px-3 py-3">
      <legend className="px-1 text-sm font-medium text-foreground">Impacto do valor</legend>
      <p className="text-xs text-muted-foreground">
        Escolha onde este valor entra nos relatórios. Marque pelo menos uma opção.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="impactaDre"
            value="on"
            defaultChecked={impactaDrePadrao}
            className="mt-0.5 size-4 rounded border-border accent-brand"
            aria-describedby={`dica-dre-${sufixo}`}
          />
          <span>
            <span className="font-medium">DRE (competência)</span>
            {dicaDre ? (
              <span id={`dica-dre-${sufixo}`} className="mt-0.5 block text-xs text-muted-foreground">
                {dicaDre}
              </span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="impactaFluxo"
            value="on"
            defaultChecked={impactaFluxoPadrao}
            className="mt-0.5 size-4 rounded border-border accent-brand"
            aria-describedby={`dica-fluxo-${sufixo}`}
          />
          <span>
            <span className="font-medium">Fluxo de caixa</span>
            {dicaFluxo ? (
              <span id={`dica-fluxo-${sufixo}`} className="mt-0.5 block text-xs text-muted-foreground">
                {dicaFluxo}
              </span>
            ) : null}
          </span>
        </label>
      </div>
      {erro ? <p className="text-xs text-negative">{erro}</p> : null}
    </fieldset>
  );
}
