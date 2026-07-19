import type { ReactNode } from "react";

import { BarraLateral } from "@/components/layout/barra-lateral";
import { BarraTopo } from "@/components/layout/barra-topo";

/** Shell autenticado: tudo que fica atrás do login mora neste grupo. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh">
      <div className="hidden md:block">
        <BarraLateral />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraTopo />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
