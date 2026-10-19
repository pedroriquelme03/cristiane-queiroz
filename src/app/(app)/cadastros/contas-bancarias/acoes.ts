"use server";

import { revalidatePath } from "next/cache";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import { parseData, parseValor } from "@/lib/importacao/parsers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { ContaBancaria } from "@/lib/types";

export interface EstadoContaBancaria {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
}

const TIPOS: ContaBancaria["tipo"][] = ["corrente", "poupanca", "caixa", "aplicacao"];

async function contextoEmpresa(formData: FormData) {
  const alvo = await resolverEmpresaAlvo(String(formData.get("empresaId") ?? ""), {
    papeis: ["admin", "cliente"],
    negado: "Seu perfil não pode alterar contas bancárias.",
    semEmpresa: "Selecione uma empresa antes de continuar.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

function valoresEnviados(formData: FormData) {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of formData) {
    if (!chave.startsWith("$") && typeof valor === "string") valores[chave] = valor;
  }
  return valores;
}

function revalidar() {
  revalidatePath("/cadastros", "layout");
  revalidatePath("/cadastros/contas-bancarias");
  revalidatePath("/financeiro", "layout");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro/contas-a-receber");
}

export async function salvarContaBancaria(
  _anterior: EstadoContaBancaria,
  formData: FormData,
): Promise<EstadoContaBancaria> {
  const valores = valoresEnviados(formData);
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro, valores };

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "corrente") as ContaBancaria["tipo"];
  const saldoInicial = parseValor(formData.get("saldoInicial"));
  const dataSaldoInicial =
    parseData(String(formData.get("dataSaldoInicial") ?? "").trim()) ?? "";
  const campos: Record<string, string> = {};

  if (!nome) campos.nome = "Informe o nome da conta.";
  if (!TIPOS.includes(tipo)) campos.tipo = "Selecione o tipo.";
  if (saldoInicial === null) campos.saldoInicial = "Informe um saldo válido.";
  if (!dataSaldoInicial) campos.dataSaldoInicial = "Informe a data de referência do saldo.";
  if (Object.keys(campos).length) return { campos, valores };

  const registro = {
    nome,
    banco,
    tipo,
    saldo_inicial: saldoInicial,
    data_saldo_inicial: dataSaldoInicial,
    ativo: true,
  };

  if (id) {
    const { data: existente } = await supabaseAdmin
      .from("contas_bancarias")
      .select("id")
      .eq("id", id)
      .eq("empresa_id", contexto.empresaId)
      .maybeSingle();
    if (!existente) return { erro: "Conta não encontrada nesta empresa.", valores };

    const { error } = await supabaseAdmin
      .from("contas_bancarias")
      .update(registro)
      .eq("id", id)
      .eq("empresa_id", contexto.empresaId);
    if (error) {
      if (/data_saldo_inicial/i.test(error.message)) {
        return {
          erro: "Falta aplicar a migration 0027_contas_bancarias_data_saldo.sql no Supabase.",
          valores,
        };
      }
      return { erro: "Não foi possível atualizar a conta.", valores };
    }
  } else {
    const { error } = await supabaseAdmin.from("contas_bancarias").insert({
      ...registro,
      empresa_id: contexto.empresaId,
    });
    if (error) {
      if (/data_saldo_inicial/i.test(error.message)) {
        return {
          erro: "Falta aplicar a migration 0027_contas_bancarias_data_saldo.sql no Supabase.",
          valores,
        };
      }
      return { erro: "Não foi possível salvar a conta.", valores };
    }
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
