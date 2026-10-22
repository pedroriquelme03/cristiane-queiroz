"use client";

import { useState, useTransition } from "react";
import { GitCompare, History } from "lucide-react";

import { lerVersaoFolha, type FuncionarioVersao } from "@/app/(app)/financeiro/folha/acoes";
import { Badge, type TomBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { EventoFolha, UnidadeFolha, VersaoImportada } from "@/lib/dados-folha";
import type { FuncionarioAnalitico } from "@/lib/folha-analitica";
import { dataHora, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROTULO_EVENTO: Record<string, { rotulo: string; tom: TomBadge }> = {
  importacao: { rotulo: "Importação", tom: "marca" },
  rubrica: { rotulo: "Rubrica", tom: "atencao" },
  ajuste: { rotulo: "Ajuste manual", tom: "atencao" },
  cadastro: { rotulo: "Cadastro", tom: "neutro" },
  justificativa: { rotulo: "Justificativa", tom: "neutro" },
  fechamento: { rotulo: "Fechamento", tom: "positivo" },
  reabertura: { rotulo: "Reabertura", tom: "negativo" },
  exportacao: { rotulo: "Exportação", tom: "neutro" },
  acesso: { rotulo: "Acesso", tom: "neutro" },
};

/** Eventos que alteram dados depois da importação original. */
const ALTERACOES = new Set(["rubrica", "ajuste", "cadastro", "justificativa", "reabertura"]);

interface Diferenca {
  matricula: string;
  nome: string;
  situacao: "incluido" | "removido" | "alterado";
  antes?: FuncionarioVersao;
  depois?: FuncionarioVersao;
}

function comparar(versao: FuncionarioVersao[], atuais: FuncionarioAnalitico[]): Diferenca[] {
  const antes = new Map(versao.map((f) => [f.matricula, f]));
  const depois = new Map(
    atuais.map((f) => [
      f.matricula,
      { matricula: f.matricula, nome: f.nome, proventos: f.proventos, descontos: f.descontos, liquido: f.liquido },
    ]),
  );
  const cent = (v: number) => Math.round(v * 100);
  const difs: Diferenca[] = [];
  for (const [m, d] of depois) {
    const a = antes.get(m);
    if (!a) difs.push({ matricula: m, nome: d.nome, situacao: "incluido", depois: d });
    else if (cent(a.proventos) !== cent(d.proventos) || cent(a.descontos) !== cent(d.descontos) || cent(a.liquido) !== cent(d.liquido)) {
      difs.push({ matricula: m, nome: d.nome, situacao: "alterado", antes: a, depois: d });
    }
  }
  for (const [m, a] of antes) if (!depois.has(m)) difs.push({ matricula: m, nome: a.nome, situacao: "removido", antes: a });
  return difs.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
}

export function HistoricoFolha({
  empresaId,
  versoes,
  eventos,
  unidades,
  funcionariosAtuais,
}: {
  empresaId: string;
  versoes: VersaoImportada[];
  eventos: EventoFolha[];
  unidades: UnidadeFolha[];
  funcionariosAtuais: FuncionarioAnalitico[];
}) {
  const nomeUnidade = (id: string | null) => unidades.find((u) => u.id === id)?.nome ?? "Sem unidade";
  const [comparando, setComparando] = useState<{ versao: VersaoImportada; difs: Diferenca[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Primeira importação de cada unidade: o que vier depois dela é alteração posterior
  const primeiraImportacao = new Map<string, string>();
  for (const v of [...versoes].reverse()) {
    const k = v.unidadeId ?? "-";
    if (!primeiraImportacao.has(k)) primeiraImportacao.set(k, v.criadoEm);
  }
  const primeiraGeral = [...primeiraImportacao.values()].sort()[0];
  const versaoAtual = new Map<string, number>();
  for (const v of versoes) versaoAtual.set(v.unidadeId ?? "-", Math.max(versaoAtual.get(v.unidadeId ?? "-") ?? 0, v.versao));

  function abrirComparacao(v: VersaoImportada) {
    setErro(null);
    iniciar(async () => {
      const r = await lerVersaoFolha(empresaId, v.id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      const atuais = funcionariosAtuais.filter((f) => f.unidadeId === v.unidadeId);
      setComparando({ versao: v, difs: comparar(r.funcionarios, atuais) });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titulo="Versões importadas"
          descricao="Cada importação ou reimportação gera uma versão. Compare qualquer versão com os dados atuais."
          acao={<History className="size-4 text-muted-foreground" aria-hidden />}
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
                  {["Unidade", "Versão", "Arquivo", "CNPJ", "Funcionários", "Proventos", "Líquido", "Importado por", "Em", ""].map(
                    (c, i) => (
                      <th key={i} className={cn("px-3 py-2 font-semibold first:pl-5 last:pr-5", i >= 4 && i <= 6 ? "text-right" : "text-left")}>
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {versoes.map((v) => {
                  const atual = versaoAtual.get(v.unidadeId ?? "-") === v.versao;
                  return (
                    <tr key={v.id} className="border-b border-border">
                      <td className="py-1.5 pr-3 pl-5 whitespace-nowrap">{nomeUnidade(v.unidadeId)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        v{v.versao} {atual ? <Badge tom="positivo">atual</Badge> : null}
                      </td>
                      <td className="max-w-48 truncate px-3 py-1.5" title={v.arquivoNome}>
                        {v.arquivoNome}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular">{v.cnpj ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular">{v.qtdFuncionarios}</td>
                      <td className="px-3 py-1.5 text-right tabular">{moeda(v.totais.proventos)}</td>
                      <td className="px-3 py-1.5 text-right tabular">{moeda(v.totais.liquido)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{v.importadoPor}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{dataHora(v.criadoEm)}</td>
                      <td className="py-1.5 pr-5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => abrirComparacao(v)}
                          disabled={pendente}
                          className="flex items-center gap-1 text-xs font-medium text-brand disabled:opacity-50"
                        >
                          <GitCompare className="size-3.5" aria-hidden />
                          Comparar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {versoes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-6 text-center text-muted-foreground">
                      Nenhuma versão registrada nesta competência.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {erro ? <p className="px-5 py-2 text-xs text-negative">{erro}</p> : null}
        </CardBody>
      </Card>

      {comparando ? (
        <Card>
          <CardHeader
            titulo={`${nomeUnidade(comparando.versao.unidadeId)} — v${comparando.versao.versao} × dados atuais`}
            descricao={
              comparando.difs.length
                ? `${comparando.difs.length} funcionário(s) com diferença.`
                : "Nenhuma diferença de funcionários ou valores entre esta versão e a atual."
            }
            acao={
              <button type="button" onClick={() => setComparando(null)} className="text-xs text-muted-foreground">
                Fechar
              </button>
            }
          />
          {comparando.difs.length ? (
            <CardBody className="px-0 py-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
                    <th className="py-2 pr-3 pl-5 text-left font-semibold">Colaborador</th>
                    <th className="px-3 py-2 text-left font-semibold">Situação</th>
                    <th className="px-3 py-2 text-right font-semibold">Proventos (antes → agora)</th>
                    <th className="px-3 py-2 text-right font-semibold">Descontos</th>
                    <th className="py-2 pr-5 pl-3 text-right font-semibold">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {comparando.difs.map((d) => (
                    <tr key={d.matricula} className="border-b border-border">
                      <td className="py-1.5 pr-3 pl-5">
                        <span className="text-muted-foreground tabular">{d.matricula}</span> {d.nome}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge tom={d.situacao === "incluido" ? "positivo" : d.situacao === "removido" ? "negativo" : "atencao"}>
                          {d.situacao === "incluido" ? "incluído" : d.situacao === "removido" ? "removido" : "alterado"}
                        </Badge>
                      </td>
                      {(["proventos", "descontos", "liquido"] as const).map((k, i) => (
                        <td key={k} className={cn("px-3 py-1.5 text-right tabular whitespace-nowrap", i === 2 && "pr-5")}>
                          {d.antes ? moeda(d.antes[k]) : "—"} → {d.depois ? moeda(d.depois[k]) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Trilha de alterações"
          descricao="Importações, rubricas, ajustes manuais, justificativas, fechamento, reabertura e exportações. Alterações posteriores à importação original ficam marcadas."
        />
        <CardBody className="px-0 py-0">
          <ol className="divide-y divide-border">
            {eventos.map((e) => {
              const evento = ROTULO_EVENTO[e.tipo] ?? { rotulo: e.tipo, tom: "neutro" as TomBadge };
              const posterior = ALTERACOES.has(e.tipo) && primeiraGeral && e.criadoEm > primeiraGeral;
              return (
                <li key={e.id} className={cn("flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-2 text-xs", posterior && "bg-warning-soft/40")}>
                  <span className="w-32 shrink-0 text-muted-foreground tabular">{dataHora(e.criadoEm)}</span>
                  <Badge tom={evento.tom}>{evento.rotulo}</Badge>
                  <span className="min-w-0 flex-1">
                    {e.descricao}
                    {e.unidadeId ? <span className="text-muted-foreground"> · {nomeUnidade(e.unidadeId)}</span> : null}
                    {posterior ? <span className="ml-1.5 font-medium text-warning">alterado após a importação</span> : null}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{e.usuario}</span>
                </li>
              );
            })}
            {eventos.length === 0 ? (
              <li className="px-5 py-6 text-center text-xs text-muted-foreground">Nenhum evento registrado.</li>
            ) : null}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
