"use client";

import { useMemo, useState } from "react";

import { montarSecoesPlanoContas } from "@/lib/plano-contas-padrao";
import { CONTA_SEM_CLASSIFICACAO } from "@/lib/relatorios/filtros";
import type { PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

type EstadoGrupo = "nenhum" | "parcial" | "todos";

function estadoDoGrupo(ids: string[], selecionadas: Set<string>): EstadoGrupo {
  if (ids.length === 0) return "nenhum";
  let marcados = 0;
  for (const id of ids) if (selecionadas.has(id)) marcados += 1;
  if (marcados === 0) return "nenhum";
  if (marcados === ids.length) return "todos";
  return "parcial";
}

/**
 * Seletor de classificações por grupo (Receitas / Despesas / Outros).
 * - Item individual não marca o grupo inteiro.
 * - Checkbox do grupo: nenhum / parcial (indeterminate) / todos.
 * - Só os itens marcados são enviados no form (`name="conta"`).
 */
export function SeletorPlanoContas({
  contas,
  selecionadasIniciais,
}: {
  contas: PlanoConta[];
  selecionadasIniciais: string[];
}) {
  const [selecionadas, setSelecionadas] = useState(() => new Set(selecionadasIniciais));
  const secoes = useMemo(() => montarSecoesPlanoContas(contas), [contas]);

  function alternarItem(id: string, marcado: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function alternarGrupo(ids: string[], marcarTodos: boolean) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      for (const id of ids) {
        if (marcarTodos) proximo.add(id);
        else proximo.delete(id);
      }
      return proximo;
    });
  }

  const semClassificacao = selecionadas.has(CONTA_SEM_CLASSIFICACAO);

  return (
    <div
      className="max-h-[min(40vh,20rem)] overflow-y-auto overscroll-contain rounded-lg border border-border p-3"
      style={{ WebkitOverflowScrolling: "touch" }}
      onWheel={(event) => event.stopPropagation()}
    >
      {/* Valores enviados = exatamente a seleção visível */}
      {[...selecionadas].map((id) => (
        <input key={id} type="hidden" name="conta" value={id} />
      ))}

      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={semClassificacao}
          onChange={(evento) => alternarItem(CONTA_SEM_CLASSIFICACAO, evento.target.checked)}
          className="size-4 accent-brand"
        />
        Sem classificação
      </label>

      {contas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma classificação cadastrada.</p>
      ) : (
        <div className="space-y-4">
          {secoes.map((secao) => {
            const ids = secao.contas.map((c) => c.id);
            const estado = estadoDoGrupo(ids, selecionadas);
            return (
              <div key={secao.id}>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <input
                    ref={(el) => {
                      if (el) el.indeterminate = estado === "parcial";
                    }}
                    type="checkbox"
                    checked={estado === "todos"}
                    onChange={(evento) => alternarGrupo(ids, evento.target.checked)}
                    className="size-4 accent-brand"
                    aria-checked={estado === "parcial" ? "mixed" : estado === "todos"}
                    title={
                      estado === "parcial"
                        ? "Seleção parcial — clique para marcar todas"
                        : estado === "todos"
                          ? "Todas selecionadas — clique para limpar"
                          : "Nenhuma selecionada — clique para marcar todas"
                    }
                  />
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span>{secao.titulo}</span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        estado === "todos"
                          ? "text-positive"
                          : estado === "parcial"
                            ? "text-warning"
                            : "text-muted-foreground",
                      )}
                    >
                      {estado === "todos"
                        ? "todas"
                        : estado === "parcial"
                          ? "parcial"
                          : "nenhuma"}
                    </span>
                  </span>
                </label>
                <div className="ml-6 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {secao.contas.map((conta) => {
                    const marcada = selecionadas.has(conta.id);
                    return (
                      <label key={conta.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={(evento) => alternarItem(conta.id, evento.target.checked)}
                          className="mt-0.5 size-4 shrink-0 accent-brand"
                        />
                        <span>
                          <span className="font-mono text-xs text-muted-foreground">{conta.codigo}</span>{" "}
                          {conta.nome}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selecionadas.size > 0 ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          {selecionadas.size}{" "}
          {selecionadas.size === 1 ? "classificação selecionada" : "classificações selecionadas"}{" "}
          (enviadas no filtro).
        </p>
      ) : (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Nenhuma marcada = todas as classificações no relatório.
        </p>
      )}
    </div>
  );
}
