import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";

import { comEmpresa } from "@/lib/relatorios/filtros";

export function LinkGerarRelatorio({
  href,
  empresaId,
  rotulo = "Gerar relatório",
}: {
  href: string;
  empresaId?: string | null;
  rotulo?: string;
}) {
  return (
    <Link
      href={comEmpresa(href, empresaId)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-brand/50"
    >
      <FileSpreadsheet className="size-3.5" aria-hidden />
      {rotulo}
    </Link>
  );
}
