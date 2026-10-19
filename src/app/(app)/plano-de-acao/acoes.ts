"use server";

import { revalidatePath } from "next/cache";

import { exigirSessao, temPapel } from "@/lib/autorizacao";
import { parseData, parseValor } from "@/lib/importacao/parsers";
import { type Sessao } from "@/lib/sessao";
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

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function revalidarPlanoAcao() {
  revalidatePath("/");
  revalidatePath("/plano-de-acao");
  revalidatePath("/plano-de-acao/relatorio");
}

type DatasEfetivas = {
  data_inicio_efetiva: string | null;
  data_conclusao_efetiva: string | null;
};

/** Preenche datas efetivas na transição de status, sem apagar as já registradas. */
function datasParaStatus(status: StatusAcao, atuais: DatasEfetivas): DatasEfetivas {
  const hoje = hojeIso();
  let inicio = atuais.data_inicio_efetiva;
  let conclusao: string | null = null;

  if (status === "em_andamento" || status === "concluido") {
    if (!inicio) inicio = hoje;
  }
  if (status === "concluido") {
    conclusao = atuais.data_conclusao_efetiva || hoje;
    if (inicio && conclusao < inicio) conclusao = inicio;
  }

  return { data_inicio_efetiva: inicio, data_conclusao_efetiva: conclusao };
}

/** Combina datas do formulário com o carimbo automático por status. */
function normalizarDatasAoSalvar(
  status: StatusAcao,
  atuais: DatasEfetivas,
  inicioForm: string | null,
  conclusaoForm: string | null,
): DatasEfetivas {
  const base = datasParaStatus(status, {
    data_inicio_efetiva: inicioForm ?? atuais.data_inicio_efetiva,
    data_conclusao_efetiva: conclusaoForm ?? atuais.data_conclusao_efetiva,
  });
  if (inicioForm) base.data_inicio_efetiva = inicioForm;
  if (status === "concluido") {
    base.data_conclusao_efetiva = conclusaoForm || base.data_conclusao_efetiva || hojeIso();
    if (!base.data_inicio_efetiva) base.data_inicio_efetiva = base.data_conclusao_efetiva;
  } else {
    base.data_conclusao_efetiva = null;
  }
  if (
    base.data_inicio_efetiva &&
    base.data_conclusao_efetiva &&
    base.data_conclusao_efetiva < base.data_inicio_efetiva
  ) {
    base.data_conclusao_efetiva = base.data_inicio_efetiva;
  }
  return base;
}

const SELECAO_ACAO =
  "id, empresa_id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado, data_inicio_efetiva, data_conclusao_efetiva";

async function carregarAcao(id: string) {
  const { data, error } = await supabaseAdmin
    .from("planos_acao")
    .select(SELECAO_ACAO)
    .eq("id", id)
    .maybeSingle();

  if (error && /data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
    const fallback = await supabaseAdmin
      .from("planos_acao")
      .select(
        "id, empresa_id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado",
      )
      .eq("id", id)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    return {
      ...fallback.data,
      data_inicio_efetiva: null as string | null,
      data_conclusao_efetiva: null as string | null,
    };
  }

  if (error || !data) return null;
  return data;
}

