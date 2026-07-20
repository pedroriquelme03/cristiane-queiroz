import {
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Layers,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Papel } from "@/lib/types";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  grupo: "visao" | "gestao" | "consultoria" | "conta" | "admin";
  /** Papéis que enxergam o item. Ausente = todos os papéis. */
  papeis?: Papel[];
}

export const NAVEGACAO: ItemNavegacao[] = [
  { href: "/", rotulo: "Dashboard", icone: LayoutDashboard, grupo: "visao" },
  { href: "/empresa", rotulo: "Empresa", icone: Building2, grupo: "visao" },

  { href: "/financeiro", rotulo: "Financeiro", icone: Wallet, grupo: "gestao" },
  { href: "/indicadores", rotulo: "Indicadores", icone: TrendingUp, grupo: "gestao" },

  { href: "/plano-de-acao", rotulo: "Plano de ação", icone: ClipboardList, grupo: "consultoria" },
  { href: "/diagnostico", rotulo: "Diagnóstico", icone: Stethoscope, grupo: "consultoria" },
  { href: "/maturidade", rotulo: "Maturidade", icone: Gauge, grupo: "consultoria" },
  { href: "/documentos", rotulo: "Documentos", icone: FileText, grupo: "consultoria" },
  { href: "/reunioes", rotulo: "Reuniões e treinamentos", icone: CalendarCheck, grupo: "consultoria" },

  // Assinatura do próprio tenant: dono e gestor da empresa
  { href: "/assinatura", rotulo: "Assinatura", icone: CreditCard, grupo: "conta", papeis: ["admin", "cliente"] },

  // Painel do super admin (controle da plataforma)
  { href: "/admin", rotulo: "Visão geral", icone: ShieldCheck, grupo: "admin", papeis: ["admin"] },
  { href: "/admin/planos", rotulo: "Planos", icone: Layers, grupo: "admin", papeis: ["admin"] },
  { href: "/admin/assinaturas", rotulo: "Assinaturas dos clientes", icone: CreditCard, grupo: "admin", papeis: ["admin"] },
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

export function itensVisiveis(role: Papel) {
  return NAVEGACAO.filter((item) => !item.papeis || item.papeis.includes(role));
}

/** Abas da tela Financeiro. */
export const ABAS_FINANCEIRO = [
  { href: "/financeiro/fluxo-de-caixa", rotulo: "Fluxo de caixa" },
  { href: "/financeiro/contas-a-pagar", rotulo: "Contas a pagar" },
  { href: "/financeiro/contas-a-receber", rotulo: "Contas a receber" },
  { href: "/financeiro/dre", rotulo: "DRE gerencial" },
  { href: "/financeiro/orcamento", rotulo: "Orçamento" },
  { href: "/financeiro/importar", rotulo: "Importar planilha" },
];

/** Abas da tela Empresa. */
export const ABAS_EMPRESA = [
  { href: "/empresa", rotulo: "Dados gerais" },
  { href: "/empresa/estrutura", rotulo: "Estrutura" },
];
