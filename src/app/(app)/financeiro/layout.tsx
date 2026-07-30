import type { ReactNode } from "react";

import { Abas } from "@/components/layout/abas";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { ABAS_FINANCEIRO } from "@/lib/navegacao";

export default function FinanceiroLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Caixa, obrigações, resultado e orçamento da operação"
        acao={<SeletorEmpresaAdmin />}
      />
      <Abas itens={ABAS_FINANCEIRO} />
      <div className="space-y-6">{children}</div>
    </>
  );
}
