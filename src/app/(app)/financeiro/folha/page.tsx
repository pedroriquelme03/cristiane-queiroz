import { redirect } from "next/navigation";

import { getCompetenciasFolha } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";

/** Entrada da Apuração da Folha: abre a aba do último mês importado (ou do mês atual). */
export default async function ApuracaoFolhaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [busca, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = empresaAtiva(sessao, busca.empresa);
  const ultima = empresaId ? (await getCompetenciasFolha(empresaId)).at(-1) : undefined;

  const hoje = new Date();
  const ano = ultima ? ultima.slice(0, 4) : String(hoje.getFullYear());
  const mes = ultima ? ultima.slice(5, 7) : String(hoje.getMonth() + 1).padStart(2, "0");

  const query = new URLSearchParams({ ano });
  if (typeof busca.empresa === "string") query.set("empresa", busca.empresa);
  redirect(`/financeiro/folha/${mes}?${query.toString()}`);
}
