/**
 * Dados de exemplo do módulo de assinaturas.
 *
 * O tenant principal (Pousada Recanto das Cataratas) fica ATIVA e em dia, para
 * que todas as telas do sistema continuem acessíveis na demonstração. Os demais
 * tenants existem só para o painel do super admin ter uma carteira realista,
 * incluindo um inadimplente em carência e um já bloqueado.
 */
import { EMPRESA } from "@/lib/mock/gerador";
import type {
  Assinatura,
  Empresa,
  Fatura,
  Plano,
  Segmento,
} from "@/lib/types";

const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Data a N dias de hoje (negativo = passado). */
function emDias(n: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Dia 1 do mês a N meses de hoje. */
function competencia(offsetMes: number) {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + offsetMes, 1);
  return iso(d);
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export const PLANOS: Plano[] = [
  {
    id: "plano-essencial",
    nome: "Essencial",
    descricao: "Para quem está organizando a gestão financeira pela primeira vez.",
    precoMensal: 297,
    precoAnual: 2970, // ~2 meses grátis
    trialDias: 14,
    recursos: [
      "Dashboard executivo",
      "Fluxo de caixa e contas a pagar/receber",
      "Importação de planilhas",
      "1 empresa · até 3 usuários",
    ],
    limiteUsuarios: 3,
    limiteEmpresas: 1,
    publico: true,
    ativo: true,
    ordem: 1,
  },
  {
    id: "plano-profissional",
    nome: "Profissional",
    descricao: "Gestão completa com o acompanhamento da consultoria.",
    precoMensal: 597,
    precoAnual: 5970,
    trialDias: 14,
    recursos: [
      "Tudo do Essencial",
      "DRE gerencial e orçamento",
      "Indicadores por segmento",
      "Plano de ação, diagnóstico e maturidade",
      "Até 3 empresas · até 10 usuários",
    ],
    limiteUsuarios: 10,
    limiteEmpresas: 3,
    publico: true,
    ativo: true,
    ordem: 2,
  },
  {
    id: "plano-enterprise",
    nome: "Enterprise",
    descricao: "Para grupos e redes com várias unidades e times.",
    precoMensal: 1197,
    precoAnual: 11970,
    trialDias: 0,
    recursos: [
      "Tudo do Profissional",
      "Empresas e usuários ilimitados",
      "Documentos, reuniões e treinamentos",
      "Consultoria dedicada",
    ],
    limiteUsuarios: null,
    limiteEmpresas: null,
    publico: true,
    ativo: true,
    ordem: 3,
  },
];

export const planoPorId = (id: string) =>
  PLANOS.find((p) => p.id === id) ?? PLANOS[0];

// ---------------------------------------------------------------------------
// Assinatura do tenant principal (ativa, em dia)
// ---------------------------------------------------------------------------

export const ASSINATURA: Assinatura = {
  id: "assin-001",
  empresaId: EMPRESA.id,
  planoId: "plano-profissional",
  ciclo: "mensal",
  status: "ativa",
  diaVencimento: 5,
  carenciaDias: 7,
  inicio: "2025-08-05",
  trialFim: "2025-08-19",
  bloqueioManual: false,
  canceladaEm: null,
};

/** Histórico de faturas do tenant principal: pagas + a próxima em aberto. */
export const FATURAS: Fatura[] = (() => {
  const lista: Fatura[] = [];
  const valor = 597;

  // 5 competências pagas
  for (let i = 5; i >= 1; i -= 1) {
    const comp = competencia(-i);
    const venc = emDias(-i * 30 + 2);
    lista.push({
      id: `fat-${i}`,
      assinaturaId: ASSINATURA.id,
      empresaId: EMPRESA.id,
      competencia: comp,
      emissao: emDias(-i * 30 - 3),
      vencimento: venc,
      valor,
      valorPago: valor,
      status: "paga",
      pagoEm: venc,
      metodoPagamento: i % 2 === 0 ? "pix" : "boleto",
      referenciaExterna: null,
      observacao: null,
    });
  }

  // Fatura corrente em aberto, ainda a vencer
  lista.push({
    id: "fat-atual",
    assinaturaId: ASSINATURA.id,
    empresaId: EMPRESA.id,
    competencia: competencia(0),
    emissao: emDias(-3),
    vencimento: emDias(9),
    valor,
    valorPago: 0,
    status: "aberta",
    pagoEm: null,
    metodoPagamento: null,
    referenciaExterna: null,
    observacao: null,
  });

  return lista.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
})();

// ---------------------------------------------------------------------------
// Carteira de tenants para o painel do super admin
// ---------------------------------------------------------------------------

interface SementeTenant {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segmento: Segmento;
  planoId: string;
  ciclo: "mensal" | "anual";
  /** Vencimento da fatura corrente relativo a hoje, em dias. */
  vencimentoEmDias: number;
  /** A fatura corrente já foi paga? */
  paga: boolean;
  trial?: boolean;
  bloqueioManual?: boolean;
  cancelada?: boolean;
}

const SEMENTES: SementeTenant[] = [
  // ativa em dia — vence daqui a 12 dias
  {
    id: "emp-002", nomeFantasia: "Restaurante Sabor & Arte", razaoSocial: "Sabor e Arte Alimentação Ltda.",
    cnpj: "41522330000188", segmento: "alimentacao", planoId: "plano-essencial", ciclo: "mensal",
    vencimentoEmDias: 12, paga: false,
  },
  // trial
  {
    id: "emp-003", nomeFantasia: "Boutique Vitrine", razaoSocial: "Vitrine Comércio de Roupas Ltda.",
    cnpj: "37110945000122", segmento: "comercio", planoId: "plano-essencial", ciclo: "mensal",
    vencimentoEmDias: 10, paga: false, trial: true,
  },
  // inadimplente dentro da carência — vencida há 3 dias (carência 7)
  {
    id: "emp-004", nomeFantasia: "TransLog Cargas", razaoSocial: "TransLog Transportes Ltda.",
    cnpj: "29884471000150", segmento: "servicos", planoId: "plano-profissional", ciclo: "mensal",
    vencimentoEmDias: -3, paga: false,
  },
  // bloqueada por atraso — vencida há 15 dias
  {
    id: "emp-005", nomeFantasia: "Marmoraria Duarte", razaoSocial: "Duarte Mármores e Granitos Ltda.",
    cnpj: "18463209000174", segmento: "industria", planoId: "plano-profissional", ciclo: "mensal",
    vencimentoEmDias: -15, paga: false,
  },
  // anual em dia
  {
    id: "emp-006", nomeFantasia: "Rede Bem Estar", razaoSocial: "Bem Estar Serviços de Saúde Ltda.",
    cnpj: "50227188000133", segmento: "servicos", planoId: "plano-enterprise", ciclo: "anual",
    vencimentoEmDias: 240, paga: true,
  },
  // bloqueio manual
  {
    id: "emp-007", nomeFantasia: "Auto Peças Veloz", razaoSocial: "Veloz Comércio de Autopeças Ltda.",
    cnpj: "33619052000109", segmento: "comercio", planoId: "plano-essencial", ciclo: "mensal",
    vencimentoEmDias: 5, paga: false, bloqueioManual: true,
  },
];

interface TenantMock {
  empresa: Empresa;
  assinatura: Assinatura;
  faturas: Fatura[];
}

function montarTenant(s: SementeTenant): TenantMock {
  const empresa: Empresa = {
    id: s.id,
    razaoSocial: s.razaoSocial,
    nomeFantasia: s.nomeFantasia,
    cnpj: s.cnpj,
    segmento: s.segmento,
    regimeTributario: "simples",
    dataAbertura: "2019-01-10",
    qtdFuncionarios: 12,
    unidades: [],
  };

  const assinatura: Assinatura = {
    id: `assin-${s.id}`,
    empresaId: s.id,
    planoId: s.planoId,
    ciclo: s.ciclo,
    status: "ativa", // recalculado pelo estado
    diaVencimento: 5,
    carenciaDias: 7,
    inicio: "2025-06-01",
    trialFim: s.trial ? emDias(10) : null,
    bloqueioManual: s.bloqueioManual ?? false,
    canceladaEm: s.cancelada ? emDias(-20) : null,
  };

  const plano = planoPorId(s.planoId);
  const valor = s.ciclo === "anual" ? (plano.precoAnual ?? plano.precoMensal * 12) : plano.precoMensal;

  const faturas: Fatura[] = [
    {
      id: `fat-${s.id}`,
      assinaturaId: assinatura.id,
      empresaId: s.id,
      competencia: competencia(0),
      emissao: emDias(s.vencimentoEmDias - 12),
      vencimento: emDias(s.vencimentoEmDias),
      valor,
      valorPago: s.paga ? valor : 0,
      status: s.paga ? "paga" : "aberta",
      pagoEm: s.paga ? emDias(s.vencimentoEmDias - 1) : null,
      metodoPagamento: s.paga ? "pix" : null,
      referenciaExterna: null,
      observacao: null,
    },
  ];

  return { empresa, assinatura, faturas };
}

/** Tenant principal + carteira fictícia, na forma que a fronteira de dados usa. */
export const TENANTS: TenantMock[] = [
  { empresa: EMPRESA, assinatura: ASSINATURA, faturas: FATURAS },
  ...SEMENTES.map(montarTenant),
];
