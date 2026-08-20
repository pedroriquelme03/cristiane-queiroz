import Link from "next/link";
import { Info } from "lucide-react";

import { FormularioLogin } from "@/components/auth/formulario-login";
import { MarcaCristianeQueiroz } from "@/components/layout/marca-cristiane-queiroz";
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
          <h1 className="sr-only">Cristiane Queiroz Consultoria Financeira</h1>
          <MarcaCristianeQueiroz className="mx-auto w-full max-w-[18rem]" priority />
        </header>

        <div className="rounded-xl border border-border bg-surface px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <FormularioLogin
            redirecionarPara={redirect ?? "/inicio"}
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
          Problemas para acessar?{" "}
          <a
            href={`https://wa.me/5545999316874?text=${encodeURIComponent(
              "Olá Equipe Cristiane Queiroz, preciso de ajuda para logar no sistema de controle financeiro",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand hover:underline"
          >
            Fale com a equipe da consultoria.
          </a>
        </p>
      </div>
    </div>
  );
}
