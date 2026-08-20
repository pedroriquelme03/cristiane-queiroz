import { Wallet } from "lucide-react";

import { ListaAniversariantes, RelogioEClima } from "@/components/inicio/relogio-e-clima";
import { MarcaCristianeQueiroz } from "@/components/layout/marca-cristiane-queiroz";
import { Badge } from "@/components/ui/badge";
import {
  getAniversariantesHoje,
  getCidadeEmpresa,
  getEmpresa,
  saldoEmCaixa,
} from "@/lib/dados";
import { moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

const SERVICOS = [
  "Sistema de Controle Financeiro",
  "Business Consultant",
  "Financial Service",
  "Financial Aid Service",
] as const;

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa: empresaParam }, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId =
    sessao.role === "admin" && typeof empresaParam === "string"
      ? empresaParam
      : sessao.empresaId || undefined;

  const [empresa, saldo, cidade, aniversariantes] = await Promise.all([
    empresaId ? getEmpresa(empresaId).catch(() => null) : Promise.resolve(null),
    empresaId ? saldoEmCaixa(empresaId).catch(() => null) : Promise.resolve(null),
    empresaId ? getCidadeEmpresa(empresaId) : Promise.resolve(null),
    empresaId ? getAniversariantesHoje(empresaId) : Promise.resolve([]),
  ]);

  const caixaPositivo = (saldo ?? 0) >= 0;

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center gap-10 py-6">
      <MarcaCristianeQueiroz className="mx-auto w-full max-w-md" completa priority />

      <ul className="flex max-w-2xl flex-col items-center gap-2 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2">
        {SERVICOS.map((servico) => (
          <li key={servico} className="text-sm font-medium text-foreground">
            {servico}
          </li>
        ))}
      </ul>

      <section className="w-full max-w-md space-y-3 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status do caixa
          {empresa ? ` · ${empresa.nomeFantasia}` : ""}
        </p>
        {saldo === null ? (
          <p className="text-sm text-muted-foreground">
            {sessao.role === "admin"
              ? "Selecione uma empresa para ver o caixa."
              : "Não foi possível carregar o saldo em caixa."}
          </p>
        ) : (
          <div
            className={cn(
              "rounded-xl border px-6 py-5",
              caixaPositivo
                ? "border-positive/30 bg-positive-soft/40"
                : "border-negative/30 bg-negative-soft/40",
            )}
          >
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Wallet className="size-4" aria-hidden />
              <span className="text-xs">Saldo em caixa</span>
            </div>
            <p
              className={cn(
                "mt-2 tabular text-3xl font-semibold tracking-tight",
                caixaPositivo ? "text-positive" : "text-negative",
              )}
            >
              {moeda(saldo)}
            </p>
            <div className="mt-3 flex justify-center">
              <Badge tom={caixaPositivo ? "positivo" : "negativo"}>
                {caixaPositivo ? "Caixa positivo" : "Caixa negativo"}
              </Badge>
            </div>
          </div>
        )}
      </section>

      <RelogioEClima cidade={cidade?.cidade ?? null} uf={cidade?.uf ?? null} />

      <section className="w-full max-w-2xl space-y-3">
        <h2 className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aniversariantes do dia
        </h2>
        <ListaAniversariantes nomes={aniversariantes.map((a) => a.nome)} />
      </section>
    </div>
  );
}
