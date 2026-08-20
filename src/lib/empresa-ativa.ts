import type { Papel } from "@/lib/types";

/** Resolve a empresa ativa: admin usa ?empresa=, demais usam a da sessão. */
export function empresaAtiva(
  sessao: { role: Papel; empresaId: string | null },
  empresaParam?: string | string[],
) {
  if (sessao.role === "admin" && typeof empresaParam === "string" && empresaParam) {
    return empresaParam;
  }
  return sessao.empresaId;
}
