import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export async function AvisoSolicitacaoReuniaoAdmin() {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("alertas")
    .select("id, descricao", { count: "exact" })
    .eq("tipo", "solicitacao_reuniao")
    .eq("resolvido", false)
    .order("created_at", { ascending: false })
    .limit(1);

  const solicitacao = data?.[0];
  if (error || !solicitacao) return null;

  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {count === 1 ? "Nova solicitação de reunião" : `${count} solicitações de reunião pendentes`}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{solicitacao.descricao}</p>
        </div>
      </div>
      <Link href="/reunioes" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground hover:text-brand">
        Ver solicitações
        <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </aside>
  );
}
