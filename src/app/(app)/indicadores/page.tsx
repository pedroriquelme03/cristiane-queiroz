import { GraficoIndicador } from "@/components/graficos/grafico-indicador";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getEmpresa, getIndicadores } from "@/lib/dados";
import { percentual, valorIndicador } from "@/lib/format";
import { ROTULO_SEGMENTO } from "@/lib/segmentos";
import { getSessao } from "@/lib/sessao";
import type { Indicador } from "@/lib/types";

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const sessao = await getSessao();

  if (sessao.role === "admin" && !empresaId) {
    return (
      <>
        <CabecalhoPagina
          titulo="Indicadores"
          descricao="Selecione uma empresa para visualizar os indicadores."
          acao={<SeletorEmpresaAdmin />}
        />

        <Card>
          <CardBody>
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa selecionada.
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  const [indicadores, empresa] = await Promise.all([
    getIndicadores(empresaId),
    getEmpresa(empresaId),
  ]);
  const rotuloSegmento = ROTULO_SEGMENTO[empresa.segmento];
  const gerais = indicadores.filter((indicador) => !indicador.personalizado && indicador.segmento === "geral");
  const segmento = empresa.segmento === "geral"
    ? []
    : indicadores.filter((indicador) => !indicador.personalizado && indicador.segmento === empresa.segmento);
  const personalizados = indicadores.filter((indicador) => indicador.personalizado);

  return (
    <>
      <CabecalhoPagina
        titulo="Indicadores"
        descricao={`${indicadores.length} indicadores para ${rotuloSegmento}: ${gerais.length} gerais, ${segmento.length} do segmento e ${personalizados.length} personalizados`}
        acao={<SeletorEmpresaAdmin />}
      />

      {indicadores.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted-foreground">
            Nenhum indicador disponível para esta empresa.
          </CardBody>
        </Card>
      ) : null}

      <SecaoIndicadores
        titulo="Indicadores gerais"
        descricao="Métricas financeiras comuns a todos os segmentos"
        indicadores={gerais}
      />
      <SecaoIndicadores
        titulo={`Indicadores de ${rotuloSegmento}`}
        descricao="Métricas operacionais relacionadas ao segmento da empresa"
        indicadores={segmento}
      />
      <SecaoIndicadores
        titulo="Indicadores personalizados"
        descricao="Métricas criadas especificamente para esta empresa"
        indicadores={personalizados}
      />
    </>
  );
}

function SecaoIndicadores({
  titulo,
  descricao,
  indicadores,
}: {
  titulo: string;
  descricao: string;
  indicadores: Indicador[];
}) {
  if (!indicadores.length) return null;
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        {indicadores.map((indicador) => <CartaoIndicador key={indicador.id} indicador={indicador} />)}
      </div>
    </section>
  );
}

function CartaoIndicador({ indicador }: { indicador: Indicador }) {
  const serie = indicador.valores;
  const primeiro = serie[0]?.valor ?? 0;
  const atual = serie[serie.length - 1]?.valor ?? 0;
  const meta = serie[serie.length - 1]?.meta ?? null;
  const variacao = primeiro !== 0 ? ((atual - primeiro) / Math.abs(primeiro)) * 100 : 0;
  const favoravel = indicador.direcaoMeta === "maior_melhor" ? atual > primeiro : atual < primeiro;
  const atingiuMeta = meta === null
    ? null
    : indicador.direcaoMeta === "maior_melhor"
      ? atual >= meta
      : atual <= meta;

  return (
    <Card>
      <CardHeader
        titulo={indicador.nome}
        descricao={indicador.descricao}
        acao={atingiuMeta === null ? null : (
          <Badge tom={atingiuMeta ? "positivo" : "atencao"}>
            {atingiuMeta ? "Meta atingida" : "Abaixo da meta"}
          </Badge>
        )}
      />
      <CardBody>
        {serie.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum valor lançado para este indicador.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight">
                {valorIndicador(atual, indicador.unidade)}
              </span>
              <Badge tom={favoravel ? "positivo" : "negativo"}>
                {variacao >= 0 ? "+" : ""}{percentual(variacao)} em 12 meses
              </Badge>
            </div>
            <GraficoIndicador indicador={indicador} />
          </>
        )}
      </CardBody>
    </Card>
  );
}
