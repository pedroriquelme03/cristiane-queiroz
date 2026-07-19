import { GraficoIndicador } from "@/components/graficos/grafico-indicador";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmpresa, getIndicadores } from "@/lib/dados";
import { percentual, valorIndicador } from "@/lib/format";

export default async function IndicadoresPage() {
  const [indicadores, empresa] = await Promise.all([getIndicadores(), getEmpresa()]);

  return (
    <>
      <CabecalhoPagina
        titulo="Indicadores"
        descricao={`Painel de ${indicadores.length} indicadores, personalizados para o segmento de ${empresa.segmento}`}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {indicadores.map((indicador) => {
          const serie = indicador.valores;
          const primeiro = serie[0].valor;
          const atual = serie[serie.length - 1].valor;
          const meta = serie[serie.length - 1].meta;
          const variacao = ((atual - primeiro) / Math.abs(primeiro)) * 100;

          const favoravel =
            indicador.direcaoMeta === "maior_melhor"
              ? atual > primeiro
              : atual < primeiro;

          const atingiuMeta =
            meta === null
              ? null
              : indicador.direcaoMeta === "maior_melhor"
                ? atual >= meta
                : atual <= meta;

          return (
            <Card key={indicador.id}>
              <CardHeader
                titulo={indicador.nome}
                descricao={indicador.descricao}
                acao={
                  atingiuMeta === null ? null : (
                    <Badge tom={atingiuMeta ? "positivo" : "atencao"}>
                      {atingiuMeta ? "Meta atingida" : "Abaixo da meta"}
                    </Badge>
                  )
                }
              />
              <CardBody>
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold tracking-tight">
                    {valorIndicador(atual, indicador.unidade)}
                  </span>
                  <Badge tom={favoravel ? "positivo" : "negativo"}>
                    {variacao >= 0 ? "+" : ""}
                    {percentual(variacao)} em 12 meses
                  </Badge>
                </div>
                <GraficoIndicador indicador={indicador} />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
