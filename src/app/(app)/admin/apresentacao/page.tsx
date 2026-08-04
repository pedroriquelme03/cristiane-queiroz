import { SeletorCliente } from "@/app/(app)/admin/visao-cliente/seletor-cliente";
import { PainelApresentacaoCliente } from "@/components/admin/painel-apresentacao-cliente";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getCompetenciaAtual, getDre, getIndicadores, getFluxoProjetado, intervaloDoMes } from "@/lib/dados";
import { createClient } from "@/lib/supabase/server";

export default async function ApresentacaoPage({ searchParams }: { searchParams: Promise<{ empresa?: string | string[] }> }) {
  const { empresa: empresaParam } = await searchParams;
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const supabase = await createClient();
  const [{ data: empresas }, atual] = await Promise.all([
    supabase.from("empresas").select("id, razao_social, nome_fantasia").order("razao_social"),
    getCompetenciaAtual(),
  ]);
  const empresa = (empresas ?? []).find((item) => item.id === empresaId);

  if (!empresa) return <Card><CardHeader titulo="Apresentação ao cliente" descricao="Escolha uma empresa para montar a visão executiva." /><CardBody className="max-w-xl"><SeletorCliente empresas={empresas ?? []} empresaSelecionadaId={empresaId} rotaBase="/admin/apresentacao" rotulo="Cliente da apresentação" /></CardBody></Card>;

  const competencias = Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(`${atual}T12:00:00`);
    data.setMonth(data.getMonth() - (5 - indice));
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dres, projecao, indicadores] = await Promise.all([
    Promise.all(competencias.map(async (competencia) => { const { inicio, fim } = intervaloDoMes(competencia); return getDre(inicio, fim, empresa.id); })),
    getFluxoProjetado(90, empresa.id),
    getIndicadores(empresa.id),
  ]);
  const linhas = dres.at(-1) ?? [];
  const serie = dres.map((dre, indice) => {
    const receita = dre.filter((linha) => linha.tipo === "receita").reduce((total, linha) => total + linha.realizado, 0);
    const resultado = dre.reduce((total, linha) => total + linha.realizado, 0);
    return { competencia: competencias[indice], receita, despesas: receita - resultado, resultado };
  });

  return <div className="space-y-6"><Card><CardHeader titulo="Apresentação ao cliente" descricao="Selecione o cliente e conduza a reunião em modo visual." /><CardBody className="max-w-xl"><SeletorCliente empresas={empresas ?? []} empresaSelecionadaId={empresa.id} rotaBase="/admin/apresentacao" rotulo="Cliente da apresentação" /></CardBody></Card><PainelApresentacaoCliente nomeEmpresa={empresa.nome_fantasia ?? empresa.razao_social} serie={serie} linhas={linhas} projecao={projecao} indicadores={indicadores} /></div>;
}
