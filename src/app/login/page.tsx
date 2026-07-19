import Link from "next/link";
import { Info } from "lucide-react";

import { FormularioLogin } from "@/components/auth/formulario-login";
import { supabaseConfigurado } from "@/lib/supabase/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand text-base font-semibold text-brand-foreground">
            CQ
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">
            Cristiane Queiroz
          </h1>
          <p className="text-sm text-muted-foreground">Consultoria Financeira</p>
        </header>

        <div className="rounded-xl border border-border bg-surface px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <FormularioLogin
            redirecionarPara={redirect ?? "/"}
            desabilitado={!supabaseConfigurado}
          />
        </div>

        {!supabaseConfigurado ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">
              O banco ainda não foi provisionado, então o login está desligado e a
              plataforma roda com dados de exemplo.{" "}
              <Link href="/" className="font-medium text-brand hover:underline">
                Entrar mesmo assim
              </Link>
              .
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Problemas para acessar? Fale com a equipe da consultoria.
        </p>
      </div>
    </div>
  );
}
