/**
 * Ponto único de autorização das server actions.
 *
 * Muitas actions gravam com o cliente `service_role` (supabaseAdmin), que ignora
 * o RLS. A segurança dessas escritas depende, então, de uma checagem no código —
 * e antes essa checagem estava reimplementada em cada arquivo. Concentrá-la aqui
 * cria um chokepoint auditável: toda decisão de "quem pode escrever o quê" passa
 * por estas funções, e uma action nova que esqueça de chamá-las fica visível.
 *
 * Regras (espelham o RLS, ver supabase/migrations/0002_rls.sql):
 *   - admin      -> qualquer empresa.
 *   - cliente    -> apenas a própria empresa (vínculo em empresa_membros).
 *   - consultor  -> escrita nas empresas em que é membro (via RLS; as actions
 *                   com service_role tratam consultor como a própria sessão).
 */
import { ehAdmin, getSessao, type Sessao } from "@/lib/sessao";
import type { Papel } from "@/lib/types";

/** Erro de autorização — as actions que lançam usam esta classe. */
export class ErroAutorizacao extends Error {
  constructor(mensagem = "Não autorizado") {
    super(mensagem);
    this.name = "ErroAutorizacao";
  }
}

/** Sessão autenticada. `getSessao` já lança se não houver usuário. */
export const exigirSessao = getSessao;

/** true se a sessão tem um dos papéis informados. */
export function temPapel(sessao: Sessao, papeis: Papel[]): boolean {
  return papeis.includes(sessao.role);
}

/** Exige admin; lança `ErroAutorizacao` com a mensagem dada. Devolve a sessão. */
export async function exigirAdmin(mensagem = "Não autorizado"): Promise<Sessao> {
  const sessao = await getSessao();
  if (!ehAdmin(sessao)) throw new ErroAutorizacao(mensagem);
  return sessao;
}

/** true se a sessão pode ESCREVER na empresa: admin, ou o próprio tenant. */
export function podeEditarEmpresa(sessao: Sessao, empresaId: string): boolean {
  return ehAdmin(sessao) || (Boolean(empresaId) && sessao.empresaId === empresaId);
}

/** Exige poder editar a empresa; lança `ErroAutorizacao` se não puder. */
export async function exigirEdicaoEmpresa(
  empresaId: string,
  mensagem = "Não autorizado",
): Promise<Sessao> {
  const sessao = await getSessao();
  if (!podeEditarEmpresa(sessao, empresaId)) throw new ErroAutorizacao(mensagem);
  return sessao;
}

/**
 * Resolve a empresa-alvo de uma escrita de tenant, sem lançar (para as actions
 * que devolvem estado de formulário).
 *   - `papeis`: quem pode escrever (ex.: ['admin','cliente']).
 *   - admin usa o `empresaId` enviado no formulário; os demais papéis usam
 *     sempre o vínculo da própria sessão — nunca podem escolher outra empresa.
 * Retorna `{ sessao, empresaId }` ou `{ erro }`.
 */
export async function resolverEmpresaAlvo(
  empresaIdInformada: string,
  opcoes: { papeis: Papel[]; negado: string; semEmpresa: string },
): Promise<{ sessao: Sessao; empresaId: string } | { erro: string }> {
  const sessao = await getSessao();
  if (!temPapel(sessao, opcoes.papeis)) return { erro: opcoes.negado };
  const empresaId = ehAdmin(sessao) ? empresaIdInformada.trim() : sessao.empresaId;
  if (!empresaId) return { erro: opcoes.semEmpresa };
  return { sessao, empresaId };
}
