import {
  Award,
  BarChart3,
  Briefcase,
  Calculator,
  CalendarCheck,
  ClipboardCheck,
  Compass,
  FileText,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  PiggyBank,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

import { InstagramIcon, WhatsAppIcon } from "./whatsapp-icon";

type Icone = ComponentType<{ className?: string }>;

/**
 * Registro de ícones da bio. As listas de serviços/links guardam apenas a
 * chave (string) no banco; aqui ela vira componente. Compartilhado entre a
 * página pública e o formulário do admin.
 */
export const ICONES_BIO: Record<string, Icone> = {
  compass: Compass,
  clipboard: ClipboardCheck,
  trending: TrendingUp,
  dashboard: LayoutDashboard,
  graduation: GraduationCap,
  wallet: Wallet,
  target: Target,
  chart: BarChart3,
  briefcase: Briefcase,
  calculator: Calculator,
  receipt: Receipt,
  piggy: PiggyBank,
  handshake: Handshake,
  file: FileText,
  users: Users,
  calendar: CalendarCheck,
  award: Award,
  sparkles: Sparkles,
  message: MessageCircle,
  mail: Mail,
  map: MapPin,
  globe: Globe,
  login: LogIn,
  instagram: InstagramIcon,
  whatsapp: WhatsAppIcon,
};

/**
 * Renderiza o ícone da chave (com fallback). É um componente — e não uma função
 * que devolve componente — para não esbarrar na regra react-hooks/static-components.
 */
export function IconeBio({ chave, className }: { chave: string; className?: string }) {
  const Componente: Icone = ICONES_BIO[chave] ?? Compass;
  return <Componente className={className} />;
}

/** Opções para os selects do admin (rótulos em pt-BR). */
export const OPCOES_ICONE: { valor: string; rotulo: string }[] = [
  { valor: "compass", rotulo: "Bússola" },
  { valor: "clipboard", rotulo: "Prancheta" },
  { valor: "trending", rotulo: "Crescimento" },
  { valor: "dashboard", rotulo: "Painel" },
  { valor: "graduation", rotulo: "Capacitação" },
  { valor: "wallet", rotulo: "Carteira" },
  { valor: "target", rotulo: "Meta" },
  { valor: "chart", rotulo: "Gráfico" },
  { valor: "briefcase", rotulo: "Maleta" },
  { valor: "calculator", rotulo: "Calculadora" },
  { valor: "receipt", rotulo: "Recibo" },
  { valor: "piggy", rotulo: "Cofrinho" },
  { valor: "handshake", rotulo: "Aperto de mão" },
  { valor: "file", rotulo: "Documento" },
  { valor: "users", rotulo: "Pessoas" },
  { valor: "calendar", rotulo: "Agenda" },
  { valor: "award", rotulo: "Prêmio" },
  { valor: "sparkles", rotulo: "Destaque" },
  { valor: "message", rotulo: "Balão" },
  { valor: "mail", rotulo: "E-mail" },
  { valor: "map", rotulo: "Localização" },
  { valor: "globe", rotulo: "Site" },
  { valor: "login", rotulo: "Entrar" },
  { valor: "instagram", rotulo: "Instagram" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
];
