import { cache } from "react";
import { cookies } from "next/headers";

import { CHAVE_COMPETENCIA, mesDe, normalizarCompetencia } from "@/lib/competencia";

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Competência escolhida pelo usuário (cookie) ou mês corrente. */
export const getCompetenciaSelecionada = cache(async (): Promise<string> => {
  const jar = await cookies();
  const salva = jar.get(CHAVE_COMPETENCIA)?.value;
  const normalizada = salva ? normalizarCompetencia(salva) : null;
  return normalizada ?? mesDe(hojeIso());
});
