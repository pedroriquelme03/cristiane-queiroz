import { Clock3 } from "lucide-react";

import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import {
  DialogoPlanoAcao,
  DialogoProgresso,
  ExcluirPlanoAcao,
} from "@/components/plano-acao/controles-plano-acao";
import { Badge, type TomBadge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Progresso } from "@/components/ui/progresso";
import { getHistoricoPlanosAcao, getPlanosAcao } from "@/lib/dados";
import { data as formatarData, dataHora, diasAte, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import type { AreaDiagnostico, PlanoAcao, StatusAcao } from "@/lib/types";

const ROTULO_STATUS: Record<StatusAcao, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const TOM_STATUS: Record<StatusAcao, TomBadge> = {
  nao_iniciado: "neutro",
  em_andamento: "marca",
  concluido: "positivo",
  cancelado: "neutro",
};

const ROTULO_PRIORIDADE: Record<PlanoAcao["prioridade"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const TOM_PRIORIDADE: Record<PlanoAcao["prioridade"], TomBadge> = {
  baixa: "neutro",
  media: "neutro",
  alta: "atencao",
  critica: "negativo",
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

/** Uma ação está atrasada quando o prazo passou e ela não foi concluída. */
function estaAtrasada(acao: PlanoAcao) {
  return (
    acao.status !== "concluido" &&
    acao.status !== "cancelado" &&
    diasAte(acao.prazo) < 0
  );
}

export default async function PlanoDeAcaoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa: empresaParam }, sessao] = await Promise.all([
    searchParams,
    getSessao(),
  ]);
  const empresaId = typeof empresaParam === "string" ? empresaParam : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const [acoes, historico] = await Promise.all([
    getPlanosAcao(empresaIdAtiva),
    getHistoricoPlanosAcao(empresaIdAtiva),
  ]);

  const concluidas = acoes.filter((a) => a.status === "concluido");
  const emAndamento = acoes.filter((a) => a.status === "em_andamento");
  const atrasadas = acoes.filter(estaAtrasada);
  const impactoTotal = acoes.reduce((s, a) => s + (a.impactoEstimado ?? 0), 0);
  const impactoCapturado = concluidas.reduce((s, a) => s + (a.impactoEstimado ?? 0), 0);

  const avancoMedio = acoes.length
    ? Math.round(acoes.reduce((s, a) => s + a.percentual, 0) / acoes.length)
    : 0;

  const acoesCabecalho = sessao.role === "admin" ? (
    <div className="flex flex-wrap items-end justify-end gap-2">
      <SeletorEmpresaAdmin className="w-full sm:w-72" />
      <DialogoPlanoAcao empresaId={empresaIdAtiva} />
    </div>
  ) : undefined;

  return (
    <>
      <CabecalhoPagina
        titulo="Plano de ação"
        descricao="Acompanhamento das ações propostas pela consultoria"
        acao={acoesCabecalho}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Avanço geral"
          valor={`${avancoMedio}%`}
          nota={`${concluidas.length} de ${acoes.length} ações concluídas`}
        />
        <Kpi rotulo="Em andamento" valor={String(emAndamento.length)} tom="neutro" />
        <Kpi
          rotulo="Em atraso"
          valor={String(atrasadas.length)}
          tom={atrasadas.length ? "negativo" : "positivo"}
        />
        <Kpi
          rotulo="Impacto capturado"
          valor={moeda(impactoCapturado)}
          tom="positivo"
          nota={`De ${moeda(impactoTotal)} estimados no plano`}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Ações"
          descricao="Problema identificado, ação proposta e situação atual"
        />
        <CardBody className="space-y-3">
          {acoes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {sessao.role === "admin" && !empresaIdAtiva
                ? "Selecione uma empresa para visualizar e cadastrar ações."
                : "Nenhuma ação cadastrada."}
            </p>
          ) : null}
          {acoes.map((acao) => {
            const atrasada = estaAtrasada(acao);
            return (
              <article
                key={acao.id}
                className="rounded-lg border border-border p-4"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Problema identificado
                    </p>
                    <p className="mt-0.5 text-sm">{acao.problema}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Badge tom="neutro">{ROTULO_AREA[acao.area]}</Badge>
                    <Badge tom={TOM_PRIORIDADE[acao.prioridade]}>
                      {ROTULO_PRIORIDADE[acao.prioridade]}
                    </Badge>
                    <Badge tom={TOM_STATUS[acao.status]}>
                      {ROTULO_STATUS[acao.status]}
                    </Badge>
                  </div>
                </header>

                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ação proposta
                  </p>
                  <p className="mt-0.5 text-sm">{acao.acao}</p>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {acao.responsavel} · prazo {formatarData(acao.prazo)}
                      {atrasada ? (
                        <span className="ml-1 font-medium text-negative">
                          ({Math.abs(diasAte(acao.prazo))} dias em atraso)
                        </span>
                      ) : null}
                      {acao.impactoEstimado
                        ? ` · impacto estimado ${moeda(acao.impactoEstimado)}`
                        : ""}
                    </span>
                    <span className="tabular shrink-0 font-medium">
                      {acao.percentual}%
                    </span>
                  </div>
                  <Progresso
                    valor={acao.percentual}
                    tom={
                      acao.status === "concluido"
                        ? "positivo"
                        : atrasada
                          ? "negativo"
                          : "marca"
                    }
                  />
                </div>

                {sessao.role === "admin" || sessao.role === "cliente" ? (
                  <footer className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
                    {sessao.role === "cliente" ? (
                      <DialogoProgresso acao={acao} admin={false} />
                    ) : (
                      <>
                        <DialogoPlanoAcao empresaId={empresaIdAtiva} acao={acao} />
                        <ExcluirPlanoAcao acao={acao} />
                      </>
                    )}
                  </footer>
                ) : null}
              </article>
            );
          })}
        </CardBody>
      </Card>

      {historico.length ? (
        <Card>
          <CardHeader
            titulo="Histórico de alterações"
            descricao="Registro de quem alterou o plano e quando"
          />
          <CardBody className="space-y-3">
            {historico.slice(0, 20).map((evento) => (
              <article key={evento.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                  <Clock3 className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm">{evento.descricao}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {evento.autorNome} · {formatarDataHora(evento.criadoEm)}
                  </p>
                </div>
              </article>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function formatarDataHora(iso: string) {
  return dataHora(iso);
}
