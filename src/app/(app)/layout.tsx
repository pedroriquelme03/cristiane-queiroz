import type { ReactNode } from "react";

import { GuardaAssinatura } from "@/components/assinatura/guarda-assinatura";
import { BarraLateral } from "@/components/layout/barra-lateral";
import { BarraTopo } from "@/components/layout/barra-topo";
import { AvisoSolicitacaoReuniaoAdmin } from "@/components/reunioes/aviso-solicitacao-admin";
import { calcularEstado } from "@/lib/assinatura";
import { getAssinaturaEmpresa } from "@/lib/dados-assinatura";
import { getSessao } from "@/lib/sessao";

/** Shell autenticado: tudo que fica atrás do login mora neste grupo. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessao = await getSessao();
  const assinatura = sessao.role === "admin" || !sessao.empresaId
    ? null
    : await getAssinaturaEmpresa(sessao.empresaId);
  const estado = assinatura
    ? calcularEstado(assinatura.assinatura, assinatura.faturas)
    : null;
  const plano = assinatura?.plano ?? null;

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 hidden h-dvh md:block">
        <BarraLateral role={sessao.role} plano={plano} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraTopo />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {sessao.role === "admin" ? <AvisoSolicitacaoReuniaoAdmin /> : null}
            {/* Super admin nunca é barrado: precisa gerenciar as assinaturas */}
            {sessao.role === "admin" ? (
              children
            ) : (
              <GuardaAssinatura estado={estado} plano={plano}>{children}</GuardaAssinatura>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
