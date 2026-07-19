"use server";

import { esquemaLancamento, esquemaTitulo, statusDoTitulo } from "@/lib/validacao/financeiro";
import { supabaseConfigurado } from "@/lib/supabase/config";

export interface EstadoFormulario {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  /**
   * Valores submetidos, devolvidos para repovoar o formulário. O React limpa
   * os campos não controlados depois que a action roda, então sem isto o
   * usuário perderia tudo que digitou a cada erro de validação.
   */
  valores?: Record<string, string>;
}

/** Converte os issues do zod no formato que os formulários consomem. */
function errosPorCampo(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const chave = String(issue.path[0] ?? "");
    if (chave) campos[chave] ??= issue.message;
  }
  return campos;
}

/** Campos internos do React ($ACTION_*) não voltam para o formulário. */
function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

const AGUARDANDO_BANCO =
  "Validado com sucesso, mas a gravação depende do banco, que ainda não foi provisionado.";

export async function salvarLancamento(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const analise = esquemaLancamento.safeParse(Object.fromEntries(formData));
  if (!analise.success) {
    return {
      campos: errosPorCampo(analise.error.issues),
      valores: valoresEnviados(formData),
    };
  }

  if (!supabaseConfigurado) {
    return { erro: AGUARDANDO_BANCO, valores: valoresEnviados(formData) };
  }

  // TODO(supabase): insert em public.lancamentos com o empresa_id da sessão.
  // O RLS já garante que só admin e consultor conseguem gravar.
  return { ok: true };
}

export async function salvarTitulo(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const analise = esquemaTitulo.safeParse(Object.fromEntries(formData));
  if (!analise.success) {
    return {
      campos: errosPorCampo(analise.error.issues),
      valores: valoresEnviados(formData),
    };
  }

  // Status é derivado, nunca digitado — mesma regra que a tela de títulos usa
  void statusDoTitulo(analise.data.valor, analise.data.valorPago);

  if (!supabaseConfigurado) {
    return { erro: AGUARDANDO_BANCO, valores: valoresEnviados(formData) };
  }

  // TODO(supabase): insert em public.titulos com o empresa_id da sessão.
  return { ok: true };
}
