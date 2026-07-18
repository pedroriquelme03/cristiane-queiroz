"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVEGACAO, ROTULOS_GRUPO, type ItemNavegacao } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

const GRUPOS: ItemNavegacao["grupo"][] = ["visao", "gestao", "consultoria"];

export function BarraLateral() {
  const pathname = usePathname();

  const estaAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegação principal"
      className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface"
    >
      <Link
        href="/"
        className="flex items-center gap-3 border-b border-border px-5 py-4"
      >
        <span className="grid size-9 place-items-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground">
          CQ
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Cristiane Queiroz</span>
          <span className="block text-xs text-muted-foreground">
            Consultoria Financeira
          </span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {GRUPOS.map((grupo) => (
          <div key={grupo} className="mb-5 last:mb-0">
            <h2 className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {ROTULOS_GRUPO[grupo]}
            </h2>
            <ul className="space-y-0.5">
              {NAVEGACAO.filter((item) => item.grupo === grupo).map((item) => {
                const ativo = estaAtivo(item.href);
                const Icone = item.icone;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
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
