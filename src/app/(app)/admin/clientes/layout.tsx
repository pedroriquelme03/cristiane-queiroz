import type { ReactNode } from "react";

import { Abas } from "@/components/layout/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { ABAS_CLIENTES } from "@/lib/navegacao";

export default function ClientesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Carteira de consultoria e assinantes da plataforma"
      />
      <Abas itens={ABAS_CLIENTES} />
      <div className="space-y-6">{children}</div>
    </>
  );
}
