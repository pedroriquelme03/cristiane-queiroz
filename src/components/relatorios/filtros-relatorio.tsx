"use client";

import { useState } from "react";

import { CampoTexto } from "@/components/ui/campo";
import {
  CONTA_SEM_CLASSIFICACAO,
  type FiltrosRelatorio,
} from "@/lib/relatorios/filtros";
import type { PlanoConta } from "@/lib/types";

const CLASSE_SELECT =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function FiltrosRelatorioForm({
  action,
  filtros,
  contas,
  empresaId,
  tipoFixo,
  mostrarTipo = false,
  mostrarOrigem = true,
  mostrarSituacao = true,
  mostrarPlanoContas = true,
  mostrarBusca = true,
  mostrarCampoData = true,
}: {
  action: string;
  filtros: FiltrosRelatorio;
  contas: PlanoConta[];
  empresaId?: string | null;
  tipoFixo?: "pagar" | "receber";
  mostrarTipo?: boolean;
  mostrarOrigem?: boolean;
  mostrarSituacao?: boolean;
  mostrarPlanoContas?: boolean;
  mostrarBusca?: boolean;
  mostrarCampoData?: boolean;
}) {
  const [periodo, setPeriodo] = useState(filtros.periodo);

  return (
    <form method="get" action={action} className="space-y-4">
      {empresaId ? <input type="hidden" name="empresa" value={empresaId} /> : null}
      {tipoFixo ? <input type="hidden" name="tipo" value={tipoFixo} /> : null}
      {!mostrarCampoData ? <input type="hidden" name="campoData" value={filtros.campoData} /> : null}
      {!mostrarSituacao ? <input type="hidden" name="situacao" value={filtros.situacao} /> : null}
      {!mostrarOrigem ? <input type="hidden" name="origem" value={filtros.origem} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="periodo" className="text-sm font-medium">
            Período
          </label>
          <select
            id="periodo"
            name="periodo"
            value={periodo}
            onChange={(evento) => setPeriodo(evento.target.value as FiltrosRelatorio["periodo"])}
            className={CLASSE_SELECT}
          >
            <option value="mes">Mês específico</option>
            <option value="ano">Ano específico</option>
            <option value="intervalo">Intervalo personalizado</option>
            <option value="anteriores">Lançamentos anteriores</option>
            <option value="futuros">Lançamentos futuros / a vencer</option>
          </select>
        </div>

        {periodo === "mes" ? (
          <CampoTexto id="mes" rotulo="Mês" tipo="month" defaultValue={filtros.mes} />
        ) : null}

        {periodo === "ano" ? (
          <CampoTexto id="ano" rotulo="Ano" tipo="number" defaultValue={filtros.ano} />
        ) : null}

        {periodo === "intervalo" ? (
          <>
            <CampoTexto id="inicio" rotulo="Data inicial" tipo="date" defaultValue={filtros.inicio} />
            <CampoTexto id="fim" rotulo="Data final" tipo="date" defaultValue={filtros.fim} />
          </>
        ) : null}

        {mostrarCampoData ? (
          <div>
            <label htmlFor="campoData" className="text-sm font-medium">
              Data considerada
            </label>
            <select id="campoData" name="campoData" defaultValue={filtros.campoData} className={CLASSE_SELECT}>
              <option value="vencimento">Data de vencimento</option>
              <option value="emissao">Data de emissão</option>
              <option value="pagamento">Data de pagamento/recebimento</option>
            </select>
          </div>
        ) : null}

        {mostrarSituacao ? (
          <div>
            <label htmlFor="situacao" className="text-sm font-medium">
              Situação
            </label>
            <select id="situacao" name="situacao" defaultValue={filtros.situacao} className={CLASSE_SELECT}>
              <option value="todos">Todas</option>
              <option value="aberto">Em aberto</option>
              <option value="pago">Pago / recebido</option>
              <option value="vencido">Vencido</option>
              <option value="a_vencer">A vencer</option>
            </select>
          </div>
        ) : null}

        {mostrarTipo && !tipoFixo ? (
          <div>
            <label htmlFor="tipo" className="text-sm font-medium">
              Tipo
            </label>
            <select id="tipo" name="tipo" defaultValue={filtros.tipo} className={CLASSE_SELECT}>
              <option value="todos">Pagar e receber</option>
              <option value="pagar">Contas a pagar</option>
              <option value="receber">Contas a receber</option>
            </select>
          </div>
        ) : null}

        {mostrarOrigem ? (
          <div>
            <label htmlFor="origem" className="text-sm font-medium">
              Origem
            </label>
            <select id="origem" name="origem" defaultValue={filtros.origem} className={CLASSE_SELECT}>
              <option value="todos">Todos os lançamentos</option>
              <option value="avulso">Avulsos</option>
              <option value="fixa">Contratos / contas fixas</option>
            </select>
          </div>
        ) : null}

        {mostrarBusca ? (
          <CampoTexto
            id="q"
            rotulo="Cliente / fornecedor"
            placeholder="Nome ou documento"
            defaultValue={filtros.q}
          />
        ) : null}
      </div>

      {mostrarPlanoContas ? (
        <fieldset>
          <legend className="text-sm font-medium">Plano de contas</legend>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nenhuma marcada = todas as classificações. Combine com o período para ver, por exemplo, o que foi pago de Aluguel no mês.
          </p>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border p-3">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="conta"
                value={CONTA_SEM_CLASSIFICACAO}
                defaultChecked={filtros.contas.includes(CONTA_SEM_CLASSIFICACAO)}
                className="size-4 accent-brand"
              />
              Sem classificação
            </label>
            {contas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma classificação cadastrada.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {contas.map((conta) => (
                  <label key={conta.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="conta"
                      value={conta.id}
                      defaultChecked={filtros.contas.includes(conta.id)}
                      className="mt-0.5 size-4 shrink-0 accent-brand"
                    />
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">{conta.codigo}</span>{" "}
                      {conta.nome}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          Aplicar filtros
        </button>
        <a
          href={empresaId ? `${action}?empresa=${encodeURIComponent(empresaId)}` : action}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-brand/50"
        >
          Limpar
        </a>
      </div>
    </form>
  );
}
