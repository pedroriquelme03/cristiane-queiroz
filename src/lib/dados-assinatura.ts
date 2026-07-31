/**
 * Fronteira de dados do modulo de assinaturas.
 * As telas leem planos, assinaturas e faturas diretamente do Supabase.
 */
import { cache } from "react";

import { calcularEstado } from "@/lib/assinatura";
import { getSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  Assinatura,
  Empresa,
  EstadoAssinatura,
  Fatura,
  Plano,
  TenantAssinatura,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export const getPlanos = cache(async (): Promise<Plano[]> => {
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .order("ordem")
    .order("nome");

  if (error) throw new Error("Nao foi possivel carregar os planos.");
  return (data ?? []).map(mapPlano);
});

/** Planos visíveis na vitrine do cliente. */
export async function getPlanosPublicos(): Promise<Plano[]> {
  return (await getPlanos()).filter((p) => p.publico && p.ativo);
}

export const getPlano = cache(async (id: string): Promise<Plano | null> => {
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Nao foi possivel carregar o plano.");
  return data ? mapPlano(data) : null;
});

// ---------------------------------------------------------------------------
// Assinatura de uma empresa
// ---------------------------------------------------------------------------

export const getAssinaturaEmpresa = cache(async (
  empresaId: string,
): Promise<{ assinatura: Assinatura; plano: Plano; faturas: Fatura[] } | null> => {
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("assinaturas")
    .select(`
      *,
      empresa:empresas(*),
      plano:planos(*),
      faturas(*)
    `)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw new Error("Nao foi possivel carregar a assinatura da empresa.");
  const tenant = data ? mapTenant(data as unknown as TenantSupabase) : null;
  if (!tenant) return null;
  return {
    assinatura: tenant.assinatura,
    plano: tenant.plano,
    faturas: tenant.faturas,
  };
});

/** Estado calculado da empresa da sessão atual. Consumido pelo guarda. */
export async function getEstadoAssinaturaAtual(): Promise<EstadoAssinatura | null> {
  const sessao = await getSessao();
  const assinatura = await getAssinaturaEmpresa(sessao.empresaId);
  if (!assinatura) return null;
  return calcularEstado(assinatura.assinatura, assinatura.faturas);
}

export const getFaturasEmpresa = cache(async (empresaId: string): Promise<Fatura[]> => {
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("faturas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("vencimento", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar as faturas.");
  return (data ?? []).map(mapFatura);
});

// ---------------------------------------------------------------------------
// Visão do super admin: carteira de tenants
// ---------------------------------------------------------------------------

export const getTenants = cache(async (): Promise<TenantAssinatura[]> => {
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("assinaturas")
    .select(`
      *,
      empresa:empresas(*),
      plano:planos(*),
      faturas(*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar assinaturas.");
  return (data ?? [])
    .flatMap((row) => {
      const tenant = mapTenant(row as unknown as TenantSupabase);
      return tenant ? [tenant] : [];
    });
});

export interface ResumoAdmin {
  totalTenants: number;
  ativos: number;
  emTrial: number;
  inadimplentes: number;
  bloqueados: number;
  /** Receita recorrente mensal dos tenants ativos/inadimplentes (não bloqueados). */
  mrr: number;
  /** Total em faturas vencidas em aberto na carteira. */
  inadimplenciaValor: number;
}

export async function getResumoAdmin(): Promise<ResumoAdmin> {
  const tenants = await getTenants();

  let mrr = 0;
  let inadimplenciaValor = 0;
  const conta = { ativos: 0, emTrial: 0, inadimplentes: 0, bloqueados: 0 };

  for (const t of tenants) {
    const { status } = t.estado;
    if (status === "ativa") conta.ativos += 1;
    if (status === "trial") conta.emTrial += 1;
    if (status === "inadimplente") conta.inadimplentes += 1;
    if (status === "bloqueada") conta.bloqueados += 1;

    // MRR: normaliza o anual para mensal; ignora bloqueados e cancelados
    if (status === "ativa" || status === "inadimplente" || status === "trial") {
      const mensal =
        t.assinatura.ciclo === "anual"
          ? (t.plano.precoAnual ?? t.plano.precoMensal * 12) / 12
          : t.plano.precoMensal;
      mrr += mensal;
    }

    inadimplenciaValor += t.estado.emCarencia || status === "bloqueada" ? t.estado.totalEmAberto : 0;
  }

  return {
    totalTenants: tenants.length,
    ...conta,
    mrr,
    inadimplenciaValor,
  };
}

type EmpresaSupabase = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: Empresa["segmento"] | null;
  regime_tributario: Empresa["regimeTributario"] | null;
  data_abertura: string | null;
  qtd_funcionarios: number | null;
};

type PlanoSupabase = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number | string;
  preco_anual: number | string | null;
  trial_dias: number;
  recursos: unknown;
  limite_usuarios: number | null;
  limite_empresas: number | null;
  publico: boolean;
  ativo: boolean;
  ordem: number;
};

type AssinaturaSupabase = {
  id: string;
  empresa_id: string;
  plano_id: string;
  ciclo: Assinatura["ciclo"];
  status: Assinatura["status"];
  dia_vencimento: number;
  carencia_dias: number;
  inicio: string;
  trial_fim: string | null;
  bloqueio_manual: boolean;
  cancelada_em: string | null;
};

type FaturaSupabase = {
  id: string;
  assinatura_id: string;
  empresa_id: string;
  competencia: string;
  emissao: string;
  vencimento: string;
  valor: number | string;
  valor_pago: number | string;
  status: Fatura["status"];
  pago_em: string | null;
  metodo_pagamento: Fatura["metodoPagamento"];
  referencia_externa: string | null;
  observacao: string | null;
};

type TenantSupabase = AssinaturaSupabase & {
  empresa: EmpresaSupabase | EmpresaSupabase[] | null;
  plano: PlanoSupabase | PlanoSupabase[] | null;
  faturas: FaturaSupabase[] | null;
};

function numero(valor: number | string | null) {
  return typeof valor === "string" ? Number(valor) : valor ?? 0;
}

async function criarSupabaseObrigatorio() {
  if (!supabaseConfigurado) {
    throw new Error("Supabase nao configurado. Configure as chaves para carregar dados reais.");
  }
  return createClient();
}

function normalizarJoin<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

function dataIso(valor: string) {
  return valor.slice(0, 10);
}

function mapEmpresa(row: EmpresaSupabase): Empresa {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia ?? row.razao_social,
    cnpj: row.cnpj ?? "",
    segmento: row.segmento ?? "geral",
    regimeTributario: row.regime_tributario ?? "simples",
    dataAbertura: row.data_abertura ?? "",
    qtdFuncionarios: row.qtd_funcionarios ?? 0,
    unidades: [],
  };
}

function mapPlano(row: PlanoSupabase): Plano {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao ?? "",
    precoMensal: numero(row.preco_mensal),
    precoAnual: row.preco_anual === null ? null : numero(row.preco_anual),
    trialDias: row.trial_dias,
    recursos: Array.isArray(row.recursos) ? row.recursos.map(String) : [],
    limiteUsuarios: row.limite_usuarios,
    limiteEmpresas: row.limite_empresas,
    publico: row.publico,
    ativo: row.ativo,
    ordem: row.ordem,
  };
}

function mapAssinatura(row: AssinaturaSupabase): Assinatura {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    planoId: row.plano_id,
    ciclo: row.ciclo,
    status: row.status,
    diaVencimento: row.dia_vencimento,
    carenciaDias: row.carencia_dias,
    inicio: dataIso(row.inicio),
    trialFim: row.trial_fim ? dataIso(row.trial_fim) : null,
    bloqueioManual: row.bloqueio_manual,
    canceladaEm: row.cancelada_em ? dataIso(row.cancelada_em) : null,
  };
}

function mapTenant(row: TenantSupabase): TenantAssinatura | null {
  const empresa = normalizarJoin(row.empresa);
  const plano = normalizarJoin(row.plano);
  if (!empresa || !plano) return null;

  const assinatura = mapAssinatura(row);
  const faturas = (row.faturas ?? [])
    .map(mapFatura)
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));

  return {
    empresa: mapEmpresa(empresa),
    plano: mapPlano(plano),
    assinatura,
    estado: calcularEstado(assinatura, faturas),
    faturas,
  };
}

function mapFatura(row: FaturaSupabase): Fatura {
  return {
    id: row.id,
    assinaturaId: row.assinatura_id,
    empresaId: row.empresa_id,
    competencia: dataIso(row.competencia),
    emissao: dataIso(row.emissao),
    vencimento: dataIso(row.vencimento),
    valor: numero(row.valor),
    valorPago: numero(row.valor_pago),
    status: row.status,
    pagoEm: row.pago_em ? dataIso(row.pago_em) : null,
    metodoPagamento: row.metodo_pagamento,
    referenciaExterna: row.referencia_externa,
    observacao: row.observacao,
  };
}
