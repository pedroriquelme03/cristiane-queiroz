import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Sessão curta (dia de trabalho) vs. persistente (~30 dias) no “lembrar senha”. */
export const SESSAO_CURTA_SEGUNDOS = 60 * 60 * 8;
export const SESSAO_LONGA_SEGUNDOS = 60 * 60 * 24 * 30;

export async function createClient(opcoes?: { maxAge?: number }) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(opcoes?.maxAge != null
        ? { cookieOptions: { maxAge: opcoes.maxAge } }
        : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, {
                ...options,
                ...(opcoes?.maxAge != null ? { maxAge: opcoes.maxAge } : {}),
              });
            }
          } catch {
            // Server Components não podem escrever cookies.
          }
        },
      },
    },
  );
}