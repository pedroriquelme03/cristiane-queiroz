import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CampoTexto } from "@/components/ui/campo";
import {
  AREAS_AVALIACAO,
  PROGRESSO_DIAGNOSTICO,
  ROTULO_AREA,
  ROTULO_PROGRESSO_DIAGNOSTICO,
} from "@/lib/avaliacoes";
import { getDiagnosticos } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { competenciaExtenso, dataHora } from "@/lib/format";
import { comEmpresa } from "@/lib/relatorios/filtros";
import { getSessao } from "@/lib/sessao";
import type { AreaDiagnostico, ProgressoDiagnostico } from "@/lib/types";

const CLASSE_SELECT =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0]?.trim() ?? "" : valor?.trim() ?? "";
}

export default async function RelatorioDiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = empresaAtiva(sessao, params.empresa);
  const competenciaFiltro = primeiro(params.competencia);
  const area = primeiro(params.area) || "todas";
  const progressoFiltro = primeiro(params.progresso) || "todos";

  if (!empresaId) {
    return (
      <>
        <CabecalhoPagina
          titulo="Relatório do diagnóstico"
          descricao="Avaliação e execução por área"
          acao={sessao.role === "admin" ? <SeletorEmpresaAdmin /> : undefined}
        />
        <AvisoRelatorioSemEmpresa />
      </>
    );
  }

  const diagnosticos = await getDiagnosticos(empresaId);
  const alvo =
    diagnosticos.find((d) => d.competencia.slice(0, 7) === competenciaFiltro.slice(0, 7)) ??
    diagnosticos[diagnosticos.length - 1];

  const itens = (alvo?.itens ?? []).filter((item) => {
    if (area !== "todas" && item.categoria !== area) return false;
    if (progressoFiltro !== "todos" && String(item.progresso) !== progressoFiltro) {
      return false;
    }
    return true;
  });

  const mediaNotas = itens.length
    ? Math.round(itens.reduce((s, i) => s + i.nota, 0) / itens.length)
    : 0;
  const concluidas = itens.filter((i) => i.progresso === 100).length;
  const criticasSemAvanco = itens.filter((i) => i.nota < 30 && i.progresso === 0).length;
  const ultimaAtualizacao = itens.reduce<string | null>((acc, item) => {
    if (!item.atualizadoEm) return acc;
    if (!acc || item.atualizadoEm > acc) return item.atualizadoEm;
    return acc;
  }, alvo?.atualizadoEm ?? null);

  const partesFiltro = [
    `Competência: ${alvo ? competenciaExtenso(alvo.competencia) : "nenhuma"}`,
    `Área: ${area === "todas" ? "todas" : ROTULO_AREA[area as AreaDiagnostico] ?? area}`,
    `Andamento: ${
      progressoFiltro === "todos"
        ? "todos"
        : ROTULO_PROGRESSO_DIAGNOSTICO[Number(progressoFiltro) as ProgressoDiagnostico] ??
          progressoFiltro
    }`,
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Relatório do diagnóstico"
        descricao="Notas de avaliação e andamento da execução por área"
        acao={sessao.role === "admin" ? <SeletorEmpresaAdmin /> : undefined}
      />
      <PainelRelatorio
        titulo="Diagnóstico · avaliação e execução"
        descricao="A nota permanece na avaliação; o andamento reflete a execução registrada."
        voltarHref={comEmpresa("/diagnostico", empresaId)}
        voltarRotulo="Voltar ao diagnóstico"
        resumoFiltros={partesFiltro.join(" · ")}
        nomeArquivo="relatorio-diagnostico"
        filtros={
          <form method="get" action="/diagnostico/relatorio" className="space-y-4">
            <input type="hidden" name="empresa" value={empresaId} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label htmlFor="competencia" className="text-sm font-medium">
                  Competência
                </label>
                <select
                  id="competencia"
                  name="competencia"
                  defaultValue={alvo?.competencia.slice(0, 7) ?? ""}
                  className={CLASSE_SELECT}
                >
                  {[...diagnosticos].reverse().map((d) => (
                    <option key={d.id || d.competencia} value={d.competencia.slice(0, 7)}>
                      {competenciaExtenso(d.competencia)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="area" className="text-sm font-medium">
                  Área
                </label>
                <select id="area" name="area" defaultValue={area} className={CLASSE_SELECT}>
                  <option value="todas">Todas</option>
                  {AREAS_AVALIACAO.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="progresso" className="text-sm font-medium">
                  Andamento
                </label>
                <select
                  id="progresso"
                  name="progresso"
                  defaultValue={progressoFiltro}
                  className={CLASSE_SELECT}
                >
                  <option value="todos">Todos</option>
                  {PROGRESSO_DIAGNOSTICO.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <CampoTexto
                id="atualizado"
                rotulo="Última atualização"
                defaultValue={ultimaAtualizacao ? dataHora(ultimaAtualizacao) : "—"}
                readOnly
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
            >
              Aplicar filtros
            </button>
          </form>
        }
        kpis={[
          { rotulo: "Áreas", valor: String(itens.length) },
          { rotulo: "Média das notas", valor: String(mediaNotas) },
          {
            rotulo: "Execução concluída",
            valor: String(concluidas),
            tom: "positivo",
          },
          {
            rotulo: "Críticas sem avanço",
            valor: String(criticasSemAvanco),
            tom: criticasSemAvanco ? "negativo" : "positivo",
          },
        ]}
        colunas={[
          { chave: "area", rotulo: "Área" },
          { chave: "nota", rotulo: "Nota (avaliação)", tipo: "numero" },
          { chave: "observacao", rotulo: "Observação (avaliação)" },
          { chave: "progresso", rotulo: "Andamento" },
          { chave: "dataRealizacao", rotulo: "Data realização", tipo: "data" },
          { chave: "realizado", rotulo: "O que foi realizado" },
          { chave: "atualizado", rotulo: "Última atualização" },
        ]}
        linhas={itens.map((item) => ({
          area: ROTULO_AREA[item.categoria],
          nota: item.nota,
          observacao: item.observacao || "—",
          progresso: `${ROTULO_PROGRESSO_DIAGNOSTICO[item.progresso]} (${item.progresso}%)`,
          dataRealizacao: item.dataRealizacao ?? "",
          realizado: item.realizado || "—",
          atualizado: item.atualizadoEm ? dataHora(item.atualizadoEm) : "—",
        }))}
      />
    </>
  );
}
