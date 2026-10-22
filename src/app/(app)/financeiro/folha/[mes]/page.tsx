import { notFound } from "next/navigation";

import { AvisoSemEmpresa } from "@/components/cadastros/ui";
import { AbasMesesFolha, PainelFolha } from "@/components/folha/painel-folha";
import { getCompetenciasFolha } from "@/lib/dados";
import {
  getConfigFolha,
  getContratosEmprestimo,
  getFolhaMeses,
  getHistoricoFolha,
  getIntegracaoDreFolha,
  getMembrosFolha,
  getNivelAcessoFolha,
  getUnidadesFolha,
} from "@/lib/dados-folha";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";

/** Uma aba por mês: /financeiro/folha/01 … /12, ano em ?ano=, comparativo em ?comparar=. */
export default async function ApuracaoFolhaMesPage({
  params,
  searchParams,
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ empresa?: string | string[]; ano?: string | string[]; comparar?: string | string[] }>;
}) {
  const [{ mes: mesParam }, busca, sessao] = await Promise.all([params, searchParams, getSessao()]);
  const mes = Number(mesParam);
  if (!/^\d{2}$/.test(mesParam) || mes < 1 || mes > 12) notFound();

  const empresaId = empresaAtiva(sessao, busca.empresa);
  if (!empresaId) return <AvisoSemEmpresa />;

  const competencias = await getCompetenciasFolha(empresaId);

  // Sem ano na URL: o do último relatório importado, ou o ano corrente
  const anoBusca = Number(typeof busca.ano === "string" ? busca.ano : undefined);
  const ultima = competencias.at(-1);
  const ano =
    anoBusca >= 2000 && anoBusca <= 2100
      ? anoBusca
      : ultima
        ? Number(ultima.slice(0, 4))
        : new Date().getFullYear();
  const competencia = `${ano}-${mesParam}-01`;

  // Comparativo: só meses importados, no máximo 6
  const comparar = (typeof busca.comparar === "string" ? busca.comparar.split(",") : [])
    .filter((c) => c !== competencia && competencias.includes(c))
    .slice(0, 6);

  const ehAdmin = sessao.role === "admin";
  const nivel = await getNivelAcessoFolha(sessao, empresaId);
  const [meses, unidades, config, contratos, historico, integracao, membros] = await Promise.all([
    getFolhaMeses(empresaId, [competencia, ...comparar], nivel),
    getUnidadesFolha(empresaId),
    getConfigFolha(empresaId),
    nivel === "agregado" ? Promise.resolve([]) : getContratosEmprestimo(empresaId),
    getHistoricoFolha(empresaId, competencia, nivel),
    getIntegracaoDreFolha(empresaId),
    ehAdmin ? getMembrosFolha(empresaId) : Promise.resolve([]),
  ]);

  const atual = meses[0];
  return (
    <>
      <AbasMesesFolha competencia={competencia} importadas={competencias} />
      <PainelFolha
        // Remonta ao trocar de mês ou reimportar, para zerar filtros e edições locais
        key={`${empresaId}:${competencia}:${atual.apuracoes.map((a) => a.atualizadoEm).join(",")}:${atual.status.status}`}
        empresaId={empresaId}
        competencia={competencia}
        competenciasImportadas={competencias}
        nivel={nivel}
        ehAdmin={ehAdmin}
        perfilEdita={ehAdmin || sessao.role === "cliente"}
        unidades={unidades}
        config={config}
        meses={meses}
        contratos={contratos}
        versoes={historico.versoes}
        eventos={historico.eventos}
        contasDre={integracao.contas}
        planoContas={integracao.planoContas}
        membros={membros}
      />
    </>
  );
}
