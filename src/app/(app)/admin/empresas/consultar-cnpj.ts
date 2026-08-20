"use server";

import type { Segmento } from "@/lib/types";

export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  segmento: Exclude<Segmento, "geral">;
  dataAbertura: string | null;
};

export type ResultadoCnpj =
  | { ok: true; dados: DadosCnpj }
  | { ok: false; erro: string };

/**
 * Consulta CNPJ com fallback entre provedores públicos.
 * Usada no cadastro de cliente para pré-preencher dados da empresa.
 */
export async function consultarCnpj(cnpjInformado: string): Promise<ResultadoCnpj> {
  const cnpj = cnpjInformado.replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpj)) {
    return { ok: false, erro: "Informe os 14 dígitos do CNPJ." };
  }
  if (!cnpjValido(cnpj)) {
    return { ok: false, erro: "CNPJ inválido. Confira os dígitos e tente de novo." };
  }

  const provedores = [consultarBrasilApi, consultarCnpjWs, consultarCnpja];
  let ultimoErro = "Não foi possível consultar o CNPJ agora. Tente de novo.";

  for (const provedor of provedores) {
    const resultado = await provedor(cnpj);
    if (resultado.ok) return resultado;
    ultimoErro = resultado.erro;
    // CNPJ inexistente não vale tentar outro provedor com a mesma expectativa de 404
    if (resultado.erro.includes("não encontrado")) return resultado;
  }

  return { ok: false, erro: ultimoErro };
}

async function consultarBrasilApi(cnpj: string): Promise<ResultadoCnpj> {
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (resposta.status === 404) {
      return { ok: false, erro: "CNPJ não encontrado na Receita Federal." };
    }
    if (resposta.status === 429) {
      return { ok: false, erro: "Muitas consultas seguidas. Aguarde alguns segundos." };
    }
    if (!resposta.ok) {
      return {
        ok: false,
        erro: `Consulta indisponível no momento (código ${resposta.status}).`,
      };
    }

    const json = (await resposta.json()) as {
      razao_social?: string | null;
      nome_fantasia?: string | null;
      cnae_fiscal_descricao?: string | null;
      data_inicio_atividade?: string | null;
    };

    return montarResultado({
      razaoSocial: json.razao_social,
      nomeFantasia: json.nome_fantasia,
      cnae: json.cnae_fiscal_descricao,
      dataAbertura: json.data_inicio_atividade,
    });
  } catch {
    return { ok: false, erro: "Falha de rede ao consultar o CNPJ." };
  }
}

async function consultarCnpjWs(cnpj: string): Promise<ResultadoCnpj> {
  try {
    const resposta = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (resposta.status === 404) {
      return { ok: false, erro: "CNPJ não encontrado na Receita Federal." };
    }
    if (resposta.status === 429) {
      return { ok: false, erro: "Muitas consultas seguidas. Aguarde alguns segundos." };
    }
    if (!resposta.ok) {
      return {
        ok: false,
        erro: `Consulta indisponível no momento (código ${resposta.status}).`,
      };
    }

    const json = (await resposta.json()) as {
      razao_social?: string | null;
      estabelecimento?: {
        nome_fantasia?: string | null;
        data_inicio_atividade?: string | null;
        atividade_principal?: { descricao?: string | null } | null;
      } | null;
    };

    return montarResultado({
      razaoSocial: json.razao_social,
      nomeFantasia: json.estabelecimento?.nome_fantasia,
      cnae: json.estabelecimento?.atividade_principal?.descricao,
      dataAbertura: json.estabelecimento?.data_inicio_atividade,
    });
  } catch {
    return { ok: false, erro: "Falha de rede ao consultar o CNPJ." };
  }
}

async function consultarCnpja(cnpj: string): Promise<ResultadoCnpj> {
  try {
    const resposta = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (resposta.status === 404) {
      return { ok: false, erro: "CNPJ não encontrado na Receita Federal." };
    }
    if (resposta.status === 429) {
      return { ok: false, erro: "Muitas consultas seguidas. Aguarde alguns segundos." };
    }
    if (!resposta.ok) {
      return {
        ok: false,
        erro: `Consulta indisponível no momento (código ${resposta.status}).`,
      };
    }

    const json = (await resposta.json()) as {
      alias?: string | null;
      founded?: string | null;
      company?: {
        name?: string | null;
      } | null;
      mainActivity?: {
        text?: string | null;
      } | null;
    };

    return montarResultado({
      razaoSocial: json.company?.name,
      nomeFantasia: json.alias,
      cnae: json.mainActivity?.text,
      dataAbertura: json.founded ?? null,
    });
  } catch {
    return { ok: false, erro: "Falha de rede ao consultar o CNPJ." };
  }
}

function montarResultado(entrada: {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnae?: string | null;
  dataAbertura?: string | null;
}): ResultadoCnpj {
  const razaoSocial = (entrada.razaoSocial ?? "").trim();
  if (!razaoSocial) {
    return { ok: false, erro: "A consulta não retornou a razão social deste CNPJ." };
  }

  const nomeFantasia = (entrada.nomeFantasia ?? "").trim() || razaoSocial;

  return {
    ok: true,
    dados: {
      razaoSocial,
      nomeFantasia,
      segmento: inferirSegmento(entrada.cnae ?? ""),
      dataAbertura: entrada.dataAbertura ?? null,
    },
  };
}

function inferirSegmento(cnae: string): Exclude<Segmento, "geral"> {
  const texto = cnae
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (/hotel|pousada|hospedagem|motel|resort|albergue|pensao/.test(texto)) {
    return "hotelaria";
  }
  if (/restaurante|lanchonete|bar|cafe|padaria|aliment|buffet|cantina|churras/.test(texto)) {
    return "alimentacao";
  }
  if (/industri|fabricacao|fabricac|metalurg|quimica|textil/.test(texto)) {
    return "industria";
  }
  if (/comercio|varej|atacad|loja|supermercado|minimercado|distribuid/.test(texto)) {
    return "comercio";
  }
  return "servicos";
}

/** Validação dos dígitos verificadores do CNPJ. */
function cnpjValido(cnpj: string) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string, pesos: number[]) => {
    const soma = base
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), pesos1);
  const d2 = calc(cnpj.slice(0, 12) + String(d1), pesos2);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}
