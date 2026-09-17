"use server";

import { revalidatePath } from "next/cache";

import { exigirSessao, temPapel } from "@/lib/autorizacao";
import { slugSegmento } from "@/lib/dados-segmentos";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type EstadoSegmento = {
  ok?: boolean;
  erro?: string;
  valor?: string;
  rotulo?: string;
};

export async function cadastrarSegmento(
  _anterior: EstadoSegmento,
  formData: FormData,
): Promise<EstadoSegmento> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao, ["admin", "cliente", "consultor"])) {
    return { erro: "Sem permissão para cadastrar segmento." };
  }

  const rotulo = String(formData.get("rotulo") ?? "").trim();
  if (rotulo.length < 2) return { erro: "Informe um nome com pelo menos 2 caracteres." };
  if (rotulo.length > 80) return { erro: "Nome muito longo." };

  const valor = slugSegmento(rotulo);
  if (!valor) return { erro: "Nome inválido para o segmento." };
  if (valor === "geral") return { erro: "Este nome é reservado." };

  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "Supabase não configurado para gravação." };
  }

  const { error } = await supabaseAdmin.from("segmentos").upsert(
    { valor, rotulo, ativo: true },
    { onConflict: "valor" },
  );

  if (error) return { erro: "Não foi possível cadastrar o segmento." };

  revalidatePath("/", "layout");
  return { ok: true, valor, rotulo };
}

export async function segmentoExiste(valor: string) {
  if (!valor) return false;
  if (["geral", "hotelaria", "comercio", "servicos", "industria", "alimentacao"].includes(valor)) {
    return true;
  }
  if (!supabaseConfigurado) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("segmentos")
    .select("valor")
    .eq("valor", valor)
    .eq("ativo", true)
    .maybeSingle();
  return Boolean(data);
}
