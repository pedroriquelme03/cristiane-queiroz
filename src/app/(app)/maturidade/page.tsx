import { GraficoEvolucaoMaturidade } from "@/components/graficos/grafico-evolucao-maturidade";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Progresso } from "@/components/ui/progresso";
import { getMaturidade } from "@/lib/dados";
import { competenciaExtenso } from "@/lib/format";
import type { AreaDiagnostico } from "@/lib/types";

const ROTULO_AREA: Record<AreaDiagnostico, string> = {
  financeiro: "Financeiro",
  compras: "Compras",
  estoque: "Estoque",
  comercial: "Comercial",
  rh: "RH",
  processos: "Processos",
  tecnologia: "Tecnologia",
  gestao: "Gestão",
};

/** Estágios de maturidade — a faixa diz o que a pontuação significa na prática. */
const ESTAGIOS = [
  { min: 80, nome: "Otimizado", descricao: "Processos medidos e em melhoria contínua" },
  { min: 60, nome: "Estruturado", descricao: "Rotinas definidas e sendo cumpridas" },
  { min: 40, nome: "Em organização", descricao: "Controles existem, mas dependem de pessoas" },
  { min: 20, nome: "Inicial", descricao: "Gestão informal, decisões por intuição" },
  { min: 0, nome: "Crítico", descricao: "Sem controles mínimos" },
];

function estagio(pontuacao: number) {
  return ESTAGIOS.find((e) => pontuacao >= e.min)!;
}

function tom(pontuacao: number) {
  if (pontuacao >= 75) return "positivo" as const;
  if (pontuacao >= 50) return "marca" as const;
  if (pontuacao >= 30) return "atencao" as const;
  return "negativo" as const;
}

/** O Kpi não tem o tom "marca" — ali o estágio intermediário fica neutro. */
function tomKpi(pontuacao: number) {
  const t = tom(pontuacao);
  return t === "marca" ? ("neutro" as const) : t;
}

export default async function MaturidadePage() {
  const avaliacoes = await getMaturidade();
  const atual = avaliacoes[avaliacoes.length - 1];
  const inicial = avaliacoes[0];
  const anterior = avaliacoes[avaliacoes.length - 2] ?? inicial;

  const evolucaoTotal = atual.pontuacaoGeral - inicial.pontuacaoGeral;
  const estagioAtual = estagio(atual.pontuacaoGeral);

  const areasOrdenadas = [...atual.itens].sort((a, b) => b.pontuacao - a.pontuacao);
  const maiorAvanco = [...atual.itens]
    .map((item) => ({
      ...item,
      avanco:
        item.pontuacao -
        (inicial.itens.find((i) => i.categoria === item.categoria)?.pontuacao ?? 0),
    }))
    .sort((a, b) => b.avanco - a.avanco)[0];

  return (
    <>
      <CabecalhoPagina
        titulo="Maturidade empresarial"
        descricao={`Pontuação de 0 a 100 por área — leitura de ${competenciaExtenso(atual.competencia)}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Maturidade geral"
          valor={`${atual.pontuacaoGeral}/100`}
          tom={tomKpi(atual.pontuacaoGeral)}
          nota={estagioAtual.nome}
        />
        <Kpi
          rotulo="Evolução no período"
          valor={`${evolucaoTotal >= 0 ? "+" : ""}${evolucaoTotal} pts`}
          tom={evolucaoTotal >= 0 ? "positivo" : "negativo"}
          nota={`Partindo de ${inicial.pontuacaoGeral}/100`}
        />
        <Kpi
          rotulo="Variação no mês"
          valor={`${atual.pontuacaoGeral - anterior.pontuacaoGeral >= 0 ? "+" : ""}${atual.pontuacaoGeral - anterior.pontuacaoGeral} pts`}
        />
        <Kpi
          rotulo="Maior avanço"
          valor={ROTULO_AREA[maiorAvanco.categoria]}
          tom="positivo"
          nota={`+${maiorAvanco.avanco} pontos`}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Evolução mensal"
          descricao="Pontuação geral de maturidade ao longo dos últimos 12 meses"
        />
        <CardBody>
          <GraficoEvolucaoMaturidade avaliacoes={avaliacoes} />
          <div className="mt-4 rounded-lg border border-border bg-surface-muted px-4 py-3">
            <p className="text-sm">
              <strong className="font-medium">{estagioAtual.nome}</strong> —{" "}
              {estagioAtual.descricao}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Pontuação por área"
          descricao="Ordenadas da mais para a menos madura"
        />
        <CardBody className="space-y-4">
          {areasOrdenadas.map((item) => {
            const pontuacaoInicial =
              inicial.itens.find((i) => i.categoria === item.categoria)?.pontuacao ?? 0;
            const avanco = item.pontuacao - pontuacaoInicial;

            return (
              <article key={item.categoria} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">
                    {ROTULO_AREA[item.categoria]}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge tom={tom(item.pontuacao)}>
                      {estagio(item.pontuacao).nome}
                    </Badge>
                    <span className="tabular text-sm font-semibold">
                      {item.pontuacao}
                      <span className="text-xs font-normal text-muted-foreground">
                        /100
                      </span>
                    </span>
                  </div>
                </div>
                <Progresso valor={item.pontuacao} tom={tom(item.pontuacao)} />
                <p className="text-xs text-muted-foreground">
                  {avanco >= 0 ? "+" : ""}
                  {avanco} pontos desde a primeira avaliação
                </p>
              </article>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
