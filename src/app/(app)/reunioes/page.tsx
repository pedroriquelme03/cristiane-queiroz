import { BellRing, CalendarClock, Check, GraduationCap, Users, Video } from "lucide-react";

import { aceitarSolicitacaoReuniao } from "@/app/(app)/reunioes/acoes";
import { SeletorEmpresaAdmin } from "@/components/admin/seletor-empresa-admin";
import { DialogoReuniao } from "@/components/reunioes/dialogo-reuniao";
import { Badge } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { nivelDoPlano } from "@/lib/acesso-planos";
import { getReunioes } from "@/lib/dados";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa: empresaParam }, sessao] = await Promise.all([
    searchParams,
    getSessao(),
  ]);
  const empresaIdSelecionada =
    typeof empresaParam === "string" ? empresaParam : undefined;
  const empresasEnterprise =
    sessao.role === "admin" ? await listarEmpresasEnterprise() : [];
  const empresasEnterpriseIds = new Set(empresasEnterprise.map((empresa) => empresa.id));
  const empresaSelecionadaEnterprise =
    empresaIdSelecionada && empresasEnterpriseIds.has(empresaIdSelecionada)
      ? empresaIdSelecionada
      : undefined;
  const empresaSelecionadaInvalida =
    sessao.role === "admin" && Boolean(empresaIdSelecionada) && !empresaSelecionadaEnterprise;
  const empresaId =
    sessao.role === "admin" ? empresaSelecionadaEnterprise : sessao.empresaId;
  const [todosRegistros, agora, solicitacoes] = await Promise.all([
    getReunioes(empresaId),
    getAgora(),
    empresaSelecionadaInvalida ? [] : listarSolicitacoesReuniao(empresaId),
  ]);
  const registros = empresaSelecionadaInvalida
    ? []
    : sessao.role === "admin" && !empresaId
    ? todosRegistros.filter((registro) =>
        registro.empresaId ? empresasEnterpriseIds.has(registro.empresaId) : false,
      )
    : todosRegistros;

  const reunioes = registros.filter((r) => r.tipo === "reuniao");
  const treinamentos = registros.filter((r) => r.tipo === "treinamento");
  const comGravacao = registros.filter((r) => r.gravacaoUrl !== null);
  const proximaReuniao = registros
    .filter((registro) => new Date(registro.data).getTime() > agora)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0];

  return (
    <>
      <CabecalhoPagina
        titulo="Reuniões e treinamentos"
        descricao="Histórico de encontros, atas e materiais de apoio"
        acao={
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <SeletorEmpresaAdmin
              className="w-full sm:w-72"
              empresas={empresasEnterprise}
              placeholder="Selecione uma empresa Enterprise"
            />
            <DialogoReuniao
              empresas={empresasEnterprise}
              empresaIdAtual={empresaId}
              admin={sessao.role === "admin"}
            />
          </div>
        }
      />

      {sessao.role === "admin" && solicitacoes.length ? (
        <section className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Solicitações de reunião</h2>
              <div className="mt-2 divide-y divide-warning/20">
                {solicitacoes.map((solicitacao) => (
                  <article key={solicitacao.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{solicitacao.empresaNome}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{solicitacao.descricao}</p>
                    </div>
                    <form action={aceitarSolicitacaoReuniao.bind(null, solicitacao.id)}>
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 px-2.5 py-1.5 text-xs font-medium hover:bg-warning/10">
                        <Check className="size-3.5" aria-hidden />
                        Aceitar e agendar
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {proximaReuniao ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand-soft px-4 py-3">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-brand">Próxima reunião agendada</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {proximaReuniao.titulo} · {formatarDataHora(proximaReuniao.data)}
              </p>
            </div>
          </div>
          <Badge tom="marca">{proximaReuniao.tipo === "treinamento" ? "Treinamento" : "Reunião"}</Badge>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Reuniões"
          valor={String(reunioes.length)}
          icone={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Solicitações"
          valor={String(solicitacoes.length)}
          tom={solicitacoes.length ? "atencao" : "neutro"}
          icone={<BellRing className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Treinamentos"
          valor={String(treinamentos.length)}
          icone={<GraduationCap className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Com gravação"
          valor={String(comGravacao.length)}
          icone={<Video className="size-4" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Agenda e histórico"
          descricao="Do encontro mais recente para o mais antigo"
        />
        <CardBody>
          {registros.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reunião registrada.
            </p>
          ) : (
            <ol className="space-y-5">
              {registros.map((registro) => {
                const Icone = registro.tipo === "treinamento" ? GraduationCap : Users;
                return (
                  <li key={registro.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <Icone className="size-4" aria-hidden />
                      </span>
                      <span
                        aria-hidden
                        className="mt-1 w-px flex-1 bg-border last:hidden"
                      />
                    </div>
                    <article className="min-w-0 flex-1 pb-1">
                      <header className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium">{registro.titulo}</h3>
                        {registro.empresaNome ? (
                          <Badge tom="neutro">{registro.empresaNome}</Badge>
                        ) : null}
                        <Badge tom={registro.tipo === "treinamento" ? "marca" : "neutro"}>
                          {registro.tipo === "treinamento" ? "Treinamento" : "Reunião"}
                        </Badge>
                        {registro.gravacaoUrl ? (
                          <Badge tom="neutro">
                            <Video className="size-3" aria-hidden />
                            Gravação disponível
                          </Badge>
                        ) : null}
                      </header>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatarDataHora(registro.data)} · {registro.participantes}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">
                        {registro.ata || "Sem pauta ou ata registrada."}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </>
  );
}

async function listarEmpresasEnterprise() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assinaturas")
    .select("empresa:empresas(id, nome_fantasia, razao_social), plano:planos(nome, ordem)");

  return (data ?? []).flatMap((assinatura) => {
    const plano = normalizarJoin<{ nome: string; ordem: number }>(assinatura.plano ?? null);
    const empresa = normalizarJoin<{
      id: string;
      nome_fantasia: string | null;
      razao_social: string | null;
    }>(assinatura.empresa ?? null);

    if (!empresa || nivelDoPlano(plano) !== "enterprise") return [];
    return [empresa];
  }).sort((a, b) =>
    (a.razao_social ?? a.nome_fantasia ?? "").localeCompare(
      b.razao_social ?? b.nome_fantasia ?? "",
    ),
  );
}

async function listarSolicitacoesReuniao(empresaId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("alertas")
    .select("id, descricao, empresa:empresas(nome_fantasia, razao_social)")
    .eq("tipo", "solicitacao_reuniao")
    .eq("resolvido", false)
    .order("created_at", { ascending: false });

  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;

  if (error) return [];
  return (data ?? []).map((solicitacao) => {
    const empresa = normalizarJoin<{
      nome_fantasia: string | null;
      razao_social: string | null;
    }>(solicitacao.empresa ?? null);
    return {
      id: solicitacao.id,
      descricao: solicitacao.descricao ?? "Solicitação sem detalhes.",
      empresaNome: empresa?.nome_fantasia || empresa?.razao_social || "Empresa",
    };
  });
}

function normalizarJoin<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? valor[0] ?? null : valor;
}

async function getAgora() {
  return Date.now();
}
