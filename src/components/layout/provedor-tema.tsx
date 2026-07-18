"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export function ProvedorTema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // A troca de tema muda dezenas de variáveis de cor de uma vez; sem isso
      // as transições do Tailwind disparam todas juntas e o piscar fica feio.
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
