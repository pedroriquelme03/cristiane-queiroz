import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import {
  DialogoLancamento,
  ExcluirLancamento,
} from "@/components/financeiro/dialogo-lancamento";
import type { MovimentoExtrato, PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Abre o lançamento manual ou o título que gerou a baixa. */
export function AcessoLancamentoOrigem({
  movimento,
  contas,
  empresaId,
  podeEditar,
}: {
  movimento: MovimentoExtrato;
  contas: PlanoConta[];
  empresaId?: string;
  podeEditar: boolean;
}) {
  if (movimento.origem === "manual" && podeEditar && empresaId) {
    return (
      <div className="flex items-center justify-end gap-3">
        <DialogoLancamento contas={contas} empresaId={empresaId} lancamento={movimento} />
        <ExcluirLancamento lancamento={movimento} empresaId={empresaId} />
      </div>
    );
  }

  if (movimento.tituloId && movimento.tituloTipo) {
    const base =
      movimento.tituloTipo === "receber"
        ? "/financeiro/contas-a-receber"
        : "/financeiro/contas-a-pagar";
    const href = empresaId
      ? `${base}?empresa=${encodeURIComponent(empresaId)}`
      : base;
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
        )}
        title="Abrir título de origem"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        Ver título
      </Link>
    );
  }

  if (movimento.origem === "integracao") {
    return <span className="text-xs text-muted-foreground">Baixa automática</span>;
  }

  if (movimento.origem === "importacao") {
    return <span className="text-xs text-muted-foreground">Importação</span>;
  }

  if (podeEditar && empresaId) {
    return (
      <DialogoLancamento contas={contas} empresaId={empresaId} lancamento={movimento} />
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Pencil className="size-3" aria-hidden />
      Lançamento
    </span>
  );
}
