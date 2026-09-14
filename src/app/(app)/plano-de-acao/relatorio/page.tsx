import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { FiltrosRelatorioAcoes } from "@/components/relatorios/filtros-acoes";
import { PainelRelatorio } from "@/components/relatorios/painel-relatorio";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { getPlanosAcao } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { comEmpresa } from "@/lib/relatorios/filtros";
import { diasAte, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import type { AreaDiagnostico, PlanoAcao, StatusAcao } from "@/lib/types";

const ROTULO_STATUS: Record<StatusAcao, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ROTULO_PRIORIDADE: Record<PlanoAcao["prioridade"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

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

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0]?.trim() ?? "" : valor?.trim() ?? "";
}

function estaAtrasada(acao: PlanoAcao) {
  return acao.status !== "concluido" && acao.status !== "cancelado" && diasAte(acao.prazo) < 0;
}

export default async function RelatorioPlanoAcaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = empresaAtiva(sessao, params.empresa);
  const inicio = primeiro(params.inicio);
  const fim = primeiro(params.fim);
  const status = primeiro(params.status) || "todos";
  const prioridade = primeiro(params.prioridade) || "todas";
  const area = primeiro(params.area) || "todas";

  if (!empresaId) {
    return (
      <>
        <CabecalhoPagina
          titulo="Relatório do plano de ação"
          descricao="Ações cadastradas com filtros de prazo, status e área"
          acao={sessao.role === "admin" ? <SeletorEmpresaAdmin /> : undefined}
        />
        <AvisoRelatorioSemEmpresa />
      </>
    );
  }

  const acoes = (await getPlanosAcao(empresaId)).filter((acao) => {
    if (inicio && acao.prazo.slice(0, 10) < inicio) return false;
    if (fim && acao.prazo.slice(0, 10) > fim) return false;
    if (status === "atrasado") return estaAtrasada(acao);
    if (status !== "todos" && acao.status !== status) return false;
    if (prioridade !== "todas" && acao.prioridade !== prioridade) return false;
    if (area !== "todas" && acao.area !== area) return false;
    return true;
  });

  const atrasadas = acoes.filter(estaAtrasada).length;
  const concluidas = acoes.filter((acao) => acao.status === "concluido").length;
  const impacto = acoes.reduce((soma, acao) => soma + (acao.impactoEstimado ?? 0), 0);
  const partesFiltro = [
    inicio || fim ? `Prazo: ${inicio || "início"} a ${fim || "fim"}` : "Prazo: todos",
    `Status: ${status === "todos" ? "todos" : status === "atrasado" ? "em atraso" : ROTULO_STATUS[status as StatusAcao] ?? status}`,
    `Prioridade: ${prioridade === "todas" ? "todas" : ROTULO_PRIORIDADE[prioridade as PlanoAcao["prioridade"]] ?? prioridade}`,
    `Área: ${area === "todas" ? "todas" : ROTULO_AREA[area as AreaDiagnostico] ?? area}`,
  ];

  return (
    <>
      <CabecalhoPagina
        titulo="Relatório do plano de ação"
        descricao="Visualize, filtre e exporte as ações cadastradas"
        acao={sessao.role === "admin" ? <SeletorEmpresaAdmin /> : undefined}
      />
      <PainelRelatorio
        titulo="Ações cadastradas"
        voltarHref={comEmpresa("/plano-de-acao", empresaId)}
        voltarRotulo="Voltar ao plano de ação"
        resumoFiltros={partesFiltro.join(" · ")}
        nomeArquivo="relatorio-plano-de-acao"
        filtros={
          <FiltrosRelatorioAcoes
            action="/plano-de-acao/relatorio"
            empresaId={empresaId}
            inicio={inicio}
            fim={fim}
            status={status}
            prioridade={prioridade}
            area={area}
          />
        }
        kpis={[
          { rotulo: "Ações", valor: String(acoes.length) },
          { rotulo: "Concluídas", valor: String(concluidas), tom: "positivo" },
          { rotulo: "Em atraso", valor: String(atrasadas), tom: atrasadas ? "negativo" : "positivo" },
          { rotulo: "Impacto estimado", valor: moeda(impacto) },
        ]}
        colunas={[
          { chave: "problema", rotulo: "Problema" },
          { chave: "acao", rotulo: "Ação" },
          { chave: "area", rotulo: "Área" },
          { chave: "responsavel", rotulo: "Responsável" },
          { chave: "prazo", rotulo: "Prazo", tipo: "data" },
          { chave: "prioridade", rotulo: "Prioridade" },
          { chave: "status", rotulo: "Status" },
          { chave: "percentual", rotulo: "Avanço %", tipo: "numero" },
          { chave: "impacto", rotulo: "Impacto estimado", tipo: "moeda" },
        ]}
        linhas={acoes.map((acao) => ({
          problema: acao.problema,
          acao: acao.acao,
          area: ROTULO_AREA[acao.area],
          responsavel: acao.responsavel,
          prazo: acao.prazo,
          prioridade: ROTULO_PRIORIDADE[acao.prioridade],
          status: estaAtrasada(acao) ? `${ROTULO_STATUS[acao.status]} (atrasada)` : ROTULO_STATUS[acao.status],
          percentual: acao.percentual,
          impacto: acao.impactoEstimado ?? 0,
        }))}
      />
    </>
  );
}
