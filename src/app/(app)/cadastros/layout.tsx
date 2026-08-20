import type { ReactNode } from "react";

import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { Abas } from "@/components/layout/abas";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { ABAS_CADASTROS } from "@/lib/navegacao";

export default function CadastrosLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoPagina
        titulo="Cadastros"
        descricao="Dados mestres usados nos selects e formulários do sistema"
        acao={<SeletorEmpresaAdmin />}
      />
      <Abas itens={ABAS_CADASTROS} />
      <div className="space-y-6">{children}</div>
    </>
  );
}
