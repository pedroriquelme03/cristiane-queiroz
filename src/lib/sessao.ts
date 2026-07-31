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
  empresa: {
    nome: string;
    unidades: number;
    colaboradores: number;
  } | null;
}

export const getSessao = cache(async (): Promise<Sessao> => {
  const supabase = await createClient();

  // getClaims valida a assinatura do JWT e evita consultar o endpoint de
  // usuários quando o projeto usa chaves assimétricas.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const usuarioId = claims?.sub;
  if (claimsError || !usuarioId) {
    throw new Error("Usuário não autenticado");
  }

  // Perfil e vínculo são independentes e podem ser carregados juntos. A
  // empresa vem no mesmo join para alimentar o cabeçalho sem uma nova query.
  const [profileResult, vinculoResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", usuarioId)
      .maybeSingle(),
    supabase
      .from("empresa_membros")
      .select("empresa_id, empresa:empresas(razao_social, nome_fantasia, qtd_funcionarios, unidades(id))")
      .eq("user_id", usuarioId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw new Error("Não foi possível carregar o perfil");
  if (vinculoResult.error) throw new Error("Não foi possível carregar o vínculo da empresa");

  // O trigger normalmente cria o perfil no signup; o fallback cobre contas
  // antigas sem transformar falhas de rede em tentativas de inserção.
  let profile = profileResult.data;
  if (!profile) {
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: usuarioId, role: "cliente" })
      .select("role")
      .single();

    if (insertError || !inserted) {
      throw new Error("Não foi possível criar o perfil");
    }
    profile = inserted;
  }

  const vinculo = vinculoResult.data;
  const empresaJoin = vinculo?.empresa;
  const empresa = Array.isArray(empresaJoin) ? empresaJoin[0] : empresaJoin;
  const metadata = claims.user_metadata;
  const nomeMetadata = metadata && typeof metadata === "object" && "nome" in metadata
    ? metadata.nome
    : null;
  const email = typeof claims.email === "string" ? claims.email : "";

  return {
    usuarioId,
    nome: typeof nomeMetadata === "string" && nomeMetadata ? nomeMetadata : email || "Usuário",
    email,
    role: profile.role as Papel,
    empresaId: vinculo?.empresa_id ?? "",
    empresa: empresa ? {
      nome: empresa.razao_social ?? empresa.nome_fantasia ?? "Empresa sem nome",
      unidades: Array.isArray(empresa.unidades) ? empresa.unidades.length : 0,
      colaboradores: empresa.qtd_funcionarios ?? 0,
    } : null,
  };
});

export function ehAdmin(sessao: Sessao) {
  return sessao.role === "admin";
}
