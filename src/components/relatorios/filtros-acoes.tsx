"use client";

import { CampoTexto } from "@/components/ui/campo";
import type { AreaDiagnostico } from "@/lib/types";

const CLASSE_SELECT =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

const AREAS: { valor: AreaDiagnostico | "todas"; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas as áreas" },
  { valor: "financeiro", rotulo: "Financeiro" },
  { valor: "compras", rotulo: "Compras" },
  { valor: "estoque", rotulo: "Estoque" },
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "rh", rotulo: "RH" },
  { valor: "processos", rotulo: "Processos" },
  { valor: "tecnologia", rotulo: "Tecnologia" },
  { valor: "gestao", rotulo: "Gestão" },
];

export function FiltrosRelatorioAcoes({
  action,
  empresaId,
  inicio,
  fim,
  status,
  prioridade,
  area,
}: {
  action: string;
  empresaId?: string | null;
  inicio: string;
  fim: string;
  status: string;
  prioridade: string;
  area: string;
}) {
  return (
    <form method="get" action={action} className="space-y-4">
      {empresaId ? <input type="hidden" name="empresa" value={empresaId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CampoTexto id="inicio" rotulo="Prazo inicial" tipo="date" defaultValue={inicio} />
        <CampoTexto id="fim" rotulo="Prazo final" tipo="date" defaultValue={fim} />
        <div>
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className={CLASSE_SELECT}>
            <option value="todos">Todos</option>
            <option value="nao_iniciado">Não iniciado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
            <option value="atrasado">Em atraso</option>
          </select>
        </div>
        <div>
          <label htmlFor="prioridade" className="text-sm font-medium">
            Prioridade
          </label>
          <select id="prioridade" name="prioridade" defaultValue={prioridade} className={CLASSE_SELECT}>
            <option value="todas">Todas</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
        <div>
          <label htmlFor="area" className="text-sm font-medium">
            Área
          </label>
          <select id="area" name="area" defaultValue={area} className={CLASSE_SELECT}>
            {AREAS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>
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

