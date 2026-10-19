"use server";

import { revalidatePath } from "next/cache";

import { registrarHistoricoAvaliacaoDiagnostico } from "@/app/(app)/diagnostico/acoes";
import { exigirSessao, temPapel } from "@/lib/autorizacao";
import { AREAS_AVALIACAO, type TipoAvaliacao } from "@/lib/avaliacoes";
import { type Sessao } from "@/lib/sessao";
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
  const sessao = await exigirSessao();
  const valores = valoresEnviados(formData);
  const campos: Record<string, string> = {};

  if (!temPapel(sessao, ["admin"])) {
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
      sessao,
      observacoes: String(formData.get("observacoes") ?? "").trim(),
      notas,
      formData,
    });
    if (resultado) return { erro: resultado, valores };
    revalidatePath("/diagnostico");
    revalidatePath("/diagnostico/relatorio");
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
  sessao,
  observacoes,
  notas,
  formData,
}: {
  empresaId: string;
  competencia: string;
  sessao: Sessao;
  observacoes: string;
  notas: { categoria: string; valor: number }[];
  formData: FormData;
}) {
  // Upsert só da avaliação: nota + observação. Campos de execução (realizado,
  // data_realizacao, progresso) não entram no payload e permanecem intactos.
  const { data, error } = await supabaseAdmin
    .from("diagnosticos")
    .upsert(
      {
        empresa_id: empresaId,
        competencia,
        observacoes: observacoes || null,
        created_by: sessao.usuarioId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,competencia" },
    )
    .select("id")
    .single();

  if (error || !data) {
    // Compatível se updated_at ainda não existir.
    if (error && /updated_at/i.test(error.message)) {
      const retry = await supabaseAdmin
        .from("diagnosticos")
        .upsert(
          {
            empresa_id: empresaId,
            competencia,
            observacoes: observacoes || null,
            created_by: sessao.usuarioId,
          },
          { onConflict: "empresa_id,competencia" },
        )
        .select("id")
        .single();
      if (retry.error || !retry.data) return "Não foi possível salvar o diagnóstico.";
      return await gravarItensAvaliacao(retry.data.id, empresaId, sessao, notas, formData);
    }
    return "Não foi possível salvar o diagnóstico.";
  }

  return await gravarItensAvaliacao(data.id, empresaId, sessao, notas, formData);
}

async function gravarItensAvaliacao(
  diagnosticoId: string,
  empresaId: string,
  sessao: Sessao,
  notas: { categoria: string; valor: number }[],
  formData: FormData,
) {
  const { error: itensError } = await supabaseAdmin.from("diagnostico_itens").upsert(
    notas.map(({ categoria, valor }) => ({
      diagnostico_id: diagnosticoId,
      categoria,
      nota: valor,
      observacao: String(formData.get(`observacao_${categoria}`) ?? "").trim() || null,
    })),
    { onConflict: "diagnostico_id,categoria" },
  );

  if (itensError) {
    return "O diagnóstico foi criado, mas não foi possível salvar suas áreas.";
  }

  await registrarHistoricoAvaliacaoDiagnostico(sessao, {
    diagnosticoId,
    empresaId,
    descricao: `Avaliação salva (${notas.length} áreas).`,
    alteracoes: {
      notas: Object.fromEntries(notas.map((n) => [n.categoria, n.valor])),
    },
  });

  return null;
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
