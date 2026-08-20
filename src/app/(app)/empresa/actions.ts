"use server";

import { revalidatePath } from "next/cache";

import { parseData } from "@/lib/importacao/parsers";
import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RegimeTributario, Segmento } from "@/lib/types";

const SEGMENTOS: Segmento[] = ["geral", "hotelaria", "comercio", "servicos", "industria", "alimentacao"];
const REGIMES: RegimeTributario[] = ["simples", "presumido", "real", "mei"];
const TIPOS_UNIDADE = ["matriz", "filial", "cd", "loja"];

export interface EstadoFormularioEstrutura {
  ok?: boolean;
  erro?: string;
}

async function validarPodeEditarEmpresa(empresaId: string) {
  const sessao = await getSessao();
  if (sessao.role === "admin") return sessao;
  if (sessao.empresaId === empresaId) return sessao;
  throw new Error("Não autorizado");
}

function revalidarEmpresa(empresaId: string) {
  revalidatePath("/empresa");
  revalidatePath("/empresa/estrutura");
  revalidatePath("/cadastros", "layout");
  revalidatePath("/inicio");
  revalidatePath(`/admin/empresas/${empresaId}`);
  revalidatePath(`/admin/empresas/${empresaId}/estrutura`);
}

async function totalPosicoesCadastradas(empresaId: string) {
  const { data, error } = await supabaseAdmin
    .from("estrutura_cargos")
    .select("quantidade")
    .eq("empresa_id", empresaId);

  if (error) throw new Error("Não foi possível conferir os cargos da empresa.");
  return (data ?? []).reduce((total, cargo) => total + cargo.quantidade, 0);
}

async function garantirTotalMinimoDeColaboradores(empresaId: string) {
  const [totalPosicoes, empresaResultado] = await Promise.all([
    totalPosicoesCadastradas(empresaId),
    supabaseAdmin.from("empresas").select("qtd_funcionarios").eq("id", empresaId).single(),
  ]);

  if (empresaResultado.error) throw new Error("Não foi possível conferir os colaboradores da empresa.");
  const totalAtual = empresaResultado.data.qtd_funcionarios ?? 0;
  if (totalAtual >= totalPosicoes) return;

  const { error } = await supabaseAdmin
    .from("empresas")
    .update({ qtd_funcionarios: totalPosicoes })
    .eq("id", empresaId);

  if (error) throw new Error("Não foi possível atualizar o total de colaboradores.");
}

export async function salvarCadastroEmpresa(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);

  const razaoSocial = String(formData.get("razao_social") ?? "").trim();
  const nomeFantasia = String(formData.get("nome_fantasia") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
  const segmento = String(formData.get("segmento") ?? "geral") as Segmento;
  const regimeTributario = String(formData.get("regime_tributario") ?? "simples") as RegimeTributario;
  const dataAberturaBruta = String(formData.get("data_abertura") ?? "").trim();
  const dataAbertura = dataAberturaBruta ? parseData(dataAberturaBruta) : null;
  if (dataAberturaBruta && !dataAbertura) {
    throw new Error("Informe a data de abertura no formato dd/mm/aaaa.");
  }
  const qtdFuncionariosInformada = Number(formData.get("qtd_funcionarios") ?? 0);

  if (!razaoSocial || !nomeFantasia) throw new Error("Informe razão social e nome fantasia.");
  if (!/^\d{14}$/.test(cnpj)) throw new Error("O CNPJ deve conter exatamente 14 números.");
  if (!SEGMENTOS.includes(segmento)) throw new Error("Segmento inválido.");
  if (!REGIMES.includes(regimeTributario)) throw new Error("Regime tributário inválido.");
  if (!Number.isInteger(qtdFuncionariosInformada) || qtdFuncionariosInformada < 0) {
    throw new Error("Informe uma quantidade de funcionários válida.");
  }

  const qtdFuncionarios = Math.max(
    qtdFuncionariosInformada,
    await totalPosicoesCadastradas(empresaId),
  );

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
  const qtdFuncionariosInformada = Number(formData.get("qtd_funcionarios") ?? 0);

  if (!Number.isInteger(qtdFuncionariosInformada) || qtdFuncionariosInformada < 0) {
    throw new Error("Informe uma quantidade de colaboradores válida.");
  }

  const qtdFuncionarios = Math.max(
    qtdFuncionariosInformada,
    await totalPosicoesCadastradas(empresaId),
  );

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

  const { data: area, error: areaError } = await supabaseAdmin
    .from("estrutura_areas")
    .select("id")
    .eq("id", areaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (areaError || !area) throw new Error("A área selecionada não pertence a esta empresa.");

  const { error } = await supabaseAdmin
    .from("estrutura_cargos")
    .upsert(
      { empresa_id: empresaId, area_id: areaId, nome, quantidade },
      { onConflict: "area_id,nome" },
  );
  if (error) throw new Error("Não foi possível cadastrar o cargo.");
  await garantirTotalMinimoDeColaboradores(empresaId);
  revalidarEmpresa(empresaId);
}

export async function adicionarCargoComEstado(
  empresaId: string,
  areaId: string,
  _estado: EstadoFormularioEstrutura,
  formData: FormData,
): Promise<EstadoFormularioEstrutura> {
  try {
    await adicionarCargo(empresaId, areaId, formData);
    return { ok: true };
  } catch (error) {
    return {
      erro: error instanceof Error ? error.message : "Não foi possível salvar o cargo.",
    };
  }
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

export async function adicionarColaborador(empresaId: string, formData: FormData) {
  await validarPodeEditarEmpresa(empresaId);
  const nome = String(formData.get("nome") ?? "").trim();
  const nascimentoBruto = String(formData.get("data_nascimento") ?? "").trim();
  const dataNascimento = parseData(nascimentoBruto);
  if (!nome) throw new Error("Informe o nome do colaborador.");
  if (!dataNascimento) throw new Error("Informe a data de nascimento no formato dd/mm/aaaa.");

  const { error } = await supabaseAdmin.from("colaboradores").insert({
    empresa_id: empresaId,
    nome,
    data_nascimento: dataNascimento,
    ativo: true,
  });
  if (error) {
    if (/colaboradores/i.test(error.message)) {
      throw new Error("Falta aplicar a migration 0016_colaboradores.sql no Supabase.");
    }
    throw new Error("Não foi possível cadastrar o colaborador.");
  }
  revalidarEmpresa(empresaId);
}

export async function removerColaborador(empresaId: string, colaboradorId: string) {
  await validarPodeEditarEmpresa(empresaId);
  const { error } = await supabaseAdmin
    .from("colaboradores")
    .delete()
    .eq("id", colaboradorId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error("Não foi possível remover o colaborador.");
  revalidarEmpresa(empresaId);
}
