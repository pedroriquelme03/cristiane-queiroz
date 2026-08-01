"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { MarcaCristianeQueiroz } from "@/components/layout/marca-cristiane-queiroz";
import { ORDEM_GRUPOS, ROTULOS_GRUPO, itensVisiveis } from "@/lib/navegacao";
import type { Papel, Plano } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BarraLateral({
  role,
  plano,
}: {
  role: Papel;
  plano?: Pick<Plano, "nome" | "ordem"> | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const empresaSelecionada = searchParams.get("empresa");

  const itens = itensVisiveis(role, plano);
  const grupos = ORDEM_GRUPOS.filter((g) => itens.some((i) => i.grupo === g));

  const estaAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegação principal"
      className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface"
    >
      <Link
        href="/"
        aria-label="Ir para o início"
        className="flex min-h-[4.25rem] items-center border-b border-border px-4 py-1.5"
      >
        <MarcaCristianeQueiroz className="w-[7rem]" priority />
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo} className="mb-5 last:mb-0">
            <h2 className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {ROTULOS_GRUPO[grupo]}
            </h2>
            <ul className="space-y-0.5">
              {itens.filter((item) => item.grupo === grupo).map((item) => {
                const ativo = estaAtivo(item.href);
                const Icone = item.icone;
                const devePropagarEmpresa =
                  role === "admin" &&
                  empresaSelecionada &&
                  ["visao", "gestao", "consultoria"].includes(item.grupo);
                const href = devePropagarEmpresa
                  ? `${item.href}?empresa=${encodeURIComponent(empresaSelecionada)}`
                  : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        ativo
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <Icone className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
