"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Envolve um bloco e o revela quando entra na viewport. Respeita
 * prefers-reduced-motion: nesse caso o conteúdo já nasce visível, sem animação.
 */
export function Revelar({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Atraso em ms para escalonar itens de uma mesma linha. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;

    const semMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (semMovimento) {
      setVisivel(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisivel(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-visivel={visivel}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("revelar", className)}
    >
      {children}
    </Tag>
  );
}
