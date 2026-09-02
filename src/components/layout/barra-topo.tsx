import { LogOut } from "lucide-react";

import { sair } from "@/app/login/acoes";
import { ContextoAdminTopo } from "@/components/layout/contexto-admin-topo";
import { SeletorCompetencia } from "@/components/layout/seletor-competencia";
import { SeletorTema } from "@/components/layout/seletor-tema";
import { getCompetenciaAtual, listarCompetenciasOpcoes } from "@/lib/dados";
import { getSessao } from "@/lib/sessao";

export async function BarraTopo() {
  const sessao = await getSessao();
  const [competencia, opcoes] = await Promise.all([
    getCompetenciaAtual(),
    listarCompetenciasOpcoes(sessao.empresaId || undefined),
  ]);
  const nomeEmpresa = sessao.empresa?.nome ?? "Vínculo de empresa pendente";
  const unidades = sessao.empresa?.unidades ?? 0;
  const colaboradores = sessao.empresa?.colaboradores ?? 0;
  const papel = sessao.role === "admin" ? "Administrador" : "Cliente";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-3">
        {sessao.role === "admin" ? (
          <ContextoAdminTopo />
        ) : (
          <>
            <span className="grid size-8 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand">
              {nomeEmpresa.slice(0, 2).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium">{nomeEmpresa}</p>
              <p className="text-xs text-muted-foreground">
                {unidades} unidades · {colaboradores} colaboradores
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SeletorCompetencia competencia={competencia} opcoes={opcoes} />
        <SeletorTema />
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {sessao.nome.slice(0, 2).toUpperCase()}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium">{sessao.nome}</p>
            <p className="text-xs text-muted-foreground">{papel}</p>
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
