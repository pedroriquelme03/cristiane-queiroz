"use client";

import { usePathname } from "next/navigation";

const CONTEXTOS = [
  {
    prefixos: ["/visao-cliente", "/empresa"],
    titulo: "Visão geral",
    descricao: "Consulta da visão dos clientes",
  },
  {
    prefixos: ["/financeiro", "/indicadores"],
    titulo: "Gestão",
    descricao: "Financeiro e indicadores",
  },
  {
    prefixos: ["/plano-de-acao", "/diagnostico", "/maturidade", "/documentos", "/reunioes"],
    titulo: "Consultoria",
    descricao: "Acompanhamento e evolução dos clientes",
  },
  {
    prefixos: ["/assinatura"],
    titulo: "Minha conta",
    descricao: "Assinatura da plataforma",
  },
  {
    prefixos: ["/admin"],
    titulo: "Administração",
    descricao: "Gestão da plataforma",
  },
];

export function ContextoAdminTopo() {
  const pathname = usePathname();
  const contexto = CONTEXTOS.find((item) => item.prefixos.some((prefixo) => pathname.startsWith(prefixo)))
    ?? CONTEXTOS[0];

  return (
    <>
      <span className="grid size-8 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand">
        {contexto.titulo.slice(0, 2).toUpperCase()}
      </span>
      <div className="leading-tight">
        <p className="text-sm font-medium">{contexto.titulo}</p>
        <p className="text-xs text-muted-foreground">{contexto.descricao}</p>
      </div>
    </>
  );
}
