import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROTAS_PUBLICAS = ["/login", "/auth", "/recuperar-senha"];

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
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // TODO(supabase): reforço server-side do bloqueio por inadimplência. Para o
  // tenant (não-admin), chamar rpc('empresa_bloqueada', { p_empresa_id }) e, se
  // verdadeiro, redirecionar toda rota que não comece com /assinatura para lá.
  // O guarda no cliente (GuardaAssinatura) já cobre a experiência; este é o
  // reforço que impede burlar via navegação direta.

  return response;
}
