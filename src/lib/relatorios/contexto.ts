import { getCompetenciaAtual } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import {
  parseFiltrosRelatorio,
  resolverIntervalo,
  textoResumoFiltros,
  type FiltrosRelatorio,
} from "@/lib/relatorios/filtros";
import { getSessao } from "@/lib/sessao";
import type { PlanoConta } from "@/lib/types";

export type SearchParamsRelatorio = Promise<Record<string, string | string[] | undefined>>;

export async function carregarContextoRelatorio(searchParams: SearchParamsRelatorio) {
  const [params, sessao, competencia] = await Promise.all([
    searchParams,
    getSessao(),
    getCompetenciaAtual(),
  ]);
  const empresaId = empresaAtiva(sessao, params.empresa);
  const filtros = parseFiltrosRelatorio(params, {
    mes: competencia.slice(0, 7),
    ano: competencia.slice(0, 4),
    empresa: empresaId ?? undefined,
  });
  const intervalo = resolverIntervalo(filtros);

  return { params, sessao, empresaId, filtros, intervalo, competencia };
}

export function resumoDosFiltros(
  filtros: FiltrosRelatorio,
  contas: PlanoConta[],
) {
  return textoResumoFiltros(filtros, resolverIntervalo(filtros), contas);
}
