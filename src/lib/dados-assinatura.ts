/**
 * Fronteira de dados do módulo de assinaturas. Igual a dados.ts: hoje lê do
 * mock, amanhã lê do Supabase (tabelas planos/assinaturas/faturas e a função
 * empresa_bloqueada) sem que as telas mudem.
 */
import { calcularEstado } from "@/lib/assinatura";
import {
  FATURAS,
  PLANOS,
  TENANTS,
  planoPorId,
} from "@/lib/mock/assinaturas";
import { getSessao } from "@/lib/sessao";
import type {
  Assinatura,
  EstadoAssinatura,
  Fatura,
  Plano,
  TenantAssinatura,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export async function getPlanos(): Promise<Plano[]> {
  return [...PLANOS].sort((a, b) => a.ordem - b.ordem);
}

/** Planos visíveis na vitrine do cliente. */
export async function getPlanosPublicos(): Promise<Plano[]> {
  return (await getPlanos()).filter((p) => p.publico && p.ativo);
}

export async function getPlano(id: string): Promise<Plano | null> {
  return PLANOS.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Assinatura de uma empresa
// ---------------------------------------------------------------------------

function tenantDe(empresaId: string) {
  return TENANTS.find((t) => t.empresa.id === empresaId) ?? null;
}

export async function getAssinaturaEmpresa(
  empresaId: string,
): Promise<{ assinatura: Assinatura; plano: Plano; faturas: Fatura[] } | null> {
  const tenant = tenantDe(empresaId);
  if (!tenant) return null;
  return {
    assinatura: tenant.assinatura,
    plano: planoPorId(tenant.assinatura.planoId),
    faturas: [...tenant.faturas].sort((a, b) =>
      b.vencimento.localeCompare(a.vencimento),
    ),
  };
}

/** Estado calculado da empresa da sessão atual. Consumido pelo guarda. */
export async function getEstadoAssinaturaAtual(): Promise<EstadoAssinatura | null> {
  const sessao = await getSessao();
  const tenant = tenantDe(sessao.empresaId);
  if (!tenant) return null;
  return calcularEstado(tenant.assinatura, tenant.faturas);
}

export async function getFaturasEmpresa(empresaId: string): Promise<Fatura[]> {
  const tenant = tenantDe(empresaId);
  if (!tenant) return [];
  return [...tenant.faturas].sort((a, b) =>
    b.vencimento.localeCompare(a.vencimento),
  );
}

// ---------------------------------------------------------------------------
// Visão do super admin: carteira de tenants
// ---------------------------------------------------------------------------

export async function getTenants(): Promise<TenantAssinatura[]> {
  return TENANTS.map((t) => ({
    empresa: t.empresa,
    plano: planoPorId(t.assinatura.planoId),
    assinatura: t.assinatura,
    estado: calcularEstado(t.assinatura, t.faturas),
    faturas: [...t.faturas].sort((a, b) => b.vencimento.localeCompare(a.vencimento)),
  }));
}

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

/** Só para o script de verificação: faturas do tenant principal. */
export const _FATURAS_DEMO = FATURAS;
