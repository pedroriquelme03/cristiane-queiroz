import { LogOut } from "lucide-react";

import { sair } from "@/app/login/acoes";
import { SeletorTema } from "@/components/layout/seletor-tema";
import { getCompetenciaAtual, getEmpresa } from "@/lib/dados";
import { competenciaExtenso } from "@/lib/format";

export async function BarraTopo() {
  const [empresa, competencia] = await Promise.all([
    getEmpresa(),
    getCompetenciaAtual(),
  ]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand">
          {empresa.nomeFantasia.slice(0, 2).toUpperCase()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-medium">{empresa.nomeFantasia}</p>
          <p className="text-xs text-muted-foreground">
            {empresa.unidades.length} unidades · {empresa.qtdFuncionarios} colaboradores
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs text-muted-foreground">
          Competência:{" "}
          <strong className="font-medium text-foreground">
            {competenciaExtenso(competencia)}
          </strong>
        </span>
        <SeletorTema />
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            CQ
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium">Cristiane Queiroz</p>
            <p className="text-xs text-muted-foreground">Consultoria</p>
          </div>
          <form action={sair}>
            <button
              type="submit"
              title="Sair"
              aria-label="Sair"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
