"use server";

import { revalidatePath } from "next/cache";

import { exigirSessao, temPapel } from "@/lib/autorizacao";
import { ROTULO_AREA } from "@/lib/avaliacoes";
import { parseData } from "@/lib/importacao/parsers";
import { type Sessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { AreaDiagnostico, ProgressoDiagnostico } from "@/lib/types";

export interface EstadoExecucaoDiagnostico {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const PROGRESSOS: ProgressoDiagnostico[] = [0, 30, 50, 100];

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

function revalidarDiagnostico() {
  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/relatorio");
}

/**
 * Atualiza só a execução de um item (realizado / data / progresso).
 * Não altera nota nem observação da avaliação.
 */
export async function atualizarExecucaoDiagnostico(
  _anterior: EstadoExecucaoDiagnostico,
  formData: FormData,
): Promise<EstadoExecucaoDiagnostico> {
  const sessao = await exigirSessao();
  const valores = valoresEnviados(formData);
  if (!temPapel(sessao, ["admin", "cliente"])) {
    return { erro: "Seu perfil não pode registrar a execução do diagnóstico.", valores };
  }
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação.", valores };
  }

  const itemId = String(formData.get("itemId") ?? "").trim();
  const realizado = String(formData.get("realizado") ?? "").trim().slice(0, 4000);
  const dataBruta = String(formData.get("dataRealizacao") ?? "").trim();
  const dataRealizacao = dataBruta ? parseData(dataBruta) ?? dataBruta.slice(0, 10) : null;
  const progressoNum = Number(formData.get("progresso"));
  const campos: Record<string, string> = {};

  if (!itemId) return { erro: "Item do diagnóstico não informado.", valores };
  if (!PROGRESSOS.includes(progressoNum as ProgressoDiagnostico)) {
    campos.progresso = "Selecione o andamento: 0%, 30%, 50% ou 100%.";
  }
  if (dataBruta && !dataRealizacao) {
    campos.dataRealizacao = "Informe uma data válida.";
  }
  if (progressoNum > 0 && !realizado) {
    campos.realizado = "Descreva o que foi realizado nesta área.";
  }
  if (Object.keys(campos).length) return { campos, valores };

  const { data: item, error: buscaError } = await supabaseAdmin
    .from("diagnostico_itens")
    .select(
      "id, categoria, realizado, data_realizacao, progresso, diagnostico_id, diagnosticos!inner(id, empresa_id)",
    )
    .eq("id", itemId)
    .maybeSingle();

  if (buscaError && /realizado|progresso|data_realizacao/i.test(buscaError.message)) {
    return {
      erro: "Falta aplicar a migration 0029_diagnostico_execucao.sql no Supabase.",
      valores,
    };
  }
  if (buscaError || !item) return { erro: "Item do diagnóstico não encontrado.", valores };

  const diagnostico = Array.isArray(item.diagnosticos) ? item.diagnosticos[0] : item.diagnosticos;
  const empresaId = diagnostico?.empresa_id as string | undefined;
  if (!empresaId) return { erro: "Diagnóstico sem empresa vinculada.", valores };
  if (!temPapel(sessao, ["admin"]) && empresaId !== sessao.empresaId) {
    return { erro: "Você não tem acesso a este diagnóstico.", valores };
  }

  const progresso = progressoNum as ProgressoDiagnostico;
  const patch = {
    realizado: realizado || null,
    data_realizacao: progresso === 0 ? null : dataRealizacao || new Date().toISOString().slice(0, 10),
    progresso,
    updated_by: sessao.usuarioId,
  };

  const { error } = await supabaseAdmin
    .from("diagnostico_itens")
    .update(patch)
    .eq("id", itemId);
  if (error) return { erro: "Não foi possível salvar a execução.", valores };

  // Touch no cabeçalho para refletir última atualização do diagnóstico.
  await supabaseAdmin
    .from("diagnosticos")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", item.diagnostico_id);

  const area = ROTULO_AREA[item.categoria as AreaDiagnostico] ?? item.categoria;
  await registrarHistorico(sessao, {
    diagnosticoId: item.diagnostico_id,
    diagnosticoItemId: itemId,
    empresaId,
    tipo: "execucao",
    descricao: `Execução em ${area}: ${progresso}%`,
    alteracoes: {
      realizado: { anterior: item.realizado, atual: patch.realizado },
      data_realizacao: { anterior: item.data_realizacao, atual: patch.data_realizacao },
      progresso: { anterior: item.progresso, atual: progresso },
    },
  });

  revalidarDiagnostico();
  return { ok: true };
}

async function registrarHistorico(
  sessao: Sessao,
  evento: {
    diagnosticoId: string;
    diagnosticoItemId: string | null;
    empresaId: string;
    tipo: "avaliacao" | "execucao";
    descricao: string;
    alteracoes: unknown;
  },
) {
  await supabaseAdmin.from("diagnostico_historico").insert({
    diagnostico_id: evento.diagnosticoId,
    diagnostico_item_id: evento.diagnosticoItemId,
    empresa_id: evento.empresaId,
    tipo: evento.tipo,
    descricao: evento.descricao,
    alteracoes: evento.alteracoes,
    created_by: sessao.usuarioId,
    autor_nome: sessao.nome,
  });
}

/** Usado por acoes-avaliacoes ao salvar notas (histórico de avaliação). */
export async function registrarHistoricoAvaliacaoDiagnostico(
  sessao: Sessao,
  evento: {
    diagnosticoId: string;
    empresaId: string;
    descricao: string;
    alteracoes: unknown;
  },
) {
  await registrarHistorico(sessao, {
    diagnosticoId: evento.diagnosticoId,
    diagnosticoItemId: null,
    empresaId: evento.empresaId,
    tipo: "avaliacao",
    descricao: evento.descricao,
    alteracoes: evento.alteracoes,
  });
}
