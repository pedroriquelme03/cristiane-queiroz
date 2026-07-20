"use server";

import { esquemaPlano } from "@/lib/validacao/assinatura";
import { esquemaPagamento } from "@/lib/validacao/assinatura";
import { supabaseConfigurado } from "@/lib/supabase/config";

export interface EstadoAdmin {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

function errosPorCampo(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const chave = String(issue.path[0] ?? "");
    if (chave) campos[chave] ??= issue.message;
  }
  return campos;
}

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

const AGUARDANDO_BANCO =
  "Validado com sucesso. A gravação depende do banco, que ainda não foi provisionado.";

// ---------------------------------------------------------------------------
// Planos (CRUD)
// ---------------------------------------------------------------------------

export async function salvarPlano(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const analise = esquemaPlano.safeParse(Object.fromEntries(formData));
  if (!analise.success) {
    return {
      campos: errosPorCampo(analise.error.issues),
      valores: valoresEnviados(formData),
    };
  }

  if (!supabaseConfigurado) {
    return { erro: AGUARDANDO_BANCO, valores: valoresEnviados(formData) };
  }

  // TODO(supabase): upsert em public.planos (id vazio = insert). Só admin
  // grava — garantido pelo RLS "planos: admin gerencia".
  return { ok: true };
}

export async function excluirPlano(formData: FormData): Promise<EstadoAdmin> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Plano inválido." };

  if (!supabaseConfigurado) {
    return {
      erro:
        "Exclusão validada. Quando o banco existir, planos com assinaturas ativas serão desativados em vez de apagados, para preservar o histórico de faturas.",
    };
  }

  // TODO(supabase): se houver assinaturas usando o plano, apenas marcar
  // ativo=false; senão, delete. O FK de assinaturas usa on delete restrict.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assinaturas dos tenants
// ---------------------------------------------------------------------------

export async function registrarPagamento(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const analise = esquemaPagamento.safeParse(Object.fromEntries(formData));
  if (!analise.success) {
    return {
      campos: errosPorCampo(analise.error.issues),
      valores: valoresEnviados(formData),
    };
  }

  if (!supabaseConfigurado) {
    return { erro: AGUARDANDO_BANCO, valores: valoresEnviados(formData) };
  }

  // TODO(supabase): update da fatura (valor_pago, pago_em, metodo, status='paga')
  // e chamar rpc('recalcular_status_assinatura', { p_assinatura_id }) para
  // reavaliar o bloqueio. Só admin escreve (RLS).
  return { ok: true };
}

/** Bloqueio/desbloqueio manual, independente das faturas. */
export async function alternarBloqueio(formData: FormData): Promise<EstadoAdmin> {
  const assinaturaId = String(formData.get("assinaturaId") ?? "");
  const bloquear = formData.get("bloquear") === "true";
  if (!assinaturaId) return { erro: "Assinatura inválida." };

  if (!supabaseConfigurado) {
    return {
      erro: bloquear
        ? "Bloqueio validado. Quando o banco existir, o tenant perde o acesso imediatamente."
        : "Desbloqueio validado. Quando o banco existir, o acesso é reavaliado pelas faturas.",
    };
  }

  // TODO(supabase): update assinaturas.bloqueio_manual + recalcular_status.
  return { ok: true };
}

export async function trocarPlano(formData: FormData): Promise<EstadoAdmin> {
  const assinaturaId = String(formData.get("assinaturaId") ?? "");
  const planoId = String(formData.get("planoId") ?? "");
  const ciclo = String(formData.get("ciclo") ?? "mensal");
  if (!assinaturaId || !planoId) return { erro: "Dados incompletos." };
  if (ciclo !== "mensal" && ciclo !== "anual") return { erro: "Ciclo inválido." };

  if (!supabaseConfigurado) {
    return {
      erro:
        "Troca de plano validada. Quando o banco existir, o novo valor passa a valer na próxima fatura.",
    };
  }

  // TODO(supabase): update assinaturas.plano_id/ciclo.
  return { ok: true };
}
