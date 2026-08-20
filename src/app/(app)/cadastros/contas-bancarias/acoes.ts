"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { ContaBancaria } from "@/lib/types";

export interface EstadoContaBancaria {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

const TIPOS: ContaBancaria["tipo"][] = ["corrente", "poupanca", "caixa", "aplicacao"];

async function contextoEmpresa(formData: FormData) {
  const sessao = await getSessao();
  if (sessao.role !== "admin" && sessao.role !== "cliente") {
    return { erro: "Seu perfil não pode alterar contas bancárias." } as const;
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
  revalidatePath("/cadastros", "layout");
  revalidatePath("/cadastros/contas-bancarias");
  revalidatePath("/financeiro", "layout");
}

export async function salvarContaBancaria(
  _anterior: EstadoContaBancaria,
  formData: FormData,
): Promise<EstadoContaBancaria> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "corrente") as ContaBancaria["tipo"];
  const saldoBruto = String(formData.get("saldoInicial") ?? "0").replace(",", ".");
  const saldoInicial = Number(saldoBruto);
  const campos: Record<string, string> = {};

  if (!nome) campos.nome = "Informe o nome da conta.";
  if (!TIPOS.includes(tipo)) campos.tipo = "Selecione o tipo.";
  if (!Number.isFinite(saldoInicial)) campos.saldoInicial = "Informe um saldo válido.";
  if (Object.keys(campos).length) return { campos };

  const registro = {
    nome,
    banco,
    tipo,
    saldo_inicial: saldoInicial,
    ativo: true,
  };

  if (id) {
    const { error } = await supabaseAdmin
      .from("contas_bancarias")
      .update(registro)
      .eq("id", id)
      .eq("empresa_id", contexto.empresaId);
    if (error) return { erro: "Não foi possível atualizar a conta." };
  } else {
    const { error } = await supabaseAdmin.from("contas_bancarias").insert({
      ...registro,
      empresa_id: contexto.empresaId,
    });
    if (error) return { erro: "Não foi possível salvar a conta." };
  }

  revalidar();
  return { ok: true };
}

export async function desativarContaBancaria(
  _anterior: EstadoContaBancaria,
  formData: FormData,
): Promise<EstadoContaBancaria> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { erro: "Conta não encontrada." };

  const { error } = await supabaseAdmin
    .from("contas_bancarias")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", contexto.empresaId);

  if (error) return { erro: "Não foi possível remover a conta." };
  revalidar();
  return { ok: true };
}
