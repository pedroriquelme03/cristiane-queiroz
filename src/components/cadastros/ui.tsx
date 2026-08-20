import type { ReactNode } from "react";

import { Card, CardBody } from "@/components/ui/card";

export function PainelCadastro({
  titulo,
  valor,
  descricao,
  icone,
  acao,
  children,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-[360px] min-w-0 overflow-hidden">
      <CardBody className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
          </div>
          <span className="text-muted-foreground">{icone}</span>
        </header>
        {acao ? <div className="min-w-0">{acao}</div> : null}
        <div className="min-w-0 max-h-[520px] overflow-y-auto pr-1">{children}</div>
      </CardBody>
    </Card>
  );
}

export function BotaoIconeCadastro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-negative-soft hover:text-negative"
    >
      {children}
    </button>
  );
}

export function EstadoVazioCadastro({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
      {icone}
      {texto}
    </div>
  );
}

export function AvisoSemEmpresa({ texto }: { texto?: string }) {
  return (
    <Card>
      <CardBody className="py-12 text-center text-sm text-muted-foreground">
        {texto ?? "Selecione uma empresa no topo para gerenciar os cadastros."}
      </CardBody>
    </Card>
  );
}
