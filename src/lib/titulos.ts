/**
 * Lógica pura de títulos (sem I/O nem Supabase). Segura para importar tanto em
 * Server quanto em Client Components.
 *
 * Vive separada de @/lib/dados porque aquele módulo importa
 * @/lib/supabase/server (next/headers), que não pode entrar no bundle de um
 * Client Component. Componentes client devem importar destes helpers aqui.
 */
import type { StatusTitulo, Titulo } from "@/lib/types";

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Espelha status_efetivo da view titulos_view: "vencido" é derivado. */
export function statusEfetivo(titulo: Titulo): StatusTitulo | "vencido" {
  if (titulo.status === "pago" || titulo.status === "cancelado") return titulo.status;
  return titulo.vencimento < hojeIso() ? "vencido" : titulo.status;
}

/** Uma linha por cadastro de conta fixa (parcelas mensais agrupadas). */
export type ContaFixaAgrupada = {
  chave: string;
  /** Próxima parcela em aberto (para baixa / edição). */
  titulo: Titulo;
  parcelas: Titulo[];
  mesesRestantes: number;
  saldo: number;
  valorMensal: number;
};

export function agruparContasFixas(titulos: Titulo[]): ContaFixaAgrupada[] {
  const grupos = new Map<string, Titulo[]>();

  for (const titulo of titulos) {
    if (!titulo.fixa) continue;
    const chave =
      titulo.grupoFixaId ??
      `legado:${titulo.contraparte}|${titulo.valor}|${titulo.planoContaId ?? ""}|${titulo.documento ?? ""}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(titulo);
    grupos.set(chave, lista);
  }

  return Array.from(grupos.entries())
    .map(([chave, parcelas]) => {
      const ordenadas = [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      const abertas = ordenadas.filter((t) =>
        ["aberto", "parcial", "vencido"].includes(statusEfetivo(t)),
      );
      if (abertas.length === 0) return null;
      const titulo = abertas[0];
      return {
        chave,
        titulo,
        parcelas: ordenadas,
        mesesRestantes: abertas.length,
        saldo: abertas.reduce((s, t) => s + t.valor - t.valorPago, 0),
        valorMensal: titulo.valor,
      };
    })
    .filter((g): g is ContaFixaAgrupada => g !== null)
    .sort((a, b) => a.titulo.vencimento.localeCompare(b.titulo.vencimento));
}
