/**
 * Fronteira de dados da página pública /bio (link na bio).
 *
 * O conteúdo é um registro único no Supabase (tabela public.bio_perfil),
 * editável pelo admin. Enquanto o banco não está provisionado — ou se a leitura
 * falhar — caímos nos padrões abaixo, que espelham a seed da migração 0018.
 */
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Uma ação de serviço abre o WhatsApp (mensagem) ou um link (URL). */
export type BioServico = {
  icone: string;
  titulo: string;
  texto: string;
  tipo: "whatsapp" | "url";
  valor: string;
};

export type BioLink = {
  icone: string;
  titulo: string;
  texto: string;
  url: string;
};

export interface BioPerfil {
  nome: string;
  subtitulo: string;
  tagline: string;
  whatsapp: string;
  fotoUrl: string | null;
  servicos: BioServico[];
  links: BioLink[];
  ativo: boolean;
}

export const BIO_PADRAO: BioPerfil = {
  nome: "Cristiane Queiroz",
  subtitulo: "Consultoria Financeira",
  tagline:
    "Gestão financeira que vira decisão pro seu negócio crescer com clareza.",
  whatsapp: "5545999316874",
  fotoUrl: null,
  ativo: true,
  servicos: [
    {
      icone: "compass",
      titulo: "Consultoria financeira empresarial",
      texto: "Método completo do diagnóstico ao resultado",
      tipo: "whatsapp",
      valor:
        "Olá Cristiane! Quero conhecer a consultoria financeira para a minha empresa.",
    },
    {
      icone: "clipboard",
      titulo: "Diagnóstico + plano de ação",
      texto: "Descubra os gargalos e o caminho pra crescer",
      tipo: "whatsapp",
      valor: "Olá! Gostaria de agendar um diagnóstico financeiro da minha empresa.",
    },
    {
      icone: "trending",
      titulo: "Fluxo de caixa e DRE gerencial",
      texto: "Seus números organizados e virando decisão",
      tipo: "whatsapp",
      valor:
        "Olá! Quero organizar o fluxo de caixa e o DRE da minha empresa com a consultoria.",
    },
    {
      icone: "dashboard",
      titulo: "Plataforma de gestão CQ",
      texto: "Indicadores, metas e painéis em um só lugar",
      tipo: "url",
      valor: "/apresentacao#recursos",
    },
    {
      icone: "graduation",
      titulo: "Capacitação da equipe",
      texto: "Treinamento pra gestão rodar com autonomia",
      tipo: "whatsapp",
      valor: "Olá! Quero saber sobre a capacitação da equipe em gestão financeira.",
    },
  ],
  links: [
    {
      icone: "instagram",
      titulo: "Instagram",
      texto: "@cristianequeirozconsultoria",
      url: "https://www.instagram.com/cristianequeirozconsultoria/",
    },
    {
      icone: "globe",
      titulo: "Site e planos",
      texto: "Conheça a consultoria e a plataforma",
      url: "/apresentacao",
    },
    {
      icone: "login",
      titulo: "Área do cliente",
      texto: "Acesse o sistema de gestão financeira",
      url: "/login",
    },
  ],
};

type LinhaBio = {
  nome: string | null;
  subtitulo: string | null;
  tagline: string | null;
  whatsapp: string | null;
  foto_url: string | null;
  servicos: unknown;
  links: unknown;
  ativo: boolean | null;
};

/** Normaliza o JSONB do banco, descartando itens malformados. */
function lerServicos(bruto: unknown): BioServico[] {
  if (!Array.isArray(bruto)) return BIO_PADRAO.servicos;
  return bruto
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s): BioServico => ({
      icone: String(s.icone ?? "compass"),
      titulo: String(s.titulo ?? ""),
      texto: String(s.texto ?? ""),
      tipo: s.tipo === "url" ? "url" : "whatsapp",
      valor: String(s.valor ?? ""),
    }))
    .filter((s) => s.titulo && s.valor);
}

function lerLinks(bruto: unknown): BioLink[] {
  if (!Array.isArray(bruto)) return BIO_PADRAO.links;
  return bruto
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l): BioLink => ({
      icone: String(l.icone ?? "globe"),
      titulo: String(l.titulo ?? ""),
      texto: String(l.texto ?? ""),
      url: String(l.url ?? ""),
    }))
    .filter((l) => l.titulo && l.url);
}

/**
 * Conteúdo da bio. Nunca lança: qualquer falha (banco ausente, tabela ainda não
 * migrada, erro de rede) retorna os padrões para a página não quebrar.
 */
export async function getBioPerfil(): Promise<BioPerfil> {
  if (!supabaseConfigurado) return BIO_PADRAO;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bio_perfil")
      .select("nome, subtitulo, tagline, whatsapp, foto_url, servicos, links, ativo")
      .eq("id", "perfil")
      .maybeSingle<LinhaBio>();

    if (error || !data) return BIO_PADRAO;

    return {
      nome: data.nome ?? BIO_PADRAO.nome,
      subtitulo: data.subtitulo ?? BIO_PADRAO.subtitulo,
      tagline: data.tagline ?? BIO_PADRAO.tagline,
      whatsapp: data.whatsapp ?? BIO_PADRAO.whatsapp,
      fotoUrl: data.foto_url ?? null,
      servicos: lerServicos(data.servicos),
      links: lerLinks(data.links),
      ativo: data.ativo ?? true,
    };
  } catch {
    return BIO_PADRAO;
  }
}
