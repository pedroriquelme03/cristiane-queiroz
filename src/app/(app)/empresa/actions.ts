"use server";

import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RegimeTributario, Segmento } from "@/lib/types";

const SEGMENTOS: Segmento[] = ["geral", "hotelaria", "comercio", "servicos", "industria", "alimentacao"];
const REGIMES: RegimeTributario[] = ["simples", "presumido", "real", "mei"];
const TIPOS_UNIDADE = ["matriz", "filial", "cd", "loja"];

async function validarPodeEditarEmpresa(empresaId: string) {
  const sessao = await getSessao();
  if (sessao.role === "admin") return sessao;
  if (sessao.empresaId === empresaId) return sessao;
  throw new Error("Não autorizado");
}

function revalidarEmpresa(empresaId: string) {
  revalidatePath("/empresa");
  revalidatePath("/empresa/estrutura");
  revalidatePath(`/admin/empresas/${empresaId}`);
  revalidatePath(`/admin/empresas/${empresaId}/estrutura`);
}

export async function salvarCadastroEmpresa(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);

  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
  const segmento = String(formData.get("segmento") ?? "geral") as Segmento;
  const regimeTributario = String(formData.get("regime_tributario") ?? "simples") as RegimeTributario;
  const dataAbertura = String(formData.get("data_abertura") ?? "").trim() || null;
  const qtdFuncionarios = Number(formData.get("qtd_funcionarios") ?? 0);

  if (!razaoSocial || !nomeFantasia) throw new Error("Informe razão social e nome fantasia.");
  if (!/^\d{14}$/.test(cnpj)) throw new Error("O CNPJ deve conter exatamente 14 números.");
  if (!SEGMENTOS.includes(segmento)) throw new Error("Segmento inválido.");
  if (!REGIMES.includes(regimeTributario)) throw new Error("Regime tributário inválido.");
  if (!Number.isInteger(qtdFuncionarios) || qtdFuncionarios < 0) {
    throw new Error("Informe uma quantidade de funcionários válida.");
  }

  const { error } = await supabaseAdmin
    .from("empresas")
    .update({
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      cnpj,
      segmento,
      regime_tributario: regimeTributario,
      data_abertura: dataAbertura,
      qtd_funcionarios: qtdFuncionarios,
    })
    .eq("id", empresaId);

  if (error) throw new Error("Não foi possível atualizar o cadastro da empresa.");

  revalidarEmpresa(empresaId);
}

export async function atualizarColaboradores(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);
  const qtdFuncionarios = Number(formData.get("qtd_funcionarios") ?? 0);

  if (!Number.isInteger(qtdFuncionarios) || qtdFuncionarios < 0) {
    throw new Error("Informe uma quantidade de colaboradores válida.");
  }

  const { error } = await supabaseAdmin
    .from("empresas")
    .update({ qtd_funcionarios: qtdFuncionarios })
    .eq("id", empresaId);

  if (error) throw new Error("Não foi possível atualizar os colaboradores.");
  revalidarEmpresa(empresaId);
}

export async function adicionarUnidade(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "filial");
  const cidade = String(formData.get("cidade") ?? "").trim() || null;
  const uf = String(formData.get("uf") ?? "").trim().toUpperCase() || null;
  if (!nome || !TIPOS_UNIDADE.includes(tipo)) {
    throw new Error("Informe os dados válidos da unidade.");
  }

  const { error } = await supabaseAdmin
    .from("unidades")
    .insert({ empresa_id: empresaId, nome, tipo, cidade, uf });
  if (error) throw new Error("Não foi possível cadastrar a unidade.");
  revalidarEmpresa(empresaId);
}

export async function removerUnidade(empresaId: string, unidadeId: string) {
  await validarPodeEditarEmpresa(empresaId);
  const { error } = await supabaseAdmin
    .from("unidades")
    .delete()
    .eq("id", unidadeId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover a unidade.");
  revalidarEmpresa(empresaId);
}

export async function adicionarArea(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Informe o nome da área.");
  const { error } = await supabaseAdmin.from("estrutura_areas").insert({ empresa_id: empresaId, nome });
  if (error) throw new Error("Não foi possível cadastrar a área.");
  revalidarEmpresa(empresaId);
}

export async function removerArea(empresaId: string, areaId: string) {
  await validarPodeEditarEmpresa(empresaId);
  const { error } = await supabaseAdmin
    .from("estrutura_areas")
    .delete()
    .eq("id", areaId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover a área.");
  revalidarEmpresa(empresaId);
}

export async function adicionarCargo(empresaId: string, areaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);
  const nome = String(formData.get("nome") ?? "").trim();
  const quantidade = Number(formData.get("quantidade"));
  if (!nome || !Number.isInteger(quantidade) || quantidade < 0) {
    throw new Error("Informe um cargo e uma quantidade válida.");
  }
  const { error } = await supabaseAdmin
    .from("estrutura_cargos")
    .insert({ empresa_id: empresaId, area_id: areaId, nome, quantidade });
  if (error) throw new Error("Não foi possível cadastrar o cargo.");
  revalidarEmpresa(empresaId);
}

export async function removerCargo(empresaId: string, cargoId: string) {
  await validarPodeEditarEmpresa(empresaId);
  const { error } = await supabaseAdmin
    .from("estrutura_cargos")
    .delete()
    .eq("id", cargoId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover o cargo.");
  revalidarEmpresa(empresaId);
}
