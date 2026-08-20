import type { ReactNode } from "react";

import { Abas } from "@/components/layout/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { ABAS_EMPRESA } from "@/lib/navegacao";

export default function EmpresaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoPagina
        titulo="Empresa"
        descricao="Dados cadastrais e organograma"
      />
      <Abas itens={ABAS_EMPRESA} />
      <div className="space-y-6">{children}</div>
    </>
  );
}
