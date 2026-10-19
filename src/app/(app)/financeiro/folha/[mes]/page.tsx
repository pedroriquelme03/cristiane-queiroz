import { notFound } from "next/navigation";

import { AvisoSemEmpresa } from "@/components/cadastros/ui";
import { AbasMesesFolha, PainelFolha } from "@/components/folha/painel-folha";
import {
  getApuracaoFolha,
  getCompetenciasFolha,
  getConfigRubricasFolha,
} from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";

/** Uma aba por mês: /financeiro/folha/01 … /financeiro/folha/12, ano em ?ano=. */
export default async function ApuracaoFolhaMesPage({
  params,
  searchParams,
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ empresa?: string | string[]; ano?: string | string[] }>;
}) {
  const [{ mes: mesParam }, busca, sessao] = await Promise.all([params, searchParams, getSessao()]);
  const mes = Number(mesParam);
  if (!/^\d{2}$/.test(mesParam) || mes < 1 || mes > 12) notFound();

  const empresaId = empresaAtiva(sessao, busca.empresa);
  if (!empresaId) return <AvisoSemEmpresa />;

  const competencias = await getCompetenciasFolha(empresaId);

  // Sem ano na URL: o do último extrato importado, ou o ano corrente
  const anoBusca = Number(typeof busca.ano === "string" ? busca.ano : undefined);
  const ultima = competencias.at(-1);
  const ano =
    anoBusca >= 2000 && anoBusca <= 2100
      ? anoBusca
      : ultima
        ? Number(ultima.slice(0, 4))
        : new Date().getFullYear();
  const competencia = `${ano}-${mesParam}-01`;

  const [dados, configs] = await Promise.all([
    getApuracaoFolha(competencia, empresaId),
    getConfigRubricasFolha(empresaId),
  ]);

  return (
    <>
      <AbasMesesFolha competencia={competencia} importadas={competencias} />
      <PainelFolha
        // Remonta ao trocar de mês para zerar filtros e edições locais
        key={`${empresaId}:${competencia}:${dados?.apuracao.atualizadoEm ?? ""}`}
        empresaId={empresaId}
        competencia={competencia}
        competenciasImportadas={competencias}
        apuracao={dados?.apuracao ?? null}
        funcionarios={dados?.funcionarios ?? []}
        configsIniciais={configs}
        podeEditar={sessao.role === "admin" || sessao.role === "cliente"}
      />
    </>
  );
}