export async function salvarPlanoAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await exigirSessao();
  const valores = valoresEnviados(formData);
  if (!temPapel(sessao, ["admin"])) {
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
  const inicioBruto = String(formData.get("dataInicioEfetiva") ?? "").trim();
  const conclusaoBruta = String(formData.get("dataConclusaoEfetiva") ?? "").trim();
  const inicioForm = inicioBruto ? parseData(inicioBruto) ?? inicioBruto.slice(0, 10) : null;
  const conclusaoForm = conclusaoBruta
    ? parseData(conclusaoBruta) ?? conclusaoBruta.slice(0, 10)
    : null;
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
  if (inicioBruto && !inicioForm) campos.dataInicioEfetiva = "Data de início inválida.";
  if (conclusaoBruta && !conclusaoForm) campos.dataConclusaoEfetiva = "Data de conclusão inválida.";
  if (Object.keys(campos).length) return { campos, valores };

  const atuais: DatasEfetivas = {
    data_inicio_efetiva: null,
    data_conclusao_efetiva: null,
  };

  if (id) {
    const anterior = await carregarAcao(id);
    if (!anterior || anterior.empresa_id !== empresaId) {
      return { erro: "Ação não encontrada para a empresa selecionada.", valores };
    }
    atuais.data_inicio_efetiva = anterior.data_inicio_efetiva;
    atuais.data_conclusao_efetiva = anterior.data_conclusao_efetiva;

    const datas = normalizarDatasAoSalvar(status, atuais, inicioForm, conclusaoForm);
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
      ...datas,
    };

    const { error } = await supabaseAdmin.from("planos_acao").update(registro).eq("id", id);
    if (error) {
      if (/data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
        const { data_inicio_efetiva: _i, data_conclusao_efetiva: _c, ...semDatas } = registro;
        const retry = await supabaseAdmin.from("planos_acao").update(semDatas).eq("id", id);
        if (retry.error) return { erro: "Não foi possível atualizar a ação.", valores };
      } else {
        return { erro: "Não foi possível atualizar a ação.", valores };
      }
    }
    await registrarHistorico(sessao, {
      planoAcaoId: id,
      empresaId,
      tipo: "alterada",
      descricao: `Ação atualizada: ${acao}`,
      alteracoes: diferencas(anterior as Record<string, unknown>, registro),
    });
  } else {
    const datas = normalizarDatasAoSalvar(
      status,
      atuais,
      inicioForm,
      conclusaoForm,
    );
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
      ...datas,
    };
    const { data, error } = await supabaseAdmin
      .from("planos_acao")
      .insert({ ...registro, empresa_id: empresaId, created_by: sessao.usuarioId })
      .select("id")
      .single();
    if (error || !data) {
      if (error && /data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
        const { data_inicio_efetiva: _i, data_conclusao_efetiva: _c, ...semDatas } = registro;
        const retry = await supabaseAdmin
          .from("planos_acao")
          .insert({ ...semDatas, empresa_id: empresaId, created_by: sessao.usuarioId })
          .select("id")
          .single();
        if (retry.error || !retry.data) return { erro: "Não foi possível criar a ação.", valores };
        await registrarHistorico(sessao, {
          planoAcaoId: retry.data.id,
          empresaId,
          tipo: "criada",
          descricao: `Ação criada: ${acao}`,
          alteracoes: semDatas,
        });
        revalidarPlanoAcao();
        return { ok: true };
      }
      return { erro: "Não foi possível criar a ação.", valores };
    }
    await registrarHistorico(sessao, {
      planoAcaoId: data.id,
      empresaId,
      tipo: "criada",
      descricao: `Ação criada: ${acao}`,
      alteracoes: registro,
    });
  }

  revalidarPlanoAcao();
  return { ok: true };
}

export async function atualizarProgresso(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await exigirSessao();
  const valores = valoresEnviados(formData);
  if (!temPapel(sessao, ["admin", "cliente"])) {
    return { erro: "Seu perfil não pode atualizar o progresso das ações.", valores };
  }
  const id = String(formData.get("id") ?? "").trim();
  const statusInformado = String(formData.get("status") ?? "") as StatusAcao;
  const percentualInformado = inteiroEntre(formData.get("percentual"), 0, 100);
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 1000);
  const campos: Record<string, string> = {};

  if (!id) return { erro: "Ação não informada.", valores };
  if (!STATUS.includes(statusInformado) || (!temPapel(sessao, ["admin"]) && statusInformado === "cancelado")) {
    campos.status = "Selecione um status permitido.";
  }
  if (percentualInformado === null) campos.percentual = "Use um número inteiro de 0 a 100.";
  if (Object.keys(campos).length) return { campos, valores };

  const acao = await carregarAcao(id);
  if (!acao) return { erro: "Ação não encontrada.", valores };
  if (!temPapel(sessao, ["admin"]) && acao.empresa_id !== sessao.empresaId) {
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

  const datas = datasParaStatus(status, {
    data_inicio_efetiva: acao.data_inicio_efetiva,
    data_conclusao_efetiva: acao.data_conclusao_efetiva,
  });

  const patch = { status, percentual, ...datas };
  const { error } = await supabaseAdmin.from("planos_acao").update(patch).eq("id", id);
  if (error) {
    if (/data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
      const retry = await supabaseAdmin
        .from("planos_acao")
        .update({ status, percentual })
        .eq("id", id);
      if (retry.error) return { erro: "Não foi possível atualizar o progresso.", valores };
    } else {
      return { erro: "Não foi possível atualizar o progresso.", valores };
    }
  }

  await registrarHistorico(sessao, {
    planoAcaoId: id,
    empresaId: acao.empresa_id,
    tipo: "progresso",
    descricao: comentario || `Progresso atualizado de ${acao.percentual}% para ${percentual}%.`,
    alteracoes: {
      status: { anterior: acao.status, atual: status },
      percentual: { anterior: acao.percentual, atual: percentual },
      data_inicio_efetiva: {
        anterior: acao.data_inicio_efetiva,
        atual: datas.data_inicio_efetiva,
      },
      data_conclusao_efetiva: {
        anterior: acao.data_conclusao_efetiva,
        atual: datas.data_conclusao_efetiva,
      },
    },
  });

  revalidarPlanoAcao();
  return { ok: true };
}

