"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { CHAVE_COMPETENCIA, normalizarCompetencia } from "@/lib/competencia";

export async function definirCompetencia(competencia: string) {
  const normalizada = normalizarCompetencia(competencia);
  if (!normalizada) return { erro: "Competência inválida." };

  const jar = await cookies();
  jar.set(CHAVE_COMPETENCIA, normalizada, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true, competencia: normalizada };
}
