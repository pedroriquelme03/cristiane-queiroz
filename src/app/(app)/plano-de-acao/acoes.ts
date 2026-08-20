"use server";

import { revalidatePath } from "next/cache";

import { parseData, parseValor } from "@/lib/importacao/parsers";
import { getSessao, type Sessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StatusAcao } from "@/lib/types";

export interface EstadoPlanoAcao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const AREAS = ["financeiro", "compras", "estoque", "comercial", "rh", "processos", "tecnologia", "gestao"];
const PRIORIDADES = ["baixa", "media", "alta", "critica"];
const STATUS: StatusAcao[] = ["nao_iniciado", "em_andamento", "concluido", "cancelado"];

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

function inteiroEntre(valor: FormDataEntryValue | null, min: number, max: number) {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= min && numero <= max ? numero : null;
}

export async function salvarPlanoAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await getSessao();
  const valores = valoresEnviados(formData);
  if (sessao.role !== "admin") {
    return { erro: "Apenas administradores podem criar ou editar ações.", valores };
  }

  const id = String(formData.get("id") ?? "").trim();
  const empresaId = String(formData.get("empresaId") ?? "").trim();
  const problema = String(formData.get("problema") ?? "").trim();
  const acao = String(formData.get("acao") ?? "").trim();
  const area = String(formData.get("area") ?? "");
  const responsavel = String(formData.get("responsavel") ?? "").trim();
  const prazoBruto = String(formData.get("prazo") ?? "").trim();
  const prazo = parseData(prazoBruto) ?? "";
  const prioridade = String(formData.get("prioridade") ?? "");
  const status = String(formData.get("status") ?? "nao_iniciado") as StatusAcao;
  const percentual = inteiroEntre(formData.get("percentual"), 0, 100);
  const impactoTexto = String(formData.get("impactoEstimado") ?? "").trim();
  const impactoEstimado = impactoTexto ? parseValor(impactoTexto) : null;
  const campos: Record<string, string> = {};

  if (!empresaId) campos.empresaId = "Selecione uma empresa.";
  if (!problema) campos.problema = "Informe o problema identificado.";
  if (!acao) campos.acao = "Informe a ação proposta.";
  if (!AREAS.includes(area)) campos.area = "Selecione uma área.";
  if (!responsavel) campos.responsavel = "Informe o responsável.";
  if (!prazo) campos.prazo = "Informe o prazo no formato dd/mm/aaaa.";
  if (!PRIORIDADES.includes(prioridade)) campos.prioridade = "Selecione a prioridade.";
  if (!STATUS.includes(status)) campos.status = "Selecione o status.";
  if (percentual === null) campos.percentual = "Use um número inteiro de 0 a 100.";
  if (impactoTexto && (impactoEstimado === null || impactoEstimado < 0)) {
    campos.impactoEstimado = "Informe um valor igual ou maior que zero.";
  }
  if (Object.keys(campos).length) return { campos, valores };

  const registro = {
    problema,
    acao,
    area,
    responsavel,
    prazo,
    prioridade,
    status,
    percentual: status === "concluido" ? 100 : percentual!,
    impacto_estimado: impactoEstimado,
  };

  if (id) {
    const { data: anterior, error: buscaError } = await supabaseAdmin
      .from("planos_acao")
      .select("id, empresa_id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado")
      .eq("id", id)
      .maybeSingle();
    if (buscaError || !anterior || anterior.empresa_id !== empresaId) {
      return { erro: "Ação não encontrada para a empresa selecionada.", valores };
    }

    const { error } = await supabaseAdmin.from("planos_acao").update(registro).eq("id", id);
    if (error) return { erro: "Não foi possível atualizar a ação.", valores };
    await registrarHistorico(sessao, {
      planoAcaoId: id,
      empresaId,
      tipo: "alterada",
      descricao: `Ação atualizada: ${acao}`,
      alteracoes: diferencas(anterior, registro),
    });
  } else {
    const { data, error } = await supabaseAdmin
      .from("planos_acao")
      .insert({ ...registro, empresa_id: empresaId, created_by: sessao.usuarioId })
      .select("id")
      .single();
    if (error || !data) return { erro: "Não foi possível criar a ação.", valores };
    await registrarHistorico(sessao, {
      planoAcaoId: data.id,
      empresaId,
      tipo: "criada",
      descricao: `Ação criada: ${acao}`,
      alteracoes: registro,
    });
  }

  revalidatePath("/");
  revalidatePath("/plano-de-acao");
  return { ok: true };
}

