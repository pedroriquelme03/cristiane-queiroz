"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import {
  configModeloSchema,
  type ModeloImportacao,
} from "@/lib/importacao/modelos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type ResultadoModelo =
  | { ok: true; modelo: ModeloImportacao }
  | { ok: false; erro: string };

const entradaSchema = z.object({
  empresaId: z.string().trim(),
  /** Presente = atualizar esse modelo; ausente = criar. */
  id: z.string().uuid().optional(),
  tipo: z.enum(["lancamentos", "titulos"]),
  nome: z.string().trim().min(1, "Dê um nome ao modelo.").max(80, "Nome muito longo."),
  config: configModeloSchema,
  assinatura: z.array(z.string().max(200)).max(200),
});

async function contexto(empresaIdInformada: string) {
  const alvo = await resolverEmpresaAlvo(empresaIdInformada, {
    papeis: ["admin", "cliente"],
    negado: "Seu perfil não pode salvar modelos de importação.",
    semEmpresa: "Selecione uma empresa antes de salvar o modelo.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

export async function salvarModeloImportacao(entrada: unknown): Promise<ResultadoModelo> {
  const dados = entradaSchema.safeParse(entrada);
  if (!dados.success) {
    return { ok: false, erro: dados.error.issues[0]?.message ?? "Modelo inválido." };
  }
  const { empresaId: informada, id, tipo, nome, config, assinatura } = dados.data;

  const alvo = await contexto(informada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const registro = { tipo, nome, config, assinatura };
  const colunas = "id, empresa_id, tipo, nome, config, assinatura";

  const { data, error } = id
    ? await supabaseAdmin
        .from("modelos_importacao")
        .update(registro)
        .eq("id", id)
        .eq("empresa_id", alvo.empresaId)
        .select(colunas)
        .single()
    : await supabaseAdmin
        .from("modelos_importacao")
        .insert({ ...registro, empresa_id: alvo.empresaId, created_by: alvo.sessao.usuarioId || null })
        .select(colunas)
        .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, erro: "Já existe um modelo com esse nome para este tipo." };
    }
    if (error && /modelos_importacao/i.test(error.message)) {
      return { ok: false, erro: "A tabela de modelos ainda não existe no banco (migration 0022)." };
    }
    return { ok: false, erro: "Não foi possível salvar o modelo." };
  }

  revalidatePath("/financeiro/importar");
  return {
    ok: true,
    modelo: {
      id: data.id,
      empresaId: data.empresa_id,
      tipo: data.tipo,
      nome: data.nome,
      config: configModeloSchema.parse(data.config),
      assinatura: data.assinatura ?? [],
    },
  };
}

export async function excluirModeloImportacao(
  empresaIdInformada: string,
  id: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, erro: "Modelo não encontrado." };

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  // Filtrar pela empresa impede apagar modelo global ou de outro cliente
  const { error, count } = await supabaseAdmin
    .from("modelos_importacao")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("empresa_id", alvo.empresaId);

  if (error) return { ok: false, erro: "Não foi possível excluir o modelo." };
  if (!count) return { ok: false, erro: "Modelo não encontrado." };

  revalidatePath("/financeiro/importar");
  return { ok: true };
}
