/**
 * Sessão do usuário atual. Fronteira única: hoje devolve um mock; quando o
 * Supabase existir, lê o profile + empresa da sessão autenticada.
 *
 * Na demonstração o papel é 'admin' (super admin da CQ), para que o painel de
 * administração e todas as telas fiquem visíveis. Trocar para 'cliente' mostra
 * a plataforma na perspectiva do tenant.
 */
import { EMPRESA } from "@/lib/mock/gerador";
import type { Papel } from "@/lib/types";

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  role: Papel;
  /** Empresa (tenant) que a sessão está visualizando. */
  empresaId: string;
}

const SESSAO_MOCK: Sessao = {
  usuarioId: "user-cq",
  nome: "Cristiane Queiroz",
  email: "cristiane@cqconsultoria.com.br",
  role: "admin",
  empresaId: EMPRESA.id,
};

export async function getSessao(): Promise<Sessao> {
  // TODO(supabase): ler profiles.role e a empresa ativa da sessão.
  return SESSAO_MOCK;
}

export function ehAdmin(sessao: Sessao) {
  return sessao.role === "admin";
}
