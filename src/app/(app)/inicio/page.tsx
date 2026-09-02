import { Wallet } from "lucide-react";

import { ListaAniversariantes, RelogioEClima } from "@/components/inicio/relogio-e-clima";
import { MarcaCristianeQueiroz } from "@/components/layout/marca-cristiane-queiroz";
import { Kpi } from "@/components/ui/kpi";
import {
  getAniversariantesHoje,
  getCidadeEmpresa,
  getEmpresa,
  saldoEmCaixa,
} from "@/lib/dados";
import { moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";

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

      <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          rotulo={empresa ? `Saldo em caixa · ${empresa.nomeFantasia}` : "Saldo em caixa"}
          valor={saldo === null ? "—" : moeda(saldo)}
          tom={saldo === null ? "neutro" : caixaPositivo ? "positivo" : "negativo"}
          icone={<Wallet className="size-4" aria-hidden />}
          nota={
            saldo === null
              ? sessao.role === "admin"
                ? "Selecione uma empresa para ver o caixa."
                : "Não foi possível carregar o saldo em caixa."
              : caixaPositivo
                ? "Caixa positivo"
                : "Caixa negativo"
          }
        />

        <RelogioEClima cidade={cidade?.cidade ?? null} uf={cidade?.uf ?? null} />

        <ListaAniversariantes nomes={aniversariantes.map((a) => a.nome)} />
      </div>
    </div>
  );
}
