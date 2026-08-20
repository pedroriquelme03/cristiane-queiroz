import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROTAS_PUBLICAS = ["/login", "/auth", "/recuperar-senha", "/apresentacao"];
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
  { prefixo: "/cadastros", recurso: "empresa" },
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

  // getClaims valida o token e renova a sessao quando necessario. Com chaves
  // assimetricas, a assinatura e conferida localmente e elimina uma ida ao Auth.
  const { data: claimsData } = await supabase.auth.getClaims();
  const usuarioId = claimsData?.claims.sub;

  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  // Visitante deslogado na raiz vê a landing pública, não a tela de login.
  if (!usuarioId && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/apresentacao";
    url.search = "";
    return redirecionarPreservandoCookies(url, response);
  }

  if (!usuarioId && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return redirecionarPreservandoCookies(url, response);
  }

  if (usuarioId && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return redirecionarPreservandoCookies(url, response);
  }

  if (usuarioId && !ehPublica) {
    const acessoUsuario = await getAcessoUsuario(supabase, usuarioId);
    const acessoPlano = podeAcessarRotaPeloPlano(acessoUsuario, pathname);

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
      const bloqueada = await empresaAtualBloqueada(supabase, acessoUsuario);

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

type AcessoUsuario = {
  role: string | null;
  empresaId: string | null;
  assinatura: {
    id: string;
    status: string;
    bloqueio_manual: boolean;
    carencia_dias: number | null;
    plano: { nome: string; ordem: number } | { nome: string; ordem: number }[] | null;
  } | null;
};

async function getAcessoUsuario(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<AcessoUsuario> {
  const [{ data: perfil }, { data: vinculo }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("empresa_membros")
      .select("empresa_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (perfil?.role === "admin" || !vinculo?.empresa_id) {
    return {
      role: perfil?.role ?? null,
      empresaId: vinculo?.empresa_id ?? null,
      assinatura: null,
    };
  }

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, status, bloqueio_manual, carencia_dias, plano:planos(nome, ordem)")
    .eq("empresa_id", vinculo.empresa_id)
    .maybeSingle();

  return {
    role: perfil?.role ?? null,
    empresaId: vinculo.empresa_id,
    assinatura: assinatura ?? null,
  };
}

function podeAcessarRotaPeloPlano(acesso: AcessoUsuario, pathname: string) {
  if (acesso.role === "admin") return { permitido: true };

  const recurso = recursoDaRota(pathname);
  if (recurso === "assinatura") return { permitido: true };

  if (!acesso.empresaId) {
    return { permitido: recurso === "dashboard" };
  }

  const plano = normalizarJoin<{ nome: string; ordem: number }>(acesso.assinatura?.plano ?? null);
  const permitido = planoPermite(plano, recurso);
  return {
    permitido,
    planoMinimo: permitido ? null : NIVEL_MINIMO_RECURSO[recurso],
  };
}

async function empresaAtualBloqueada(
  supabase: ReturnType<typeof createServerClient>,
  acesso: AcessoUsuario,
) {
  if (acesso.role === "admin") return false;

  const assinatura = acesso.assinatura;
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
