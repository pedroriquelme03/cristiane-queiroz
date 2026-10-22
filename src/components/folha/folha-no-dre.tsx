"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { LancamentoFolhaDre, UnidadeFolha } from "@/lib/dados-folha";
import { NATUREZAS_DRE, ROTULO_TIPO_CUSTO } from "@/lib/folha-analitica";
import { competenciaExtenso, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

type Agrupamento = "tipo" | "natureza" | "unidade" | "setor" | "centro";

const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = {
  tipo: "Tipo de custo",
  natureza: "Natureza da despesa",
  unidade: "Unidade",
  setor: "Setor",
  centro: "Centro de custo",
};

/**
 * Custo da folha apurado (gravado no fechamento) ao lado do realizado do DRE.
 * É conciliação: o DRE continua somando só os lançamentos financeiros, então
 * a folha não entra duas vezes no resultado.
 */
export function FolhaNoDre({
  competencia,
  fechada,
  importada,
  lancamentos,
  unidades,
  contas,
  hrefFolha,
}: {
  competencia: string;
  fechada: boolean;
  importada: boolean;
  lancamentos: LancamentoFolhaDre[];
  unidades: UnidadeFolha[];
  /** Realizado do DRE por conta do plano. */
  contas: { id: string; codigo: string; nome: string; realizado: number; despesaPessoal: boolean }[];
  hrefFolha: string;
}) {
  const [agrupar, setAgrupar] = useState<Agrupamento>("tipo");
  const grupos = useMemo(() => {
    const rotuloNatureza = new Map(NATUREZAS_DRE.map((n) => [n.chave, n.rotulo]));
    const nomeUnidade = (id: string | null) => unidades.find((u) => u.id === id)?.nome ?? "Sem unidade";
    const chave = (l: LancamentoFolhaDre) =>
      agrupar === "tipo"
        ? ROTULO_TIPO_CUSTO[l.tipo]
        : agrupar === "natureza"
          ? rotuloNatureza.get(l.natureza) ?? l.natureza
          : agrupar === "unidade"
            ? nomeUnidade(l.unidadeId)
            : agrupar === "setor"
              ? l.setor
              : l.centroCusto
                ? `CC ${l.centroCusto}`
                : "Sem centro de custo";
    const m = new Map<string, number>();
    for (const l of lancamentos) m.set(chave(l), (m.get(chave(l)) ?? 0) + l.valor);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lancamentos, agrupar, unidades]);

  const total = lancamentos.reduce((s, l) => s + l.valor, 0);

  // Conciliação por conta vinculada: folha × realizado no DRE (despesa sai negativa no DRE)
  const conciliacao = useMemo(() => {
    const porConta = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.planoContaId) porConta.set(l.planoContaId, (porConta.get(l.planoContaId) ?? 0) + l.valor);
    }
    return [...porConta.entries()].map(([id, folha]) => {
      const conta = contas.find((c) => c.id === id);
      const dre = Math.abs(conta?.realizado ?? 0);
      return { id, rotulo: conta ? `${conta.codigo} · ${conta.nome}` : "Conta removida", folha, dre, diferenca: dre - folha };
    });
  }, [lancamentos, contas]);
  const semConta = lancamentos.filter((l) => !l.planoContaId).reduce((s, l) => s + l.valor, 0);
  const despesaPessoalDre = Math.abs(contas.filter((c) => c.despesaPessoal).reduce((s, c) => s + c.realizado, 0));

  if (!importada) return null;

  return (
    <Card>
      <CardHeader
        titulo={`Folha de pagamento apurada — ${competenciaExtenso(competencia)}`}
        descricao="Custo da Apuração da Folha (pagos, encargos e provisões), para conciliar com o realizado. Não é somado ao resultado do DRE, que vem dos lançamentos financeiros."
        acao={
          <Link href={hrefFolha} className="text-xs font-medium text-brand">
            Abrir apuração →
          </Link>
        }
      />
      {!fechada ? (
        <CardBody className="text-sm text-muted-foreground">
          A competência tem relatórios importados, mas ainda não foi fechada. Conclua a conferência e feche a competência
          na Apuração da Folha para disponibilizar os valores aqui.
        </CardBody>
      ) : (
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Agrupar por
              <select
                value={agrupar}
                onChange={(e) => setAgrupar(e.target.value as Agrupamento)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
              >
                {(Object.keys(ROTULO_AGRUPAMENTO) as Agrupamento[]).map((a) => (
                  <option key={a} value={a}>
                    {ROTULO_AGRUPAMENTO[a]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm">
              Custo total da folha: <strong className="tabular">{moeda(total)}</strong>
            </p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              {grupos.map(([rotulo, valor]) => (
                <tr key={rotulo} className="border-b border-border last:border-0">
                  <td className="py-1.5">{rotulo}</td>
                  <td className={cn("py-1.5 text-right tabular", valor < 0 && "text-negative")}>{moeda(valor)}</td>
                  <td className="w-20 py-1.5 text-right text-xs text-muted-foreground tabular">
                    {total ? `${((valor / total) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Conciliação</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Conta</th>
                  <th className="py-1.5 text-right font-medium">Folha</th>
                  <th className="py-1.5 text-right font-medium">Realizado DRE</th>
                  <th className="py-1.5 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {conciliacao.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="py-1.5">{c.rotulo}</td>
                    <td className="py-1.5 text-right tabular">{moeda(c.folha)}</td>
                    <td className="py-1.5 text-right tabular">{moeda(c.dre)}</td>
                    <td className={cn("py-1.5 text-right tabular", Math.abs(c.diferenca) > 0.05 && "text-warning")}>
                      {moeda(c.diferenca)}
                    </td>
                  </tr>
                ))}
                {semConta ? (
                  <tr className="border-b border-border text-muted-foreground">
                    <td className="py-1.5">Naturezas sem conta vinculada</td>
                    <td className="py-1.5 text-right tabular">{moeda(semConta)}</td>
                    <td colSpan={2} className="py-1.5 text-right text-xs">
                      vincule em Apuração da Folha → Configurações → Integração DRE
                    </td>
                  </tr>
                ) : null}
                <tr className="bg-surface-muted font-semibold">
                  <td className="px-1 py-1.5">Total folha × Despesas com pessoal no DRE</td>
                  <td className="py-1.5 text-right tabular">{moeda(total)}</td>
                  <td className="py-1.5 text-right tabular">{moeda(despesaPessoalDre)}</td>
                  <td className="py-1.5 text-right tabular">{moeda(despesaPessoalDre - total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
