"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function validarDocumento(documento: string): { ok: true; tipo: "cpf" | "cnpj" } | { ok: false; erro: string } {
  if (/^\d{11}$/.test(documento)) return { ok: true, tipo: "cpf" };
  if (/^\d{14}$/.test(documento)) return { ok: true, tipo: "cnpj" };
  return { ok: false, erro: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." };
}

async function exigirAdmin() {
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Acesso negado.");
  return sessao;
}

export async function cadastrarClienteConsultoria(
  _prevState: { error?: string; ok?: boolean } | null,
  formData: FormData,
) {
  await exigirAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const documento = somenteDigitos(String(formData.get("documento") ?? ""));
  const valorMensal = Number(String(formData.get("valor_mensal") ?? "").replace(",", "."));

  if (!nome) return { error: "Informe o nome do cliente." };

  const doc = validarDocumento(documento);
  if (!doc.ok) return { error: doc.erro };

  if (!Number.isFinite(valorMensal) || valorMensal <= 0) {
    return { error: "Informe o valor mensal pago pelo cliente." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clientes_consultoria").insert({
    nome,
    tipo_documento: doc.tipo,
    documento,
    valor_mensal: valorMensal,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um cliente cadastrado com este CPF/CNPJ." };
    }
    return { error: "Não foi possível cadastrar o cliente." };
  }

  revalidatePath("/admin/clientes/consultoria");
  return { ok: true };
}

export async function removerClienteConsultoria(id: string) {
  await exigirAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes_consultoria")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Não foi possível remover o cliente.");

  revalidatePath("/admin/clientes/consultoria");
}
