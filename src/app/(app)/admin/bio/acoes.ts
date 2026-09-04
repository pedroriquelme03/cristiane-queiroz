"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esquemaBio } from "@/lib/validacao/bio";

export interface EstadoBio {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export interface EstadoUploadFoto {
  ok?: boolean;
  url?: string;
  erro?: string;
}

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function errosPorCampo(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const chave = String(issue.path[0] ?? "");
    if (chave) campos[chave] ??= issue.message;
  }
  return campos;
}

async function garantirAdmin(): Promise<string | null> {
  const sessao = await getSessao();
  return sessao.role === "admin" ? null : "Apenas administradores podem editar a bio.";
}

/** Salva os textos, o WhatsApp, a foto e as listas de serviços e links. */
export async function salvarBio(
  _anterior: EstadoBio,
  formData: FormData,
): Promise<EstadoBio> {
  const analise = esquemaBio.safeParse(Object.fromEntries(formData));
  if (!analise.success) {
    return { campos: errosPorCampo(analise.error.issues) };
  }

  if (!supabaseConfigurado) {
    return {
      erro: "Validado. A gravação depende do banco, que ainda não foi provisionado.",
    };
  }

  const negado = await garantirAdmin();
  if (negado) return { erro: negado };

  const d = analise.data;
  const { error } = await supabaseAdmin.from("bio_perfil").upsert({
    id: "perfil",
    nome: d.nome,
    subtitulo: d.subtitulo,
    tagline: d.tagline,
    whatsapp: d.whatsapp,
    foto_url: d.fotoUrl,
    ativo: d.ativo,
    servicos: d.servicos,
    links: d.links,
    atualizado_em: new Date().toISOString(),
  });

  if (error) {
    return { erro: "Não foi possível salvar a bio." };
  }

  revalidatePath("/bio");
  revalidatePath("/admin/bio");
  return { ok: true };
}

/** Envia a foto para o Storage e devolve a URL pública. */
export async function uploadFotoBio(formData: FormData): Promise<EstadoUploadFoto> {
  const negado = await garantirAdmin();
  if (negado) return { erro: negado };

  if (!supabaseConfigurado) {
    return { erro: "Banco não provisionado: o upload da foto ficará disponível depois." };
  }

  const arquivo = formData.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione uma imagem." };
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { erro: "A imagem precisa ter até 5 MB." };
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return { erro: "Formato inválido. Use JPG, PNG, WebP ou AVIF." };
  }

  const extensao = arquivo.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const caminho = `perfil-${Date.now()}.${extensao}`;
  const { error } = await supabaseAdmin.storage
    .from("bio")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });

  if (error) {
    return { erro: "Não foi possível enviar a imagem." };
  }

  const { data } = supabaseAdmin.storage.from("bio").getPublicUrl(caminho);
  return { ok: true, url: data.publicUrl };
}
