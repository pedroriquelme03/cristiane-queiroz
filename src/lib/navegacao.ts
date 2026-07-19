import {
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  Stethoscope,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  grupo: "visao" | "gestao" | "consultoria";
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
];

export const ROTULOS_GRUPO: Record<ItemNavegacao["grupo"], string> = {
  visao: "Visão geral",
  gestao: "Gestão",
  consultoria: "Consultoria",
};

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
