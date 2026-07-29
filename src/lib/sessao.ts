/**
 * Sessão do usuário atual. Lê o perfil autenticado do Supabase.
 * Se o perfil não existir, cria um automaticamente.
 */
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/types";

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  role: Papel;
  /** Empresa (tenant) que a sessão está visualizando. */
  empresaId: string;
}

export async function getSessao(): Promise<Sessao> {
  const supabase = await createClient();

  // 1. Obter usuário autenticado
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Usuário não autenticado");
  }

  // 2. Tentar buscar o perfil
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("id", user.id)
    .single();

  // 3. Se não existir, criar um perfil padrão
  if (profileError || !profile) {
    // Define o papel padrão como 'cliente'
    const newProfile = {
      id: user.id,
      role: "cliente",
      empresa_id: "jota", // valor fixo para testes – ajuste conforme necessário
    };

    // Tenta inserir
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert(newProfile)
      .select("role, empresa_id")
      .single();

    if (insertError || !inserted) {
      // Se falhar (ex: coluna empresa_id não existe), tenta sem ela
      const { data: inserted2, error: insertError2 } = await supabase
        .from("profiles")
        .insert({ id: user.id, role: "cliente" })
        .select("role, empresa_id")
        .single();

      if (insertError2 || !inserted2) {
        throw new Error("Não foi possível criar o perfil");
      }
      profile = inserted2;
    } else {
      profile = inserted;
    }
  }

  // 4. Retornar a sessão
  return {
    usuarioId: user.id,
    nome: user.user_metadata?.nome || user.email || "Usuário",
    email: user.email!,
    role: profile.role as Papel,
    empresaId: profile.empresa_id || "jota", // fallback
  };
}

export function ehAdmin(sessao: Sessao) {
  return sessao.role === "admin";
}