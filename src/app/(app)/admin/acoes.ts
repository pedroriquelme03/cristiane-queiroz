"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esquemaPagamento, esquemaPlano } from "@/lib/validacao/assinatura";

export interface EstadoAdmin {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
  bloqueado?: boolean;
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
  // grava, garantido pelo RLS "planos: admin gerencia".
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

export async function criarAssinatura(
  _anterior: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const sessao = await getSessao();
  if (sessao.role !== "admin") return { erro: "Apenas administradores podem vincular planos." };

  const empresaId = String(formData.get("empresaId") ?? "");
  const planoId = String(formData.get("planoId") ?? "");
  const ciclo = String(formData.get("ciclo") ?? "mensal");
  if (!empresaId || !planoId) return { erro: "Selecione a empresa e o plano." };
  if (ciclo !== "mensal" && ciclo !== "anual") return { erro: "Ciclo inválido." };

  const [{ data: empresa }, { data: plano, error: planoError }, { data: existente }] = await Promise.all([
    supabaseAdmin.from("empresas").select("id").eq("id", empresaId).maybeSingle(),
    supabaseAdmin.from("planos").select("id, ativo, trial_dias, preco_anual").eq("id", planoId).maybeSingle(),
    supabaseAdmin.from("assinaturas").select("id").eq("empresa_id", empresaId).maybeSingle(),
  ]);

  if (!empresa) return { erro: "Empresa não encontrada." };
  if (planoError || !plano || !plano.ativo) return { erro: "Plano não encontrado ou inativo." };
  if (existente) return { erro: "Esta empresa já possui uma assinatura." };
  if (ciclo === "anual" && plano.preco_anual === null) {
    return { erro: "Este plano não oferece cobrança anual." };
  }

  const hoje = new Date();
  const inicio = hoje.toISOString().slice(0, 10);
  const trialDias = plano.trial_dias ?? 0;
  const trialFim = trialDias > 0 ? new Date(hoje) : null;
  trialFim?.setDate(trialFim.getDate() + trialDias);
  const { error } = await supabaseAdmin.from("assinaturas").insert({
    empresa_id: empresaId,
    plano_id: planoId,
    ciclo,
    status: trialDias > 0 ? "trial" : "ativa",
    inicio,
    trial_fim: trialFim?.toISOString().slice(0, 10) ?? null,
    dia_vencimento: Math.min(28, hoje.getDate()),
  });

  if (error) return { erro: "Não foi possível vincular o plano à empresa." };
  revalidatePath("/admin/assinaturas");
  revalidatePath("/admin/gestao");
  revalidatePath(`/admin/empresas/${empresaId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

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

  const sessao = await getSessao();
  if (sessao.role !== "admin") {
    return { erro: "Apenas administradores podem alterar o bloqueio." };
  }

  const supabase = await createClient();
  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("id, status, carencia_dias, trial_fim")
    .eq("id", assinaturaId)
    .single();

  if (assinaturaError || !assinatura) {
    return { erro: "Não foi possível localizar a assinatura." };
  }

  const { data: faturas, error: faturasError } = await supabase
    .from("faturas")
    .select("status, vencimento")
    .eq("assinatura_id", assinaturaId);

  if (faturasError) {
    return { erro: "Não foi possível verificar as faturas da assinatura." };
  }

  const novoStatus = calcularStatusAssinatura({
    bloquear,
    statusAtual: assinatura.status,
    carenciaDias: assinatura.carencia_dias,
    trialFim: assinatura.trial_fim,
    faturas: faturas ?? [],
  });

  const { error } = await supabase
    .from("assinaturas")
    .update({ bloqueio_manual: bloquear, status: novoStatus })
    .eq("id", assinaturaId);

  if (error) {
    return { erro: "Não foi possível alterar o bloqueio da assinatura." };
  }

  revalidatePath("/admin/gestao");
  revalidatePath("/admin/assinaturas");
  return { ok: true, bloqueado: bloquear };
}

function calcularStatusAssinatura({
  bloquear,
  statusAtual,
  carenciaDias,
  trialFim,
  faturas,
}: {
  bloquear: boolean;
  statusAtual: string;
  carenciaDias: number;
  trialFim: string | null;
  faturas: { status: string; vencimento: string }[];
}) {
  if (statusAtual === "cancelada") return "cancelada";
  if (bloquear) return "bloqueada";

  const hoje = inicioDoDia(new Date());
  const limiteCarencia = new Date(hoje);
  limiteCarencia.setDate(limiteCarencia.getDate() - carenciaDias);

  const abertas = faturas.filter((fatura) => fatura.status === "aberta");
  const foraDaCarencia = abertas.some((fatura) => inicioDoDia(fatura.vencimento) < limiteCarencia);
  if (foraDaCarencia) return "bloqueada";

  const vencida = abertas.some((fatura) => inicioDoDia(fatura.vencimento) < hoje);
  if (vencida) return "inadimplente";

  if (trialFim && inicioDoDia(trialFim) >= hoje) return "trial";
  return "ativa";
}

function inicioDoDia(valor: Date | string) {
  const data = typeof valor === "string" ? new Date(`${valor}T00:00:00`) : new Date(valor);
  data.setHours(0, 0, 0, 0);
  return data;
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

  const sessao = await getSessao();
  if (sessao.role !== "admin") {
    return { erro: "Apenas administradores podem trocar planos." };
  }

  const supabase = await createClient();
  const { data: plano, error: planoError } = await supabase
    .from("planos")
    .select("preco_mensal, preco_anual")
    .eq("id", planoId)
    .single();

  if (planoError || !plano) {
    return { erro: "Plano não encontrado." };
  }

  const valor = ciclo === "anual"
    ? Number(plano.preco_anual ?? Number(plano.preco_mensal) * 12)
    : Number(plano.preco_mensal);

  const { error } = await supabase
    .from("assinaturas")
    .update({ plano_id: planoId, ciclo })
    .eq("id", assinaturaId);

  if (error) {
    return { erro: "Não foi possível trocar o plano." };
  }

  const { error: faturasError } = await supabase
    .from("faturas")
    .update({ valor })
    .eq("assinatura_id", assinaturaId)
    .eq("status", "aberta");

  if (faturasError) {
    return { erro: "Plano trocado, mas não foi possível atualizar as faturas abertas." };
  }

  revalidatePath("/admin/gestao");
  revalidatePath("/admin/assinaturas");
  revalidatePath("/assinatura");
  return { ok: true };
}
