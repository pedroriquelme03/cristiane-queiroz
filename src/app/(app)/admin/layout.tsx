import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { Abas } from "@/components/layout/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { getSessao } from "@/lib/sessao";

const ABAS_ADMIN = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/planos", rotulo: "Planos" },
  { href: "/admin/assinaturas", rotulo: "Assinaturas dos clientes" },
  { href: "/admin/empresas", rotulo: "Empresas" }, // ← ADICIONE ESTA LINHA
];

/** Toda a área /admin é exclusiva do super admin (controle da plataforma). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sessao = await getSessao();

  // Quem não é admin nem sabe que a rota existe
  if (sessao.role !== "admin") notFound();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
  titulo="Gestão da plataforma"
  descricao="Planos, assinaturas, empresas e faturamento dos clientes"
/>
      <Abas itens={ABAS_ADMIN} />
      {children}
    </div>
  );
}