export async function atualizarProgresso(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await getSessao();
  const valores = valoresEnviados(formData);
  if (sessao.role !== "admin" && sessao.role !== "cliente") {
    return { erro: "Seu perfil não pode atualizar o progresso das ações.", valores };
  }
  const id = String(formData.get("id") ?? "").trim();
  const statusInformado = String(formData.get("status") ?? "") as StatusAcao;
  const percentualInformado = inteiroEntre(formData.get("percentual"), 0, 100);
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 1000);
  const campos: Record<string, string> = {};

  if (!id) return { erro: "Ação não informada.", valores };
  if (!STATUS.includes(statusInformado) || (sessao.role !== "admin" && statusInformado === "cancelado")) {
    campos.status = "Selecione um status permitido.";
  }
  if (percentualInformado === null) campos.percentual = "Use um número inteiro de 0 a 100.";
  if (Object.keys(campos).length) return { campos, valores };

  const { data: acao, error: buscaError } = await supabaseAdmin
    .from("planos_acao")
    .select("id, empresa_id, acao, status, percentual")
    .eq("id", id)
    .maybeSingle();
  if (buscaError || !acao) return { erro: "Ação não encontrada.", valores };
  if (sessao.role !== "admin" && acao.empresa_id !== sessao.empresaId) {
    return { erro: "Você não tem acesso a esta ação.", valores };
  }

  let status = statusInformado;
  let percentual = percentualInformado!;
  if (status === "concluido" || percentual === 100) {
    status = "concluido";
    percentual = 100;
  } else if (percentual > 0 && status === "nao_iniciado") {
    status = "em_andamento";
  }

  const { error } = await supabaseAdmin
    .from("planos_acao")
    .update({ status, percentual })
    .eq("id", id);
  if (error) return { erro: "Não foi possível atualizar o progresso.", valores };

  await registrarHistorico(sessao, {
    planoAcaoId: id,
    empresaId: acao.empresa_id,
    tipo: "progresso",
    descricao: comentario || `Progresso atualizado de ${acao.percentual}% para ${percentual}%.`,
    alteracoes: {
      status: { anterior: acao.status, atual: status },
      percentual: { anterior: acao.percentual, atual: percentual },
    },
  });

  revalidatePath("/");
  revalidatePath("/plano-de-acao");
  return { ok: true };
}

export async function excluirPlanoAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await getSessao();
  if (sessao.role !== "admin") return { erro: "Apenas administradores podem excluir ações." };
  const id = String(formData.get("id") ?? "").trim();
  const { data: acao } = await supabaseAdmin
    .from("planos_acao")
    .select("id, empresa_id, acao")
    .eq("id", id)
    .maybeSingle();
  if (!acao) return { erro: "Ação não encontrada." };

  await registrarHistorico(sessao, {
    planoAcaoId: id,
    empresaId: acao.empresa_id,
    tipo: "excluida",
    descricao: `Ação excluída: ${acao.acao}`,
    alteracoes: {},
  });
  const { error } = await supabaseAdmin.from("planos_acao").delete().eq("id", id);
  if (error) return { erro: "Não foi possível excluir a ação." };

  revalidatePath("/");
  revalidatePath("/plano-de-acao");
  return { ok: true };
}

function diferencas(anterior: Record<string, unknown>, atual: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(atual)
      .filter(([campo, valor]) => String(anterior[campo] ?? "") !== String(valor ?? ""))
      .map(([campo, valor]) => [campo, { anterior: anterior[campo] ?? null, atual: valor }]),
  );
}

async function registrarHistorico(
  sessao: Sessao,
  evento: {
    planoAcaoId: string;
    empresaId: string;
    tipo: "criada" | "alterada" | "progresso" | "excluida";
    descricao: string;
    alteracoes: unknown;
  },
) {
  // A mutação principal não falha se a migration de histórico ainda não foi aplicada.
  await supabaseAdmin.from("plano_acao_historico").insert({
    plano_acao_id: evento.planoAcaoId,
    empresa_id: evento.empresaId,
    tipo: evento.tipo,
    descricao: evento.descricao,
    alteracoes: evento.alteracoes,
    created_by: sessao.usuarioId,
    autor_nome: sessao.nome,
  });
}
