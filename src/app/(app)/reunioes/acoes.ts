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
  const admin = sessao.role === "admin";
  const empresaId = admin ? empresaIdInformada : sessao.empresaId;
  const tipo = admin ? String(formData.get("tipo") ?? "reuniao") : "reuniao";
  const titulo = String(formData.get("titulo") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const participantes = String(formData.get("participantes") ?? "").trim();
  const ata = String(formData.get("ata") ?? "").trim();
  const gravacaoUrl = String(formData.get("gravacaoUrl") ?? "").trim();

  if (!empresaId) campos.empresaId = "Selecione a empresa.";
  if (admin && !TIPOS.includes(tipo)) campos.tipo = "Selecione reunião ou treinamento.";
  if (!titulo) campos.titulo = "Informe o título.";
  if (!data || Number.isNaN(new Date(data).getTime())) campos.data = "Informe data e hora.";
  if (!admin && data && new Date(data).getTime() <= Date.now()) {
    campos.data = "Escolha uma data futura.";
  }
  if (admin && !participantes) campos.participantes = "Informe os participantes.";
  if (admin && gravacaoUrl) {
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
  if (!admin) {
    const resultado = await criarSolicitacaoReuniao(
      empresaId,
      sessao.nome,
      titulo,
      dataReuniao,
      ata,
    );
    if (resultado) return { erro: resultado, valores };

    revalidatePath("/");
    revalidatePath("/reunioes");
    revalidatePath("/", "layout");
    return { ok: true };
  }

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

async function criarSolicitacaoReuniao(
  empresaId: string,
  usuario: string,
  titulo: string,
  dataReuniao: Date,
  observacoes: string,
) {
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from("empresas")
    .select("nome_fantasia, razao_social")
    .eq("id", empresaId)
    .single();

  if (empresaError || !empresa) return "Não foi possível identificar a empresa.";

  const empresaNome = empresa.nome_fantasia || empresa.razao_social;
  const quando = dataReuniao.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  const detalhe = observacoes ? ` Motivo: ${observacoes}` : "";
  const { error } = await supabaseAdmin.from("alertas").insert({
    empresa_id: empresaId,
    tipo: "solicitacao_reuniao",
    severidade: "atencao",
    titulo: "Solicitação de reunião",
    descricao: `${usuario}, da empresa ${empresaNome}, solicitou uma reunião para ${quando}. Assunto: ${titulo}.${detalhe}`,
  });

  return error ? "Não foi possível enviar a solicitação." : null;
}

export async function aceitarSolicitacaoReuniao(solicitacaoId: string) {
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Não autorizado.");

  const { data: solicitacao, error: solicitacaoError } = await supabaseAdmin
    .from("alertas")
    .select("id, empresa_id, descricao, resolvido")
    .eq("id", solicitacaoId)
    .eq("tipo", "solicitacao_reuniao")
    .maybeSingle();

  if (solicitacaoError || !solicitacao) throw new Error("Solicitação não encontrada.");
  if (solicitacao.resolvido) return;

  const dados = extrairDadosSolicitacao(solicitacao.descricao ?? "");
  if (!dados) throw new Error("Não foi possível identificar os dados da solicitação.");

  const { error: reuniaoError } = await supabaseAdmin.from("reunioes").insert({
    empresa_id: solicitacao.empresa_id,
    tipo: "reuniao",
    titulo: dados.assunto,
    data: dados.data.toISOString(),
    participantes: `${dados.usuario} e Consultoria CQ`,
    ata: dados.motivo || "Reunião solicitada pelo cliente.",
    created_by: sessao.usuarioId,
  });

  if (reuniaoError) throw new Error("Não foi possível agendar a reunião solicitada.");

  const { error } = await supabaseAdmin
    .from("alertas")
    .update({ resolvido: true })
    .eq("id", solicitacaoId)
    .eq("resolvido", false);

  if (error) throw new Error("Não foi possível concluir a solicitação.");
  await criarAlertaReuniaoAgendada(solicitacao.empresa_id, dados.assunto, dados.data);
  revalidatePath("/reunioes");
  revalidatePath("/", "layout");
}

function extrairDadosSolicitacao(descricao: string) {
  const data = descricao.match(/para (\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})\./);
  const assunto = descricao.match(/Assunto: (.*?)(?:\. Motivo:|\.$)/);
  const usuario = descricao.match(/^(.*?), da empresa/);
  const motivo = descricao.match(/\. Motivo: (.*)$/);
  if (!data || !assunto || !usuario) return null;

  const [, dia, mes, ano, hora, minuto] = data;
  const dataSolicitada = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00-03:00`);
  if (Number.isNaN(dataSolicitada.getTime())) return null;

  return {
    usuario: usuario[1].trim(),
    assunto: assunto[1].trim(),
    motivo: motivo?.[1].trim() ?? "",
    data: dataSolicitada,
  };
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
