"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2, Lock, LockOpen, MessageSquareText, ShieldAlert } from "lucide-react";

import {
  fecharCompetenciaFolha,
  justificarPendenciaFolha,
  reabrirCompetenciaFolha,
  vincularApuracaoUnidade,
} from "@/app/(app)/financeiro/folha/acoes";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { ApuracaoUnidade, StatusCompetenciaFolha, UnidadeFolha } from "@/lib/dados-folha";
import { ROTULO_PENDENCIA, type Pendencia, type TipoPendencia } from "@/lib/folha-analitica";
import { competenciaExtenso, dataHora } from "@/lib/format";
import { cn } from "@/lib/utils";

const ORDEM: TipoPendencia[] = [
  "sem_unidade",
  "cnpj",
  "rubrica_nao_classificada",
  "sem_setor",
  "duplicado",
  "diferenca_total",
  "inconsistencia",
  "sem_base",
  "setor_sem_nome",
];

export function ConferenciaFolha({
  empresaId,
  competencia,
  pendencias,
  status,
  apuracoes,
  unidades,
  podeEditar,
  ehAdmin,
  onIrPara,
}: {
  empresaId: string;
  competencia: string;
  pendencias: Pendencia[];
  status: StatusCompetenciaFolha;
  apuracoes: ApuracaoUnidade[];
  unidades: UnidadeFolha[];
  podeEditar: boolean;
  ehAdmin: boolean;
  onIrPara: (aba: "rubricas" | "configuracao") => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [reabrir, setReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();

  const fechada = status.status === "fechada";
  const justificada = (p: Pendencia) => Boolean(status.justificativas[p.chave]);
  const bloqueiosAbertos = pendencias.filter((p) => p.gravidade === "bloqueia" && !justificada(p));
  const alertasAbertos = pendencias.filter((p) => p.gravidade === "alerta" && !justificada(p));
  const semUnidade = apuracoes.filter((a) => !a.unidadeId);

  const porTipo = ORDEM.map((tipo) => ({ tipo, itens: pendencias.filter((p) => p.tipo === tipo) })).filter(
    (g) => g.itens.length,
  );

  function fechar() {
    setErro(null);
    iniciar(async () => {
      const r = await fecharCompetenciaFolha(empresaId, { competencia });
      if (!r.ok) setErro(r.erro);
      else {
        setConfirmar(false);
        router.refresh();
      }
    });
  }

  function reabrirCompetencia() {
    setErro(null);
    iniciar(async () => {
      const r = await reabrirCompetenciaFolha(empresaId, { competencia, motivo });
      if (!r.ok) setErro(r.erro);
      else {
        setReabrir(false);
        setMotivo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titulo={`Conferência e fechamento — ${competenciaExtenso(competencia)}`}
          descricao="Pendências bloqueantes precisam ser corrigidas ou justificadas antes do fechamento. Após fechada, a competência fica bloqueada e alimenta o DRE."
          acao={
            fechada ? (
              ehAdmin ? (
                <button
                  type="button"
                  onClick={() => setReabrir(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
                >
                  <LockOpen className="size-4" aria-hidden />
                  Reabrir competência
                </button>
              ) : null
            ) : podeEditar ? (
              <button
                type="button"
                onClick={() => setConfirmar(true)}
                disabled={bloqueiosAbertos.length > 0 || apuracoes.length === 0}
                title={bloqueiosAbertos.length ? "Resolva ou justifique as pendências bloqueantes" : undefined}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
              >
                <Lock className="size-4" aria-hidden />
                Fechar competência
              </button>
            ) : null
          }
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {fechada ? (
              <Badge tom="positivo">
                <Lock className="size-3" aria-hidden /> Fechada
              </Badge>
            ) : (
              <Badge tom="atencao">
                <LockOpen className="size-3" aria-hidden /> Aberta
              </Badge>
            )}
            <Badge tom={bloqueiosAbertos.length ? "negativo" : "neutro"}>
              {bloqueiosAbertos.length} bloqueante{bloqueiosAbertos.length === 1 ? "" : "s"} em aberto
            </Badge>
            <Badge tom={alertasAbertos.length ? "atencao" : "neutro"}>
              {alertasAbertos.length} alerta{alertasAbertos.length === 1 ? "" : "s"} em aberto
            </Badge>
            <Badge>{pendencias.filter(justificada).length} justificada(s)</Badge>
          </div>
          {fechada ? (
            <p className="text-xs text-muted-foreground">
              Fechada por {status.fechadoPor ?? "—"} em {status.fechadoEm ? dataHora(status.fechadoEm) : "—"}. Os
              cálculos usam a configuração (rubricas, alíquotas e setores) congelada no fechamento.
              {ehAdmin ? "" : " Ajustes só após reabertura autorizada pela consultoria."}
            </p>
          ) : status.reabertoEm ? (
            <p className="text-xs text-muted-foreground">
              Reaberta por {status.reabertoPor ?? "—"} em {dataHora(status.reabertoEm)} — motivo: “
              {status.motivoReabertura}”.
            </p>
          ) : null}
          {erro ? (
            <p role="alert" className="text-sm text-negative">
              {erro}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {semUnidade.length && podeEditar ? (
        <Card>
          <CardHeader
            titulo="Relatórios sem unidade"
            descricao="Importados antes da separação por unidade. Vincule cada um à unidade (CNPJ) correspondente."
          />
          <CardBody className="space-y-2">
            {semUnidade.map((a) => (
              <VincularUnidade key={a.id} empresaId={empresaId} apuracao={a} unidades={unidades} />
            ))}
          </CardBody>
        </Card>
      ) : null}

      {porTipo.length === 0 ? (
        <Card>
          <CardBody className="flex items-center gap-2 py-8 text-sm text-positive">
            <CheckCircle2 className="size-5" aria-hidden />
            Nenhuma pendência: unidades, CNPJs, rubricas, setores e totais conferem.
          </CardBody>
        </Card>
      ) : (
        porTipo.map(({ tipo, itens }) => (
          <Card key={tipo}>
            <CardHeader
              titulo={`${ROTULO_PENDENCIA[tipo]} (${itens.length})`}
              acao={
                tipo === "rubrica_nao_classificada" ? (
                  <button type="button" onClick={() => onIrPara("rubricas")} className="text-xs font-medium text-brand">
                    Classificar rubricas →
                  </button>
                ) : tipo === "setor_sem_nome" || tipo === "sem_base" || tipo === "cnpj" ? (
                  <button
                    type="button"
                    onClick={() => onIrPara("configuracao")}
                    className="text-xs font-medium text-brand"
                  >
                    Abrir configurações →
                  </button>
                ) : null
              }
            />
            <CardBody className="divide-y divide-border px-0 py-0">
              {itens.map((p) => (
                <LinhaPendencia
                  key={p.chave}
                  pendencia={p}
                  justificativa={status.justificativas[p.chave]}
                  empresaId={empresaId}
                  competencia={competencia}
                  podeEditar={podeEditar}
                />
              ))}
            </CardBody>
          </Card>
        ))
      )}

      <Modal
        aberto={confirmar}
        titulo="Fechar a competência?"
        descricao={competenciaExtenso(competencia)}
        onFechar={() => !pendente && setConfirmar(false)}
      >
        <div className="space-y-4 text-sm">
          <p>
            A apuração de todas as unidades fica bloqueada para alterações, a configuração atual é congelada e o custo
            apurado passa a ser enviado ao DRE (por unidade, setor, centro de custo e natureza).
          </p>
          {alertasAbertos.length ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
              Ainda há {alertasAbertos.length} alerta(s) sem justificativa. Eles não impedem o fechamento.
            </p>
          ) : null}
          {erro ? <p className="text-negative">{erro}</p> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={fechar}
              disabled={pendente}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              <Lock className="size-4" aria-hidden />
              {pendente ? "Fechando…" : "Fechar competência"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        aberto={reabrir}
        titulo="Reabrir competência"
        descricao="A reabertura fica registrada no histórico e retira a competência do DRE até o novo fechamento."
        onFechar={() => !pendente && setReabrir(false)}
      >
        <div className="space-y-4 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Motivo da reabertura</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
          {erro ? <p className="text-negative">{erro}</p> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setReabrir(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={reabrirCompetencia}
              disabled={pendente || motivo.trim().length < 5}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              <LockOpen className="size-4" aria-hidden />
              {pendente ? "Reabrindo…" : "Reabrir"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LinhaPendencia({
  pendencia: p,
  justificativa,
  empresaId,
  competencia,
  podeEditar,
}: {
  pendencia: Pendencia;
  justificativa: StatusCompetenciaFolha["justificativas"][string] | undefined;
  empresaId: string;
  competencia: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(justificativa?.texto ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(valor: string) {
    setErro(null);
    iniciar(async () => {
      const r = await justificarPendenciaFolha(empresaId, {
        competencia,
        chave: p.chave,
        descricao: p.descricao.slice(0, 500),
        texto: valor,
      });
      if (!r.ok) setErro(r.erro);
      else {
        setEditando(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="px-5 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className={cn("flex items-start gap-2 text-sm", justificativa && "text-muted-foreground")}>
          <ShieldAlert
            className={cn(
              "mt-0.5 size-4 shrink-0",
              justificativa ? "text-muted-foreground" : p.gravidade === "bloqueia" ? "text-negative" : "text-warning",
            )}
            aria-hidden
          />
          <span>
            {p.descricao}
            <Badge tom={p.gravidade === "bloqueia" ? "negativo" : "atencao"} className="ml-2 align-middle">
              {p.gravidade === "bloqueia" ? "bloqueia" : "alerta"}
            </Badge>
          </span>
        </p>
        {podeEditar && !editando ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand"
          >
            <MessageSquareText className="size-3.5" aria-hidden />
            {justificativa ? "Editar justificativa" : "Justificar"}
          </button>
        ) : null}
      </div>
      {justificativa && !editando ? (
        <p className="mt-1 ml-6 text-xs">
          <span className="font-medium text-positive">Justificado:</span> {justificativa.texto}{" "}
          <span className="text-muted-foreground">
            — {justificativa.usuario}, {dataHora(justificativa.em)}
          </span>
        </p>
      ) : null}
      {editando ? (
        <div className="mt-2 ml-6 flex flex-wrap items-center gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por que esta diferença é aceitável?"
            maxLength={500}
            className="min-w-64 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => salvar(texto.trim())}
            disabled={pendente || !texto.trim()}
            className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground disabled:opacity-50"
          >
            Salvar
          </button>
          {justificativa ? (
            <button
              type="button"
              onClick={() => salvar("")}
              disabled={pendente}
              className="rounded-md px-2 py-1 text-xs text-negative"
            >
              Retirar
            </button>
          ) : null}
          <button type="button" onClick={() => setEditando(false)} className="px-2 py-1 text-xs text-muted-foreground">
            Cancelar
          </button>
          {erro ? <span className="text-xs text-negative">{erro}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function VincularUnidade({
  empresaId,
  apuracao,
  unidades,
}: {
  empresaId: string;
  apuracao: ApuracaoUnidade;
  unidades: UnidadeFolha[];
}) {
  const router = useRouter();
  const cnpj = (apuracao.empresaRelatorio.cnpj ?? "").replace(/\D/g, "");
  const [unidadeId, setUnidadeId] = useState(unidades.find((u) => u.cnpj === cnpj)?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-56">
        {apuracao.arquivoNome}
        <span className="block text-xs text-muted-foreground">
          {apuracao.empresaRelatorio.nome} · CNPJ {apuracao.empresaRelatorio.cnpj ?? "—"}
        </span>
      </span>
      <select
        value={unidadeId}
        onChange={(e) => setUnidadeId(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
      >
        <option value="">Escolha a unidade…</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!unidadeId || pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await vincularApuracaoUnidade(empresaId, { apuracaoId: apuracao.id, unidadeId });
            if (!r.ok) setErro(r.erro);
            else router.refresh();
          })
        }
        className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground disabled:opacity-50"
      >
        <Link2 className="size-3.5" aria-hidden />
        Vincular
      </button>
      {erro ? <span className="text-xs text-negative">{erro}</span> : null}
    </div>
  );
}
