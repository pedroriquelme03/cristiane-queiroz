"use server";

import { revalidatePath } from "next/cache";

import { PLANO_CONTAS_PADRAO } from "@/lib/plano-contas-padrao";
import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { GrupoDre, PlanoConta } from "@/lib/types";

export interface EstadoPlanoContas {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

async function contextoEmpresa(formData: FormData) {
  const sessao = await getSessao();
  if (sessao.role !== "admin" && sessao.role !== "cliente") {
    return { erro: "Seu perfil não pode alterar o plano de contas." } as const;
  }
  const empresaInformada = String(formData.get("empresaId") ?? "").trim();
  const empresaId = sessao.role === "admin" ? empresaInformada : sessao.empresaId;
  if (!empresaId) return { erro: "Selecione uma empresa antes de continuar." } as const;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return { sessao, empresaId } as const;
}

function revalidar() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/financeiro/plano-de-contas");
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro/contas-a-receber");
}

export async function salvarContaPlano(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };

  const id = String(formData.get("id") ?? "").trim();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as PlanoConta["tipo"];
  const grupoDre = String(formData.get("grupoDre") ?? "") as GrupoDre;
  const campos: Record<string, string> = {};

  if (!codigo) campos.codigo = "Informe o código.";
  if (!nome) campos.nome = "Informe o nome da conta.";
  if (!["receita", "deducao", "custo", "despesa", "investimento", "nao_operacional"].includes(tipo)) {
    campos.tipo = "Selecione o tipo.";
  }
  if (
    ![
      "receita_bruta",
      "deducoes",
      "custo_variavel",
      "despesa_pessoal",
      "despesa_administrativa",
      "despesa_comercial",
      "despesa_financeira",
      "investimento",
      "nao_operacional",
      "outros",
    ].includes(grupoDre)
  ) {
    campos.grupoDre = "Selecione o grupo da DRE.";
  }
  if (Object.keys(campos).length) return { campos };

  const registro = {
    codigo,
    nome,
    tipo,
    grupo_dre: grupoDre,
    ativo: true,
  };

  if (id) {
    const { error } = await supabaseAdmin
      .from("plano_contas")
      .update(registro)
      .eq("id", id)
      .eq("empresa_id", contexto.empresaId);
    if (error) {
      if (error.code === "23505") return { campos: { codigo: "Já existe uma conta com este código." } };
      return { erro: "Não foi possível atualizar a conta." };
    }
  } else {
    const { error } = await supabaseAdmin.from("plano_contas").insert({
      ...registro,
      empresa_id: contexto.empresaId,
    });
    if (error) {
      if (error.code === "23505") return { campos: { codigo: "Já existe uma conta com este código." } };
      return { erro: "Não foi possível salvar a conta." };
    }
  }

  revalidar();
  return { ok: true };
}

export async function carregarPlanoContasPadrao(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };

  const registros = PLANO_CONTAS_PADRAO.map((conta) => ({
    empresa_id: contexto.empresaId,
    codigo: conta.codigo,
    nome: conta.nome,
    tipo: conta.tipo,
    grupo_dre: conta.grupoDre,
    ativo: true,
  }));

  const { error } = await supabaseAdmin
    .from("plano_contas")
    .upsert(registros, { onConflict: "empresa_id,codigo" });

  if (error) return { erro: "Não foi possível carregar o plano padrão." };
  revalidar();
  return { ok: true };
}

export async function desativarContaPlano(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { erro: "Conta não encontrada." };

  const { error } = await supabaseAdmin
    .from("plano_contas")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", contexto.empresaId);

  if (error) return { erro: "Não foi possível remover a conta." };
  revalidar();
  return { ok: true };
}
