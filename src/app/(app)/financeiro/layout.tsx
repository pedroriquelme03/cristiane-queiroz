import type { ReactNode } from "react";

import { Abas } from "@/components/layout/abas";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { planoPermite } from "@/lib/acesso-planos";
import { getAssinaturaEmpresa } from "@/lib/dados-assinatura";
import { ABAS_FINANCEIRO } from "@/lib/navegacao";
import { getSessao } from "@/lib/sessao";

export default async function FinanceiroLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sessao = await getSessao();
  const assinatura = sessao.role === "admin" || !sessao.empresaId
    ? null
    : await getAssinaturaEmpresa(sessao.empresaId);
  const abas = sessao.role === "cliente"
    ? ABAS_FINANCEIRO.filter((aba) => planoPermite(assinatura?.plano, aba.recurso))
    : ABAS_FINANCEIRO;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Caixa, obrigações, resultado e orçamento da operação"
        acao={<SeletorEmpresaAdmin />}
      />
      <Abas itens={abas} />
      <div className="space-y-6">{children}</div>
    </>
  );
}
