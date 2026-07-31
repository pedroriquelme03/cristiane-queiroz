import {
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { planoPermite, type RecursoPlano } from "@/lib/acesso-planos";
import type { Papel } from "@/lib/types";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  grupo: "visao" | "gestao" | "consultoria" | "conta" | "admin";
  /** Papéis que enxergam o item. Ausente = todos os papéis. */
  papeis?: Papel[];
  recurso?: RecursoPlano;
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: "/", rotulo: "Dashboard", icone: LayoutDashboard, grupo: "visao", papeis: ["cliente", "consultor"], recurso: "dashboard" },
  { href: "/visao-cliente", rotulo: "Visão do cliente", icone: LayoutDashboard, grupo: "visao", papeis: ["admin"] },
  { href: "/empresa", rotulo: "Empresa", icone: Building2, grupo: "visao", recurso: "empresa" },

  { href: "/financeiro/fluxo-de-caixa", rotulo: "Financeiro", icone: Wallet, grupo: "gestao", recurso: "financeiro-basico" },
  { href: "/indicadores", rotulo: "Indicadores", icone: TrendingUp, grupo: "gestao", recurso: "indicadores" },

  { href: "/plano-de-acao", rotulo: "Plano de ação", icone: ClipboardList, grupo: "consultoria", recurso: "consultoria" },
  { href: "/diagnostico", rotulo: "Diagnóstico", icone: Stethoscope, grupo: "consultoria", recurso: "consultoria" },
  { href: "/maturidade", rotulo: "Maturidade", icone: Gauge, grupo: "consultoria", recurso: "consultoria" },
  { href: "/documentos", rotulo: "Documentos", icone: FileText, grupo: "consultoria", recurso: "documentos" },
  { href: "/reunioes", rotulo: "Reuniões e treinamentos", icone: CalendarCheck, grupo: "consultoria", recurso: "reunioes" },

  { href: "/assinatura", rotulo: "Assinatura", icone: CreditCard, grupo: "conta", papeis: ["cliente"], recurso: "assinatura" },

  { href: "/admin/gestao", rotulo: "Assinaturas dos clientes", icone: ShieldCheck, grupo: "admin", papeis: ["admin"] },
  { href: "/admin/empresas", rotulo: "Usuários", icone: Users, grupo: "admin", papeis: ["admin"] },
  { href: "/admin/planos", rotulo: "Planos", icone: ListChecks, grupo: "admin", papeis: ["admin"] },
];

export const ROTULOS_GRUPO: Record<ItemNavegacao["grupo"], string> = {
  visao: "Visão geral",
  gestao: "Gestão",
  consultoria: "Consultoria",
  conta: "Minha conta",
  admin: "Administração",
};

/** Ordem em que os grupos aparecem na barra lateral. */
export const ORDEM_GRUPOS: ItemNavegacao["grupo"][] = [
  "visao",
  "gestao",
  "consultoria",
  "conta",
  "admin",
];

export function itensVisiveis(
  role: Papel,
  plano?: { nome: string; ordem: number } | null,
) {
  return NAVEGACAO.filter((item) => {
    if (item.papeis && !item.papeis.includes(role)) return false;
    if (role === "cliente" && item.recurso && !planoPermite(plano, item.recurso)) return false;
    return true;
  });
}

/** Abas da tela Financeiro. */
export const ABAS_FINANCEIRO: { href: string; rotulo: string; recurso: RecursoPlano }[] = [
  { href: "/financeiro/fluxo-de-caixa", rotulo: "Fluxo de caixa", recurso: "financeiro-basico" },
  { href: "/financeiro/contas-a-pagar", rotulo: "Contas a pagar", recurso: "financeiro-basico" },
  { href: "/financeiro/contas-a-receber", rotulo: "Contas a receber", recurso: "financeiro-basico" },
  { href: "/financeiro/dre", rotulo: "DRE gerencial", recurso: "financeiro-avancado" },
  { href: "/financeiro/orcamento", rotulo: "Orçamento", recurso: "financeiro-avancado" },
  { href: "/financeiro/importar", rotulo: "Importar planilha", recurso: "financeiro-avancado" },
];

/** Abas da tela Empresa. */
export const ABAS_EMPRESA = [
  { href: "/empresa", rotulo: "Dados gerais" },
  { href: "/empresa/estrutura", rotulo: "Estrutura" },
];
