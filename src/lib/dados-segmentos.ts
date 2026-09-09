import { cache } from "react";

import { ROTULO_SEGMENTO, SEGMENTOS_CADASTRO } from "@/lib/segmentos";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type SegmentoOpcao = { valor: string; rotulo: string };

const PADRAO: SegmentoOpcao[] = SEGMENTOS_CADASTRO.map((item) => ({
  valor: item.valor,
  rotulo: item.rotulo,
}));

export const getSegmentos = cache(async (): Promise<SegmentoOpcao[]> => {
  if (!supabaseConfigurado) return PADRAO;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("segmentos")
      .select("valor, rotulo")
      .eq("ativo", true)
      .order("rotulo");

    if (error || !data?.length) return PADRAO;
    return data.map((row) => ({ valor: row.valor, rotulo: row.rotulo }));
  } catch {
    return PADRAO;
  }
});

export function rotuloSegmento(valor: string | null | undefined) {
  if (!valor) return "Não informado";
  if (valor in ROTULO_SEGMENTO) {
    return ROTULO_SEGMENTO[valor as keyof typeof ROTULO_SEGMENTO];
  }
  return valor
    .split(/[_-]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

/** Gera slug estável a partir do rótulo (ex.: "Consultoria" → "consultoria"). */
export function slugSegmento(rotulo: string) {
  return rotulo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
