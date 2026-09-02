import { cache } from "react";
import { cookies } from "next/headers";

export const CHAVE_COMPETENCIA = "cq.competencia";

/** Normaliza para o primeiro dia do mês (aaaa-mm-01). */
export function normalizarCompetencia(valor: string): string | null {
  const bruto = valor.trim();
  const match = bruto.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function mesDe(data: string) {
  return `${data.slice(0, 7)}-01`;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Últimos N meses a partir de uma competência (ou mês corrente). */
export function gerarCompetenciasRecentes(quantidade = 36, referencia?: string): string[] {
  const base = referencia
    ? new Date(`${referencia.slice(0, 7)}-01T12:00:00`)
    : new Date(`${mesDe(hojeIso())}T12:00:00`);
  const lista: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    lista.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
    );
  }
  return lista;
}

/** Competência escolhida pelo usuário (cookie) ou mês corrente. */
export const getCompetenciaSelecionada = cache(async (): Promise<string> => {
  const jar = await cookies();
  const salva = jar.get(CHAVE_COMPETENCIA)?.value;
  const normalizada = salva ? normalizarCompetencia(salva) : null;
  return normalizada ?? mesDe(hojeIso());
});
