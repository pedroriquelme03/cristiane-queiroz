"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Menu, X } from "lucide-react";

import { SeletorTema } from "@/components/layout/seletor-tema";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#planos", rotulo: "Planos" },
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#avaliacoes", rotulo: "Avaliações" },
  { href: "#certificacoes", rotulo: "Credenciais" },
];

export function CabecalhoSite() {
  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        rolou
          ? "border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/apresentacao" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground">
            CQ
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">
              Cristiane Queiroz
            </span>
            <span className="block text-xs text-muted-foreground">
              Consultoria Financeira
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {l.rotulo}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <SeletorTema />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            <LogIn className="size-4" aria-hidden />
            Entrar
          </Link>
          <Link
            href="/login?redirect=%2Fassinatura"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition-transform hover:-translate-y-px"
          >
            Assinar
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
          className="grid size-10 place-items-center rounded-lg border border-border text-foreground md:hidden"
        >
          {aberto ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {aberto ? (
        <div className="border-t border-border bg-surface md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setAberto(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                {l.rotulo}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium"
              >
                <LogIn className="size-4" aria-hidden />
                Entrar
              </Link>
              <Link
                href="/login?redirect=%2Fassinatura"
                className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground"
              >
                Assinar
              </Link>
            </div>
            <div className="mt-1">
              <SeletorTema />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
