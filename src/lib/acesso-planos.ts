import type { Plano } from "@/lib/types";

export type NivelPlano = "essencial" | "profissional" | "enterprise";

export type RecursoPlano =
  | "dashboard"
  | "empresa"
  | "financeiro-basico"
  | "financeiro-avancado"
  | "indicadores"
  | "consultoria"
  | "documentos"
  | "reunioes"
  | "assinatura";

const ORDEM_NIVEL: Record<NivelPlano, number> = {
  essencial: 1,
  profissional: 2,
  enterprise: 3,
};

const NIVEL_MINIMO_RECURSO: Record<RecursoPlano, NivelPlano> = {
  dashboard: "essencial",
  empresa: "essencial",
  "financeiro-basico": "essencial",
  assinatura: "essencial",
  "financeiro-avancado": "profissional",
  indicadores: "profissional",
  consultoria: "profissional",
  documentos: "enterprise",
  reunioes: "enterprise",
};

const ROTAS_RECURSO: { prefixo: string; recurso: RecursoPlano }[] = [
  { prefixo: "/assinatura", recurso: "assinatura" },
  { prefixo: "/empresa", recurso: "empresa" },
  { prefixo: "/financeiro/dre", recurso: "financeiro-avancado" },
  { prefixo: "/financeiro/receitas", recurso: "financeiro-avancado" },
  { prefixo: "/financeiro/orcamento", recurso: "financeiro-avancado" },
  { prefixo: "/financeiro/importar", recurso: "financeiro-avancado" },
  { prefixo: "/financeiro", recurso: "financeiro-basico" },
  { prefixo: "/indicadores", recurso: "indicadores" },
  { prefixo: "/plano-de-acao", recurso: "consultoria" },
  { prefixo: "/diagnostico", recurso: "consultoria" },
  { prefixo: "/maturidade", recurso: "consultoria" },
  { prefixo: "/documentos", recurso: "documentos" },
  { prefixo: "/reunioes", recurso: "reunioes" },
  { prefixo: "/", recurso: "dashboard" },
];

export function nivelDoPlano(plano: Pick<Plano, "nome" | "ordem"> | null | undefined): NivelPlano | null {
  if (!plano) return null;

  const nome = plano.nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (nome.includes("enterprise")) return "enterprise";
  if (nome.includes("profissional")) return "profissional";
  if (nome.includes("essencial")) return "essencial";

  if (plano.ordem >= 3) return "enterprise";
  if (plano.ordem >= 2) return "profissional";
  return "essencial";
}

export function planoPermite(
  plano: Pick<Plano, "nome" | "ordem"> | null | undefined,
  recurso: RecursoPlano,
) {
  const nivel = nivelDoPlano(plano);
  if (!nivel) return recurso === "assinatura";

  const minimo = NIVEL_MINIMO_RECURSO[recurso];
  return ORDEM_NIVEL[nivel] >= ORDEM_NIVEL[minimo];
}

export function recursoDaRota(pathname: string): RecursoPlano {
  const rota = ROTAS_RECURSO.find(({ prefixo }) =>
    prefixo === "/" ? pathname === "/" : pathname.startsWith(prefixo),
  );
  return rota?.recurso ?? "dashboard";
}

export function nomeNivelExigido(recurso: RecursoPlano) {
  const rotulos: Record<NivelPlano, string> = {
    essencial: "Essencial",
    profissional: "Profissional",
    enterprise: "Enterprise",
  };
  return rotulos[NIVEL_MINIMO_RECURSO[recurso]];
}
