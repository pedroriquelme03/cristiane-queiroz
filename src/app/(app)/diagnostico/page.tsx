import { GraficoRadar } from "@/components/graficos/grafico-radar";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Progresso } from "@/components/ui/progresso";
import { getDiagnosticos } from "@/lib/dados";
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

/** Faixas de leitura da nota, para o gestor saber o que fazer com ela. */
function faixa(nota: number) {
  if (nota >= 75) return { rotulo: "Consolidado", tom: "positivo" as const };
  if (nota >= 50) return { rotulo: "Em evolução", tom: "marca" as const };
  if (nota >= 30) return { rotulo: "Frágil", tom: "atencao" as const };
  return { rotulo: "Crítico", tom: "negativo" as const };
}

export default async function DiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const diagnosticos = await getDiagnosticos(empresaId);
  const inicial = diagnosticos[0];
  const atual = diagnosticos[diagnosticos.length - 1];

  const dadosRadar = atual.itens.map((item) => ({
    area: ROTULO_AREA[item.categoria],
    inicial: inicial.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0,
    atual: item.nota,
  }));

  const mediaAtual = Math.round(
    atual.itens.reduce((s, i) => s + i.nota, 0) / atual.itens.length,
  );
  const mediaInicial = Math.round(
    inicial.itens.reduce((s, i) => s + i.nota, 0) / inicial.itens.length,
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Diagnóstico empresarial"
        descricao={`Avaliação por área — última leitura em ${competenciaExtenso(atual.competencia)}`}
        acao={<SeletorEmpresaAdmin />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Panorama das áreas"
            descricao={`Nota geral evoluiu de ${mediaInicial} para ${mediaAtual} em ${diagnosticos.length} avaliações`}
          />
          <CardBody>
            <GraficoRadar dados={dadosRadar} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titulo="Notas por área"
            descricao="Avaliação atual e observações da consultoria"
          />
          <CardBody className="space-y-4">
            {atual.itens.map((item) => {
              const notaInicial =
                inicial.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0;
              const evolucao = item.nota - notaInicial;
              const classificacao = faixa(item.nota);

              return (
                <article key={item.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                      {ROTULO_AREA[item.categoria]}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge tom={classificacao.tom}>{classificacao.rotulo}</Badge>
                      <span className="tabular text-sm font-semibold">
                        {item.nota}
                        <span className="text-xs font-normal text-muted-foreground">
                          /100
                        </span>
                      </span>
                    </div>
                  </div>
                  <Progresso valor={item.nota} tom={classificacao.tom === "negativo" ? "negativo" : classificacao.tom === "atencao" ? "atencao" : classificacao.tom === "positivo" ? "positivo" : "marca"} />
                  <p className="text-xs text-muted-foreground">
                    {evolucao >= 0 ? "+" : ""}
                    {evolucao} pontos desde a avaliação inicial · {item.observacao}
                  </p>
                </article>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          titulo="Histórico de avaliações"
          descricao="Evolução das notas a cada diagnóstico"
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">
                    Área
                  </th>
                  {diagnosticos.map((d) => (
                    <th
                      key={d.competencia}
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium"
                    >
                      {competenciaExtenso(d.competencia)}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Evolução
                  </th>
                </tr>
              </thead>
              <tbody>
                {atual.itens.map((item) => {
                  const notas = diagnosticos.map(
                    (d) =>
                      d.itens.find((i) => i.categoria === item.categoria)?.nota ?? 0,
                  );
                  const evolucao = notas[notas.length - 1] - notas[0];
                  return (
                    <tr
                      key={item.categoria}
                      className="border-b border-border last:border-0"
                    >
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        {ROTULO_AREA[item.categoria]}
                      </th>
                      {notas.map((nota, i) => (
                        <td
                          key={diagnosticos[i].competencia}
                          className="tabular px-3 py-2.5 text-right"
                        >
                          {nota}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right">
                        <Badge tom={evolucao > 0 ? "positivo" : "neutro"}>
                          {evolucao >= 0 ? "+" : ""}
                          {evolucao} pts
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Observações da consultoria" />
        <CardBody className="space-y-4">
          {[...diagnosticos].reverse().map((d) => (
            <article key={d.competencia} className="border-l-2 border-border pl-4">
              <p className="text-xs font-medium text-muted-foreground">
                {competenciaExtenso(d.competencia)}
              </p>
              <p className="mt-0.5 text-sm">{d.observacoes}</p>
            </article>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
