import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { getSessao } from "@/lib/sessao";

/** Toda a área /admin é exclusiva do super admin (controle da plataforma). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sessao = await getSessao();

  // Quem não é admin nem sabe que a rota existe
  if (sessao.role !== "admin") notFound();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Gestão da plataforma"
        descricao="Usuários, planos, assinaturas e faturamento dos clientes"
      />
      {children}
    </div>
  );
}
