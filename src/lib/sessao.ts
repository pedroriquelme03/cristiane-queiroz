/**
 * Sessão do usuário atual. A empresa ativa vem de empresa_membros, que é a
 * fonte de verdade do vínculo entre usuários e clientes.
 */
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/types";

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  role: Papel;
  /** Empresa (tenant) vinculada ao usuário. Vazio somente enquanto o vínculo não foi criado. */
  empresaId: string;
}

export const getSessao = cache(async (): Promise<Sessao> => {
  const supabase = await createClient();

  // 1. Obter usuário autenticado
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Usuário não autenticado");
  }

  // 2. Buscar o perfil. O trigger do banco normalmente já o cria no signup.
  const { data: profileExistente, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // 3. Se não existir, criar um perfil padrão sem empresa fictícia.
  let profile = profileExistente;
  if (profileError || !profile) {
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, role: "cliente" })
      .select("role")
      .single();

    if (insertError || !inserted) {
      throw new Error("Não foi possível criar o perfil");
    }
    profile = inserted;
  }

  const { data: vinculo } = await supabase
    .from("empresa_membros")
    .select("empresa_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // 4. Retornar a sessão
  return {
    usuarioId: user.id,
    nome: user.user_metadata?.nome || user.email || "Usuário",
    email: user.email!,
    role: profile.role as Papel,
    empresaId: vinculo?.empresa_id ?? "",
  };
});

export function ehAdmin(sessao: Sessao) {
  return sessao.role === "admin";
}
