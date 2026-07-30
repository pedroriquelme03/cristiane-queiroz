import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROTAS_PUBLICAS = ["/login", "/auth", "/recuperar-senha"];
const ROTAS_LIBERADAS_BLOQUEIO = ["/assinatura"];

type NivelPlano = "essencial" | "profissional" | "enterprise";
type RecursoPlano =
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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Enquanto o projeto Supabase nao esta provisionado a plataforma roda com
  // dados de exemplo e sem login. Remover assim que as chaves existirem.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Nao remova: getUser() revalida o token e renova os cookies da sessao.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return redirecionarPreservandoCookies(url, response);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirecionarPreservandoCookies(url, response);
  }

  if (user && !ehPublica) {
    const acessoPlano = await podeAcessarRotaPeloPlano(supabase, user.id, pathname);

    if (!acessoPlano.permitido) {
      const url = request.nextUrl.clone();
      url.pathname = "/assinatura";
      url.searchParams.set("upgrade", acessoPlano.planoMinimo ?? "1");
      return redirecionarPreservandoCookies(url, response);
    }

    const liberadaPorBloqueio = ROTAS_LIBERADAS_BLOQUEIO.some((rota) =>
      pathname.startsWith(rota),
    );

    if (!liberadaPorBloqueio) {
      const bloqueada = await empresaAtualBloqueada(supabase, user.id);

      if (bloqueada) {
        const url = request.nextUrl.clone();
        url.pathname = "/assinatura";
        url.searchParams.set("bloqueado", "1");
        return redirecionarPreservandoCookies(url, response);
      }
    }
  }

  return response;
}

async function podeAcessarRotaPeloPlano(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  pathname: string,
) {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (perfil?.role === "admin") return { permitido: true };

  const recurso = recursoDaRota(pathname);
  if (recurso === "assinatura") return { permitido: true };

  const { data: vinculo } = await supabase
    .from("empresa_membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!vinculo?.empresa_id) {
    return { permitido: recurso === "dashboard" };
  }

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("plano:planos(nome, ordem)")
    .eq("empresa_id", vinculo.empresa_id)
    .maybeSingle();

  const plano = normalizarJoin<{ nome: string; ordem: number }>(assinatura?.plano ?? null);
  const permitido = planoPermite(plano, recurso);
  return {
    permitido,
    planoMinimo: permitido ? null : NIVEL_MINIMO_RECURSO[recurso],
  };
}

async function empresaAtualBloqueada(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
) {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (perfil?.role === "admin") return false;

  const { data: vinculo } = await supabase
    .from("empresa_membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!vinculo?.empresa_id) return false;

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, status, bloqueio_manual, carencia_dias")
    .eq("empresa_id", vinculo.empresa_id)
    .maybeSingle();

  if (!assinatura) return false;
  if (assinatura.bloqueio_manual || assinatura.status === "cancelada") {
    return true;
  }

  const limiteBloqueio = dataRelativa(-(assinatura.carencia_dias ?? 0));
  const { data: faturaVencida } = await supabase
    .from("faturas")
    .select("id")
    .eq("assinatura_id", assinatura.id)
    .eq("status", "aberta")
    .lt("vencimento", limiteBloqueio)
    .limit(1)
    .maybeSingle();

  return Boolean(faturaVencida);
}

function redirecionarPreservandoCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

function recursoDaRota(pathname: string): RecursoPlano {
  const rota = ROTAS_RECURSO.find(({ prefixo }) =>
    prefixo === "/" ? pathname === "/" : pathname.startsWith(prefixo),
  );
  return rota?.recurso ?? "dashboard";
}

function planoPermite(
  plano: { nome: string; ordem: number } | null,
  recurso: RecursoPlano,
) {
  const nivel = nivelDoPlano(plano);
  if (!nivel) return recurso === "assinatura";

  const minimo = NIVEL_MINIMO_RECURSO[recurso];
  return ORDEM_NIVEL[nivel] >= ORDEM_NIVEL[minimo];
}

function nivelDoPlano(plano: { nome: string; ordem: number } | null): NivelPlano | null {
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

function normalizarJoin<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

function dataRelativa(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}
