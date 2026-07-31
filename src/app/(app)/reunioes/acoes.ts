"use server";

import { revalidatePath } from "next/cache";

import { nivelDoPlano } from "@/lib/acesso-planos";
import { getSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface EstadoReuniao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const TIPOS = ["reuniao", "treinamento"];

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

export async function salvarReuniao(
  _anterior: EstadoReuniao,
  formData: FormData,
): Promise<EstadoReuniao> {
  const sessao = await getSessao();
  const valores = valoresEnviados(formData);
  const campos: Record<string, string> = {};

  const empresaIdInformada = String(formData.get("empresaId") ?? "").trim();
  const empresaId = sessao.role === "admin" ? empresaIdInformada : sessao.empresaId;
  const tipo = String(formData.get("tipo") ?? "reuniao");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const participantes = String(formData.get("participantes") ?? "").trim();
  const ata = String(formData.get("ata") ?? "").trim();
  const gravacaoUrl = String(formData.get("gravacaoUrl") ?? "").trim();

  if (!empresaId) campos.empresaId = "Selecione a empresa.";
  if (!TIPOS.includes(tipo)) campos.tipo = "Selecione reunião ou treinamento.";
  if (!titulo) campos.titulo = "Informe o título.";
  if (!data || Number.isNaN(new Date(data).getTime())) campos.data = "Informe data e hora.";
  if (!participantes) campos.participantes = "Informe os participantes.";
  if (gravacaoUrl) {
    try {
      new URL(gravacaoUrl);
    } catch {
      campos.gravacaoUrl = "Informe uma URL válida.";
    }
  }

  if (Object.keys(campos).length > 0) {
    return { campos, valores };
  }

  if (!supabaseConfigurado) {
    return {
      erro: "Reunião validada. A gravação depende do banco, que ainda não foi provisionado.",
      valores,
    };
  }

  const acessoEnterprise = await empresaTemPlanoEnterprise(empresaId);
  if (!acessoEnterprise) {
    return {
      erro: "Reuniões e treinamentos estão disponíveis apenas para clientes Enterprise.",
      valores,
    };
  }

  const dataReuniao = new Date(data);
  const { error } = await supabaseAdmin.from("reunioes").insert({
    empresa_id: empresaId,
    tipo,
    titulo,
    data: dataReuniao.toISOString(),
    participantes,
    ata: ata || null,
    gravacao_url: gravacaoUrl || null,
    created_by: sessao.usuarioId,
  });

  if (error) {
    return {
      erro: "Não foi possível registrar a reunião.",
      valores,
    };
  }

  if (dataReuniao.getTime() > Date.now()) {
    await criarAlertaReuniaoAgendada(empresaId, titulo, dataReuniao);
  }

  revalidatePath("/");
  revalidatePath("/reunioes");
  return { ok: true };
}

async function empresaTemPlanoEnterprise(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select("plano:planos(nome, ordem)")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const plano = normalizarJoin<{ nome: string; ordem: number }>(data?.plano ?? null);
  return nivelDoPlano(plano) === "enterprise";
}

async function criarAlertaReuniaoAgendada(
  empresaId: string,
  titulo: string,
  dataReuniao: Date,
) {
  const quando = dataReuniao.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  await supabaseAdmin.from("alertas").insert({
    empresa_id: empresaId,
    tipo: "reuniao_agendada",
    severidade: "info",
    titulo: "Reunião agendada",
    descricao: `${titulo} em ${quando}.`,
  });
}

function normalizarJoin<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}
