"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  atualizarProgresso,
  excluirPlanoAcao,
  salvarPlanoAcao,
  type EstadoPlanoAcao,
} from "@/app/(app)/plano-de-acao/acoes";
import { CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { AREAS_AVALIACAO } from "@/lib/avaliacoes";
import type { PlanoAcao } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoPlanoAcao = {};
const PRIORIDADES = [
  { valor: "baixa", rotulo: "Baixa" },
  { valor: "media", rotulo: "Média" },
  { valor: "alta", rotulo: "Alta" },
  { valor: "critica", rotulo: "Crítica" },
];
const STATUS = [
  { valor: "nao_iniciado", rotulo: "Não iniciado" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "concluido", rotulo: "Concluído" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

export function DialogoPlanoAcao({
  empresaId,
  acao,
}: {
  empresaId?: string;
  acao?: PlanoAcao;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, action] = useActionState(salvarPlanoAcao, ESTADO_INICIAL);
  const editando = Boolean(acao);
  const sufixo = acao?.id ?? "nova";
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
            : "rounded-lg bg-brand px-3 py-2 text-sm text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {editando ? "Editar" : "Nova ação"}
      </button>

      <Modal
        aberto={aberto}
        titulo={editando ? "Editar ação" : "Nova ação"}
        descricao="Planejamento definido pela consultoria"
        onFechar={() => setAberto(false)}
        className="max-w-2xl"
      >
        <form action={action} className="space-y-5">
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          {acao ? <input type="hidden" name="id" value={acao.id} /> : null}
          <Aviso estado={estado} sucesso={editando ? "Ação atualizada." : "Ação criada."} />

          <CampoArea
            id={`problema-${sufixo}`}
            nome="problema"
            rotulo="Problema identificado"
            rows={3}
            required
            defaultValue={valor("problema", acao?.problema)}
            erro={estado.campos?.problema}
          />
          <CampoArea
            id={`acao-${sufixo}`}
            nome="acao"
            rotulo="Ação proposta"
            rows={3}
            required
            defaultValue={valor("acao", acao?.acao)}
            erro={estado.campos?.acao}
          />

          <GrupoOpcoes
            nome="area"
            rotulo="Área"
            opcoes={AREAS_AVALIACAO.map((area) => ({ valor: area.id, rotulo: area.rotulo }))}
            valorInicial={String(valor("area", acao?.area ?? "financeiro"))}
            erro={estado.campos?.area}
            colunas="sm:grid-cols-4"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id={`responsavel-${sufixo}`}
              name="responsavel"
              rotulo="Responsável"
              required
              defaultValue={valor("responsavel", acao?.responsavel)}
              erro={estado.campos?.responsavel}
            />
            <CampoTexto
              id={`prazo-${sufixo}`}
              name="prazo"
              rotulo="Prazo"
              tipo="date"
              required
              defaultValue={valor("prazo", acao?.prazo)}
              erro={estado.campos?.prazo}
            />
          </div>

          <GrupoOpcoes
            nome="prioridade"
            rotulo="Prioridade"
            opcoes={PRIORIDADES}
            valorInicial={String(valor("prioridade", acao?.prioridade ?? "media"))}
            erro={estado.campos?.prioridade}
            colunas="grid-cols-2 sm:grid-cols-4"
          />
          <GrupoOpcoes
            nome="status"
            rotulo="Status"
            opcoes={STATUS}
            valorInicial={String(valor("status", acao?.status ?? "nao_iniciado"))}
            erro={estado.campos?.status}
            colunas="grid-cols-2 sm:grid-cols-4"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id={`percentual-${sufixo}`}
              name="percentual"
              rotulo="Avanço (%)"
              tipo="number"
              min={0}
              max={100}
              step={1}
              required
              defaultValue={valor("percentual", acao?.percentual ?? 0)}
              erro={estado.campos?.percentual}
            />
            <CampoTexto
              id={`impacto-${sufixo}`}
              name="impactoEstimado"
              rotulo="Impacto estimado (R$)"
              inputMode="decimal"
              placeholder="Opcional"
              defaultValue={valor("impactoEstimado", acao?.impactoEstimado)}
              erro={estado.campos?.impactoEstimado}
            />
          </div>

          <Rodape onCancelar={() => setAberto(false)} texto={editando ? "Salvar alterações" : "Criar ação"} />
        </form>
      </Modal>
    </>
  );
}

export function DialogoProgresso({ acao, admin }: { acao: PlanoAcao; admin: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [percentual, setPercentual] = useState(acao.percentual);
  const [estado, action] = useActionState(atualizarProgresso, ESTADO_INICIAL);
  const opcoesStatus = admin ? STATUS : STATUS.filter((item) => item.valor !== "cancelado");

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        Atualizar progresso
      </button>
      <Modal
        aberto={aberto}
        titulo="Atualizar progresso"
        descricao={acao.acao}
        onFechar={() => setAberto(false)}
      >
        <form action={action} className="space-y-5">
          <input type="hidden" name="id" value={acao.id} />
          <Aviso estado={estado} sucesso="Progresso atualizado." />
          <GrupoOpcoes
            nome="status"
            rotulo="Status"
            opcoes={opcoesStatus}
            valorInicial={estado.valores?.status ?? acao.status}
            erro={estado.campos?.status}
            colunas="grid-cols-1 sm:grid-cols-3"
          />

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`progresso-${acao.id}`} className="text-sm font-medium">
                Avanço
              </label>
              <output className="tabular text-sm font-semibold">{percentual}%</output>
            </div>
            <input
              id={`progresso-${acao.id}`}
              name="percentual"
              type="range"
              min={0}
              max={100}
              step={5}
              value={percentual}
              onChange={(event) => setPercentual(Number(event.target.value))}
              className="mt-2 w-full accent-brand"
            />
            {estado.campos?.percentual ? <p className="mt-1 text-xs text-negative">{estado.campos.percentual}</p> : null}
          </div>

          <CampoArea
            id={`comentario-${acao.id}`}
            nome="comentario"
            rotulo="Comentário da atualização"
            rows={4}
            maxLength={1000}
            placeholder="Resultado alcançado, impedimento ou evidência"
            defaultValue={estado.valores?.comentario}
          />
          <Rodape onCancelar={() => setAberto(false)} texto="Salvar progresso" />
        </form>
      </Modal>
    </>
  );
}

export function ExcluirPlanoAcao({ acao }: { acao: PlanoAcao }) {
  const [estado, action] = useActionState(excluirPlanoAcao, ESTADO_INICIAL);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(`Excluir a ação "${acao.acao}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={acao.id} />
      <button
        type="submit"
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      {estado.erro ? <p className="mt-1 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}

function GrupoOpcoes({
  nome,
  rotulo,
  opcoes,
  valorInicial,
  erro,
  colunas,
}: {
  nome: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  valorInicial: string;
  erro?: string;
  colunas: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{rotulo}</legend>
      <div className={cn("mt-1 grid gap-2", colunas)}>
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="cursor-pointer">
            <input
              type="radio"
              name={nome}
              value={opcao.valor}
              defaultChecked={opcao.valor === valorInicial}
              className="peer sr-only"
            />
            <span className="flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
              {opcao.rotulo}
            </span>
          </label>
        ))}
      </div>
      {erro ? <p className="mt-1 text-xs text-negative">{erro}</p> : null}
    </fieldset>
  );
}

function CampoArea({
  id,
  nome,
  rotulo,
  erro,
  ...resto
}: {
  id: string;
  nome: string;
  rotulo: string;
  erro?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name">) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <textarea
        id={id}
        name={nome}
        aria-invalid={erro ? true : undefined}
        className={cn(
          "mt-1 w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
          erro ? "border-negative" : "border-border",
        )}
        {...resto}
      />
      {erro ? <p className="mt-1 text-xs text-negative">{erro}</p> : null}
    </div>
  );
}

function Aviso({ estado, sucesso }: { estado: EstadoPlanoAcao; sucesso: string }) {
  if (!estado.ok && !estado.erro) return null;
  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
      estado.ok ? "border-positive/20 bg-positive-soft text-positive" : "border-border bg-surface-muted text-muted-foreground",
    )} role="status">
      {estado.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <p className="text-sm">{estado.ok ? sucesso : estado.erro}</p>
    </div>
  );
}

function Rodape({ onCancelar, texto }: { onCancelar: () => void; texto: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        Fechar
      </button>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-40">
        {pending ? "Salvando..." : texto}
      </button>
    </div>
  );
}