/** Inicia a ação pela listagem: status em andamento + data de início efetiva. */
export async function iniciarAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao, ["admin", "cliente"])) {
    return { erro: "Seu perfil não pode iniciar ações." };
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { erro: "Ação não informada." };

  const acao = await carregarAcao(id);
  if (!acao) return { erro: "Ação não encontrada." };
  if (!temPapel(sessao, ["admin"]) && acao.empresa_id !== sessao.empresaId) {
    return { erro: "Você não tem acesso a esta ação." };
  }
  if (acao.status === "concluido" || acao.status === "cancelado") {
    return { erro: "Esta ação não pode ser iniciada no status atual." };
  }
  if (acao.status === "em_andamento" && acao.data_inicio_efetiva) {
    return { ok: true };
  }

  const dataInicio = acao.data_inicio_efetiva || hojeIso();
  const percentual = Math.max(Number(acao.percentual) || 0, 1);
  const patch = {
    status: "em_andamento" as const,
    percentual,
    data_inicio_efetiva: dataInicio,
  };

  const { error } = await supabaseAdmin.from("planos_acao").update(patch).eq("id", id);
  if (error) {
    if (/data_inicio_efetiva/i.test(error.message)) {
      const retry = await supabaseAdmin
        .from("planos_acao")
        .update({ status: "em_andamento", percentual })
        .eq("id", id);
      if (retry.error) return { erro: "Não foi possível iniciar a ação. Aplique a migration 0028." };
    } else {
      return { erro: "Não foi possível iniciar a ação." };
    }
  }

  await registrarHistorico(sessao, {
    planoAcaoId: id,
    empresaId: acao.empresa_id,
    tipo: "progresso",
    descricao: `Ação iniciada em ${dataInicio}.`,
    alteracoes: {
      status: { anterior: acao.status, atual: "em_andamento" },
      percentual: { anterior: acao.percentual, atual: percentual },
      data_inicio_efetiva: { anterior: acao.data_inicio_efetiva, atual: dataInicio },
    },
  });

  revalidarPlanoAcao();
  return { ok: true };
}

export async function iniciarAcaoForm(formData: FormData) {
  return iniciarAcao({}, formData);
}

/** Conclui a ação pela listagem: 100%, status concluído + data de conclusão efetiva. */
export async function concluirAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao, ["admin", "cliente"])) {
    return { erro: "Seu perfil não pode concluir ações." };
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { erro: "Ação não informada." };

  const acao = await carregarAcao(id);
  if (!acao) return { erro: "Ação não encontrada." };
  if (!temPapel(sessao, ["admin"]) && acao.empresa_id !== sessao.empresaId) {
    return { erro: "Você não tem acesso a esta ação." };
  }
  if (acao.status === "cancelado") {
    return { erro: "Ação cancelada não pode ser concluída." };
  }
  if (acao.status === "concluido" && acao.data_conclusao_efetiva) {
    return { ok: true };
  }

  const hoje = hojeIso();
  const dataInicio = acao.data_inicio_efetiva || hoje;
  const dataConclusao = acao.data_conclusao_efetiva || hoje;
  const patch = {
    status: "concluido" as const,
    percentual: 100,
    data_inicio_efetiva: dataInicio,
    data_conclusao_efetiva: dataConclusao < dataInicio ? dataInicio : dataConclusao,
  };

  const { error } = await supabaseAdmin.from("planos_acao").update(patch).eq("id", id);
  if (error) {
    if (/data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
      const retry = await supabaseAdmin
        .from("planos_acao")
        .update({ status: "concluido", percentual: 100 })
        .eq("id", id);
      if (retry.error) {
        return { erro: "Não foi possível concluir a ação. Aplique a migration 0028." };
      }
    } else {
      return { erro: "Não foi possível concluir a ação." };
    }
  }

  await registrarHistorico(sessao, {
    planoAcaoId: id,
    empresaId: acao.empresa_id,
    tipo: "progresso",
    descricao: `Ação concluída em ${patch.data_conclusao_efetiva}.`,
    alteracoes: {
      status: { anterior: acao.status, atual: "concluido" },
      percentual: { anterior: acao.percentual, atual: 100 },
      data_inicio_efetiva: { anterior: acao.data_inicio_efetiva, atual: patch.data_inicio_efetiva },
      data_conclusao_efetiva: {
        anterior: acao.data_conclusao_efetiva,
        atual: patch.data_conclusao_efetiva,
      },
    },
  });

  revalidarPlanoAcao();
  return { ok: true };
}

export async function concluirAcaoForm(formData: FormData) {
  return concluirAcao({}, formData);
}

export async function excluirPlanoAcao(
  _anterior: EstadoPlanoAcao,
  formData: FormData,
): Promise<EstadoPlanoAcao> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao, ["admin"])) return { erro: "Apenas administradores podem excluir ações." };
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

  revalidarPlanoAcao();
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
