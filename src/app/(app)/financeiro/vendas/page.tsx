import { AvisoSemEmpresa } from "@/components/cadastros/ui";
import { PainelVendas } from "@/components/vendas/painel-vendas";
import { getAnosVendas, getRelatoriosVendas } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[]; ano?: string | string[]; mes?: string | string[] }>;
}) {
  const [busca, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = empresaAtiva(sessao, busca.empresa);
  if (!empresaId) return <AvisoSemEmpresa />;

  const anos = await getAnosVendas(empresaId);
  const anoBusca = Number(typeof busca.ano === "string" ? busca.ano : undefined);
  const ano = anoBusca >= 2000 && anoBusca <= 2100 ? anoBusca : (anos.at(-1) ?? new Date().getFullYear());
  const relatorios = await getRelatoriosVendas(ano, empresaId);

  const mesBusca = Number(typeof busca.mes === "string" ? busca.mes : undefined);
  const ultimoMes = relatorios.at(-1) ? Number(relatorios.at(-1)!.competencia.slice(5, 7)) : null;
  const mes = mesBusca >= 1 && mesBusca <= 12 ? mesBusca : (ultimoMes ?? new Date().getMonth() + 1);

  return (
    <PainelVendas
      key={`${empresaId}:${ano}:${relatorios.map((r) => r.atualizadoEm).join()}`}
      empresaId={empresaId}
      ano={ano}
      mesInicial={mes}
      anos={anos}
      relatorios={relatorios}
      podeEditar={sessao.role === "admin" || sessao.role === "cliente"}
    />
  );
}
