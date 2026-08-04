import { PainelReceitas } from "@/components/financeiro/painel-receitas";
import { getCompetenciaAtual, getDre, getLancamentos, intervaloDoMes } from "@/lib/dados";
import { competenciaExtenso } from "@/lib/format";

export default async function ReceitasPage({ searchParams }: { searchParams: Promise<{ empresa?: string | string[] }> }) {
  const { empresa } = await searchParams;
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const competencia = await getCompetenciaAtual();
  const { inicio, fim } = intervaloDoMes(competencia);
  const [linhas, lancamentos] = await Promise.all([getDre(inicio, fim, empresaId), getLancamentos(inicio, fim, empresaId)]);

  return <PainelReceitas linhas={linhas} lancamentos={lancamentos} competencia={competenciaExtenso(competencia)} />;
}
