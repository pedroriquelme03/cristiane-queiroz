"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

import { moeda } from "@/lib/format";
import type { EstadoAssinatura } from "@/lib/types";

/** Rotas que continuam acessíveis com o acesso bloqueado. */
const ROTAS_LIBERADAS = ["/assinatura"];

/**
 * Envolve o conteúdo do app. Quando a assinatura está bloqueada, substitui a
 * página por um aviso e só deixa passar as rotas de assinatura — é a barreira
 * visível no cliente. A checagem definitiva fica no servidor (middleware,
 * quando o Supabase estiver ligado), esta camada é a experiência do usuário.
 */
export function GuardaAssinatura({
  estado,
  children,
}: {
  estado: EstadoAssinatura | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const liberada = ROTAS_LIBERADAS.some((r) => pathname.startsWith(r));

  if (!estado?.bloqueada || liberada) {
    return <>{children}</>;
  }

  return <TelaBloqueio estado={estado} />;
}

function TelaBloqueio({ estado }: { estado: EstadoAssinatura }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border border-negative/20 bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-negative-soft text-negative">
          <Lock className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">
          Acesso temporariamente bloqueado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {estado.status === "cancelada"
            ? "A assinatura desta empresa está cancelada. Para reativar o acesso, fale com a consultoria."
            : "Identificamos pagamento em atraso além do prazo de tolerância. Regularize a assinatura para liberar o acesso ao sistema."}
        </p>

        {estado.totalEmAberto > 0 ? (
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <div className="bg-surface px-4 py-3">
              <dt className="text-xs text-muted-foreground">Total em aberto</dt>
              <dd className="mt-0.5 font-semibold text-negative tabular">
                {moeda(estado.totalEmAberto)}
              </dd>
            </div>
            <div className="bg-surface px-4 py-3">
              <dt className="text-xs text-muted-foreground">Atraso</dt>
              <dd className="mt-0.5 font-semibold tabular">
                {estado.diasAtraso} dias
              </dd>
            </div>
          </dl>
        ) : null}

        <Link
          href="/assinatura"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground"
        >
          Ver assinatura e regularizar
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          Precisa de ajuda? Fale com a equipe da consultoria.
        </p>
      </div>
    </div>
  );
}
