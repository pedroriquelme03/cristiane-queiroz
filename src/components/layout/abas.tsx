"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function Abas({
  itens,
}: {
  itens: { href: string; rotulo: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const buscaAtual = searchParams.toString();

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Seções">
        {itens.map((item) => {
          const ativo = pathname === item.href;
          const href = buscaAtual ? `${item.href}?${buscaAtual}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
                ativo
                  ? "border-brand font-medium text-brand"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
