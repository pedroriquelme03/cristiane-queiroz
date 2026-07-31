"use server";

import { revalidatePath } from "next/cache";

import { parseValor } from "@/lib/importacao/parsers";
import { getSessao, type Sessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { esquemaLancamento, esquemaTitulo, statusDoTitulo } from "@/lib/validacao/financeiro";

export interface EstadoFormulario {
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

async function contextoFinanceiro(formData: FormData) {
  const sessao = await getSessao();
  if (sessao.role !== "admin" && sessao.role !== "cliente") {
    return { erro: "Seu perfil não pode alterar dados financeiros." } as const;
  }

  const empresaInformada = String(formData.get("empresaId") ?? "").trim();
  const empresaId = sessao.role === "admin" ? empresaInformada : sessao.empresaId;
  if (!empresaId) return { erro: "Selecione uma empresa antes de continuar." } as const;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return { erro: "Empresa não encontrada." } as const;
  return { sessao, empresaId } as const;
}

async function planoContaPertenceAEmpresa(empresaId: string, planoContaId?: string) {
  if (!planoContaId) return true;
  const { data } = await supabaseAdmin
    .from("plano_contas")
    .select("id")
    .eq("id", planoContaId)
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  return Boolean(data);
}

export async function salvarLancamento(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresEnviados(formData);
  const analise = esquemaLancamento.safeParse(Object.fromEntries(formData));
  if (!analise.success) return { campos: errosPorCampo(analise.error.issues), valores };

  const contexto = await contextoFinanceiro(formData);
  if ("erro" in contexto) return { erro: contexto.erro, valores };
  const { sessao, empresaId } = contexto;
  const id = String(formData.get("id") ?? "").trim();

  if (!(await planoContaPertenceAEmpresa(empresaId, analise.data.planoContaId))) {
    return { campos: { planoContaId: "Classificação inválida para esta empresa." }, valores };
  }

  const registro = {
    data: analise.data.data,
    tipo: analise.data.tipo,
    valor: analise.data.valor,
    descricao: analise.data.descricao,
    contraparte: analise.data.contraparte ?? null,
    documento: analise.data.documento ?? null,
    plano_conta_id: analise.data.planoContaId ?? null,
  };

  if (id) {
    const atual = await buscarLancamentoAutorizado(id, empresaId, sessao);
    if (!atual) return { erro: "Lançamento não encontrado.", valores };
    if (atual.origem !== "manual") {
      return { erro: "Lançamentos gerados por baixas ou integrações não podem ser editados manualmente.", valores };
    }
    const { error } = await supabaseAdmin.from("lancamentos").update(registro).eq("id", id);
    if (error) return { erro: "Não foi possível atualizar o lançamento.", valores };
  } else {
    const { error } = await supabaseAdmin.from("lancamentos").insert({
      ...registro,
      empresa_id: empresaId,
      origem: "manual",
      created_by: sessao.usuarioId,
    });
    if (error) return { erro: "Não foi possível salvar o lançamento.", valores };
  }

  revalidarFinanceiro();
  return { ok: true };
}

export async function excluirLancamento(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const contexto = await contextoFinanceiro(formData);
  if ("erro" in contexto) return { erro: contexto.erro };
  const id = String(formData.get("id") ?? "").trim();
  const atual = await buscarLancamentoAutorizado(id, contexto.empresaId, contexto.sessao);
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (atual.origem !== "manual") {
    return { erro: "Este lançamento foi gerado por uma baixa e não pode ser excluído manualmente." };
  }

  const { error } = await supabaseAdmin.from("lancamentos").delete().eq("id", id);
  if (error) return { erro: "Não foi possível excluir o lançamento." };
  revalidarFinanceiro();
  return { ok: true };
}

export async function salvarTitulo(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresEnviados(formData);
  const analise = esquemaTitulo.safeParse(Object.fromEntries(formData));
  if (!analise.success) return { campos: errosPorCampo(analise.error.issues), valores };

  const contexto = await contextoFinanceiro(formData);
  if ("erro" in contexto) return { erro: contexto.erro, valores };
  const { sessao, empresaId } = contexto;
  const id = String(formData.get("id") ?? "").trim();

  if (!(await planoContaPertenceAEmpresa(empresaId, analise.data.planoContaId))) {
    return { campos: { planoContaId: "Classificação inválida para esta empresa." }, valores };
  }

  let valorPago = 0;
  let tipo = analise.data.tipo;
  if (id) {
    const atual = await buscarTituloAutorizado(id, empresaId, sessao);
    if (!atual) return { erro: "Título não encontrado.", valores };
    valorPago = Number(atual.valor_pago);
    tipo = atual.tipo;
    if (analise.data.valor < valorPago) {
      return {
        campos: { valor: `O valor não pode ser menor que o total já baixado (${valorPago.toFixed(2)}).` },
        valores,
      };
    }
  }

  const status = statusDoTitulo(analise.data.valor, valorPago);
  const registro = {
    tipo,
    contraparte: analise.data.contraparte,
    documento: analise.data.documento ?? null,
    emissao: analise.data.emissao ?? null,
    vencimento: analise.data.vencimento,
    valor: analise.data.valor,
    plano_conta_id: analise.data.planoContaId ?? null,
    status,
  };

  if (id) {
    const { error } = await supabaseAdmin.from("titulos").update(registro).eq("id", id);
    if (error) return { erro: "Não foi possível atualizar o título.", valores };
  } else {
    const { error } = await supabaseAdmin.from("titulos").insert({
      ...registro,
      empresa_id: empresaId,
      valor_pago: 0,
      origem: "manual",
      created_by: sessao.usuarioId,
    });
    if (error) return { erro: "Não foi possível salvar o título.", valores };
  }

  revalidarFinanceiro();
  return { ok: true };
}

export async function registrarBaixaTitulo(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = valoresEnviados(formData);
  const contexto = await contextoFinanceiro(formData);
  if ("erro" in contexto) return { erro: contexto.erro, valores };
  const id = String(formData.get("id") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const valor = parseValor(formData.get("valor"));
  const campos: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) campos.data = "Informe a data da baixa.";
  if (data > new Date().toISOString().slice(0, 10)) campos.data = "A baixa não pode ter data futura.";
  if (valor === null || valor <= 0) campos.valor = "Informe um valor maior que zero.";
  if (Object.keys(campos).length) return { campos, valores };

  const titulo = await buscarTituloAutorizado(id, contexto.empresaId, contexto.sessao);
  if (!titulo) return { erro: "Título não encontrado.", valores };
  if (titulo.status === "pago" || titulo.status === "cancelado") {
    return { erro: "Este título não aceita novas baixas.", valores };
  }

  const saldo = Number(titulo.valor) - Number(titulo.valor_pago);
  if (valor! > saldo) {
    return { campos: { valor: `A baixa não pode superar o saldo de ${saldo.toFixed(2)}.` }, valores };
  }

  const novoValorPago = Number(titulo.valor_pago) + valor!;
  const novoStatus = statusDoTitulo(Number(titulo.valor), novoValorPago);
  const descricao = titulo.tipo === "pagar"
    ? `Pagamento: ${titulo.contraparte}`
    : `Recebimento: ${titulo.contraparte}`;

  const { data: lancamento, error: lancamentoError } = await supabaseAdmin
    .from("lancamentos")
    .insert({
      empresa_id: titulo.empresa_id,
      plano_conta_id: titulo.plano_conta_id,
      data,
      tipo: titulo.tipo === "pagar" ? "saida" : "entrada",
      valor,
      descricao,
      contraparte: titulo.contraparte,
      documento: titulo.documento,
      origem: "integracao",
      created_by: contexto.sessao.usuarioId,
    })
    .select("id")
    .single();
  if (lancamentoError || !lancamento) {
    return { erro: "Não foi possível registrar a movimentação da baixa.", valores };
  }

  const { data: tituloAtualizado, error: tituloError } = await supabaseAdmin
    .from("titulos")
    .update({ valor_pago: novoValorPago, status: novoStatus, data_pagamento: data })
    .eq("id", titulo.id)
    .eq("valor_pago", titulo.valor_pago)
    .select("id")
    .maybeSingle();
  if (tituloError || !tituloAtualizado) {
    await supabaseAdmin.from("lancamentos").delete().eq("id", lancamento.id);
    return { erro: "O título foi atualizado em outra sessão. A movimentação foi revertida; tente novamente.", valores };
  }

  revalidarFinanceiro();
  return { ok: true };
}

export async function excluirTitulo(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const contexto = await contextoFinanceiro(formData);
  if ("erro" in contexto) return { erro: contexto.erro };
  const id = String(formData.get("id") ?? "").trim();
  const titulo = await buscarTituloAutorizado(id, contexto.empresaId, contexto.sessao);
  if (!titulo) return { erro: "Título não encontrado." };
  if (Number(titulo.valor_pago) > 0) {
    return { erro: "Títulos com baixa registrada não podem ser excluídos." };
  }

  const { error } = await supabaseAdmin.from("titulos").delete().eq("id", id);
  if (error) return { erro: "Não foi possível excluir o título." };
  revalidarFinanceiro();
  return { ok: true };
}

async function buscarLancamentoAutorizado(id: string, empresaId: string, sessao: Sessao) {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("lancamentos")
    .select("id, empresa_id, origem")
    .eq("id", id)
    .maybeSingle();
  if (!data || (sessao.role !== "admin" && data.empresa_id !== empresaId)) return null;
  if (sessao.role === "admin" && data.empresa_id !== empresaId) return null;
  return data;
}

async function buscarTituloAutorizado(id: string, empresaId: string, sessao: Sessao) {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("titulos")
    .select("id, empresa_id, tipo, contraparte, documento, valor, valor_pago, status, plano_conta_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || (sessao.role !== "admin" && data.empresa_id !== empresaId)) return null;
  if (sessao.role === "admin" && data.empresa_id !== empresaId) return null;
  return data;
}

function revalidarFinanceiro() {
  for (const rota of [
    "/",
    "/financeiro/fluxo-de-caixa",
    "/financeiro/contas-a-pagar",
    "/financeiro/contas-a-receber",
    "/financeiro/dre",
    "/indicadores",
  ]) revalidatePath(rota);
}
