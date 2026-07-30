"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function validarAdmin() {
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Não autorizado");
}

function atualizarEstrutura(empresaId: string) {
  revalidatePath(`/admin/empresas/${empresaId}/estrutura`);
  revalidatePath("/empresa/estrutura");
}

export async function adicionarUnidade(empresaId: string, formData: FormData) {
  await validarAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "filial");
  const cidade = String(formData.get("cidade") ?? "").trim() || null;
  const uf = String(formData.get("uf") ?? "").trim().toUpperCase() || null;
  if (!nome || !["matriz", "filial", "cd", "loja"].includes(tipo)) {
    throw new Error("Informe os dados válidos da unidade.");
  }

  const { error } = await supabaseAdmin
    .from("unidades")
    .insert({ empresa_id: empresaId, nome, tipo, cidade, uf });
  if (error) throw new Error("Não foi possível cadastrar a unidade.");
  atualizarEstrutura(empresaId);
}

export async function removerUnidade(empresaId: string, unidadeId: string) {
  await validarAdmin();
  const { error } = await supabaseAdmin
    .from("unidades")
    .delete()
    .eq("id", unidadeId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover a unidade.");
  atualizarEstrutura(empresaId);
}

export async function adicionarArea(empresaId: string, formData: FormData) {
  await validarAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Informe o nome da área.");
  const { error } = await supabaseAdmin.from("estrutura_areas").insert({ empresa_id: empresaId, nome });
  if (error) throw new Error("Não foi possível cadastrar a área.");
  atualizarEstrutura(empresaId);
}

export async function removerArea(empresaId: string, areaId: string) {
  await validarAdmin();
  const { error } = await supabaseAdmin
    .from("estrutura_areas")
    .delete()
    .eq("id", areaId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover a área.");
  atualizarEstrutura(empresaId);
}

export async function adicionarCargo(empresaId: string, areaId: string, formData: FormData) {
  await validarAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const quantidade = Number(formData.get("quantidade"));
  if (!nome || !Number.isInteger(quantidade) || quantidade < 0) {
    throw new Error("Informe um cargo e uma quantidade válida.");
  }
  const { error } = await supabaseAdmin
    .from("estrutura_cargos")
    .insert({ empresa_id: empresaId, area_id: areaId, nome, quantidade });
  if (error) throw new Error("Não foi possível cadastrar o cargo.");
  atualizarEstrutura(empresaId);
}

export async function removerCargo(empresaId: string, cargoId: string) {
  await validarAdmin();
  const { error } = await supabaseAdmin
    .from("estrutura_cargos")
    .delete()
    .eq("id", cargoId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover o cargo.");
  atualizarEstrutura(empresaId);
}
