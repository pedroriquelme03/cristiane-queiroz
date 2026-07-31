"use server";

import { revalidatePath } from "next/cache";

import { AREAS_AVALIACAO, type TipoAvaliacao } from "@/lib/avaliacoes";
import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export interface EstadoAvaliacao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

export async function salvarAvaliacao(
  _anterior: EstadoAvaliacao,
  formData: FormData,
): Promise<EstadoAvaliacao> {
  const sessao = await getSessao();
  const valores = valoresEnviados(formData);
  const campos: Record<string, string> = {};

  if (sessao.role !== "admin") {
    return {
      erro: "Apenas administradores podem registrar ou alterar avaliações.",
      valores,
    };
  }

  const tipo = String(formData.get("tipo") ?? "") as TipoAvaliacao;
  const empresaInformada = String(formData.get("empresaId") ?? "").trim();
  const empresaId = empresaInformada;
  const competenciaInformada = String(formData.get("competencia") ?? "").trim();
  const competencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaInformada)
    ? `${competenciaInformada}-01`
    : "";

  if (tipo !== "diagnostico" && tipo !== "maturidade") {
    return { erro: "Tipo de avaliação inválido.", valores };
  }
  if (!empresaId) campos.empresaId = "Selecione uma empresa antes de registrar.";
  if (!competencia) campos.competencia = "Informe uma competência válida.";

  const notas = AREAS_AVALIACAO.map(({ id }) => {
    const valorInformado = formData.get(`nota_${id}`);
    const valor = typeof valorInformado === "string" ? Number(valorInformado) : NaN;
    if (
      typeof valorInformado !== "string" ||
      valorInformado.trim() === "" ||
      !Number.isInteger(valor) ||
      valor < 0 ||
      valor > 100
    ) {
      campos[`nota_${id}`] = "Use um número inteiro de 0 a 100.";
    }
    return { categoria: id, valor };
  });

  if (Object.keys(campos).length > 0) return { campos, valores };
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação.", valores };
  }

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return { erro: "Empresa não encontrada.", valores };

  if (tipo === "diagnostico") {
    const resultado = await salvarDiagnostico({
      empresaId,
      competencia,
      usuarioId: sessao.usuarioId,
      observacoes: String(formData.get("observacoes") ?? "").trim(),
      notas,
      formData,
    });
    if (resultado) return { erro: resultado, valores };
    revalidatePath("/diagnostico");
  } else {
    const resultado = await salvarMaturidade({
      empresaId,
      competencia,
      usuarioId: sessao.usuarioId,
      notas,
    });
    if (resultado) return { erro: resultado, valores };
    revalidatePath("/maturidade");
  }

  return { ok: true };
}

async function salvarDiagnostico({
  empresaId,
  competencia,
  usuarioId,
  observacoes,
  notas,
  formData,
}: {
  empresaId: string;
  competencia: string;
  usuarioId: string;
  observacoes: string;
  notas: { categoria: string; valor: number }[];
  formData: FormData;
}) {
  const { data, error } = await supabaseAdmin
    .from("diagnosticos")
    .upsert(
      {
        empresa_id: empresaId,
        competencia,
        observacoes: observacoes || null,
        created_by: usuarioId,
      },
      { onConflict: "empresa_id,competencia" },
    )
    .select("id")
    .single();

  if (error || !data) return "Não foi possível salvar o diagnóstico.";

  const { error: itensError } = await supabaseAdmin.from("diagnostico_itens").upsert(
    notas.map(({ categoria, valor }) => ({
      diagnostico_id: data.id,
      categoria,
      nota: valor,
      observacao: String(formData.get(`observacao_${categoria}`) ?? "").trim() || null,
    })),
    { onConflict: "diagnostico_id,categoria" },
  );

  return itensError ? "O diagnóstico foi criado, mas não foi possível salvar suas áreas." : null;
}

async function salvarMaturidade({
  empresaId,
  competencia,
  usuarioId,
  notas,
}: {
  empresaId: string;
  competencia: string;
  usuarioId: string;
  notas: { categoria: string; valor: number }[];
}) {
  const pontuacaoGeral = Math.round(
    notas.reduce((total, item) => total + item.valor, 0) / notas.length,
  );
  const { data, error } = await supabaseAdmin
    .from("maturidade_avaliacoes")
    .upsert(
      {
        empresa_id: empresaId,
        competencia,
        pontuacao_geral: pontuacaoGeral,
        created_by: usuarioId,
      },
      { onConflict: "empresa_id,competencia" },
    )
    .select("id")
    .single();

  if (error || !data) return "Não foi possível salvar a avaliação de maturidade.";

  const { error: itensError } = await supabaseAdmin.from("maturidade_itens").upsert(
    notas.map(({ categoria, valor }) => ({
      avaliacao_id: data.id,
      categoria,
      pontuacao: valor,
    })),
    { onConflict: "avaliacao_id,categoria" },
  );

  return itensError
    ? "A avaliação foi criada, mas não foi possível salvar suas áreas."
    : null;
}
