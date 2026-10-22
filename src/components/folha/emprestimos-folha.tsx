"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { salvarContratoEmprestimo } from "@/app/(app)/financeiro/folha/acoes";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ContratoEmprestimo, UnidadeFolha } from "@/lib/dados-folha";
import type { ItemEmprestimo } from "@/lib/folha-analitica";
import { competenciaExtenso, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EmprestimosFolha({
  itens,
  contratos,
  unidades,
  competencia,
  empresaId,
  podeEditar,
  semIndividuais,
}: {
  itens: ItemEmprestimo[];
  contratos: ContratoEmprestimo[];
  unidades: UnidadeFolha[];
  competencia: string;
  empresaId: string;
  podeEditar: boolean;
  semIndividuais: boolean;
}) {
  const nomeUnidade = (id: string | null) => unidades.find((u) => u.id === id)?.nome ?? "—";
  const porContrato = new Map(contratos.map((c) => [c.contrato, c]));

  const porTipo = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number }>();
    for (const i of itens) {
      const t = m.get(i.tipo) ?? { qtd: 0, valor: 0 };
      t.qtd += 1;
      t.valor += i.valor;
      m.set(i.tipo, t);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  }, [itens]);
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titulo={`Empréstimos e adiantamentos — ${competenciaExtenso(competencia)}`}
          descricao="Descontos de empréstimos (consignado/Crédito do Trabalhador), descontos autorizados e adiantamentos identificados nas rubricas. São retenções do funcionário: não entram no custo da folha. Estornos de provisão aparecem negativos, para o total refletir só o desconto efetivo."
        />
        <CardBody className="px-0 py-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Lançamentos</th>
                <th className="px-5 py-2 text-right font-medium">Valor descontado</th>
              </tr>
            </thead>
            <tbody>
              {porTipo.map(([tipo, t]) => (
                <tr key={tipo} className="border-b border-border">
                  <td className="px-5 py-1.5">{tipo}</td>
                  <td className="px-3 py-1.5 text-right tabular">{t.qtd}</td>
                  <td className={cn("px-5 py-1.5 text-right tabular", t.valor < 0 && "text-negative")}>{moeda(t.valor)}</td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-semibold">
                <td className="px-5 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular">{itens.length}</td>
                <td className="px-5 py-2 text-right tabular">{moeda(total)}</td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>

      {semIndividuais ? null : (
        <Card>
          <CardHeader
            titulo="Por colaborador"
            descricao="Instituição financeira e valor liberado não vêm no relatório da folha: informe por contrato quando tiver o dado."
          />
          <CardBody className="px-0 py-0">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
                    {["Unidade", "Colaborador", "Tipo", "Rubrica", "Contrato", "Instituição", "Valor liberado", "Descontado"].map(
                      (c, i) => (
                        <th key={c} className={cn("px-3 py-2 font-semibold first:pl-5 last:pr-5", i >= 6 ? "text-right" : "text-left")}>
                          {c}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, k) => (
                    <tr key={`${i.funcionarioId}-${i.rubrica}-${k}`} className="border-b border-border">
                      <td className="py-1.5 pr-3 pl-5 whitespace-nowrap text-muted-foreground">{nomeUnidade(i.unidadeId)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="text-muted-foreground tabular">{i.matricula}</span> {i.nome}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{i.tipo}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground" title={i.descricao}>
                        {i.rubrica}
                      </td>
                      <td className="px-3 py-1.5 tabular whitespace-nowrap">{i.contrato ?? "—"}</td>
                      {i.contrato ? (
                        <DadosContrato
                          key={i.contrato}
                          contrato={i.contrato}
                          atual={porContrato.get(i.contrato)}
                          empresaId={empresaId}
                          podeEditar={podeEditar}
                        />
                      ) : (
                        <>
                          <td className="px-3 py-1.5 text-muted-foreground">—</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                        </>
                      )}
                      <td className={cn("py-1.5 pr-5 pl-3 text-right tabular", i.valor < 0 && "text-negative")}>
                        {moeda(i.valor)}
                      </td>
                    </tr>
                  ))}
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Nenhum empréstimo ou adiantamento no filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DadosContrato({
  contrato,
  atual,
  empresaId,
  podeEditar,
}: {
  contrato: string;
  atual: ContratoEmprestimo | undefined;
  empresaId: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [instituicao, setInstituicao] = useState(atual?.instituicao ?? "");
  const [liberado, setLiberado] = useState(
    atual?.valorLiberado == null
      ? ""
      : atual.valorLiberado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);

  if (!podeEditar) {
    return (
      <>
        <td className="px-3 py-1.5">{atual?.instituicao ?? "—"}</td>
        <td className="px-3 py-1.5 text-right tabular">{atual?.valorLiberado == null ? "—" : moeda(atual.valorLiberado)}</td>
      </>
    );
  }

  const salvar = () => {
    const valor = liberado.trim() ? Number(liberado.replace(/\./g, "").replace(",", ".")) : null;
    const mudou =
      (instituicao.trim() || null) !== (atual?.instituicao ?? null) || valor !== (atual?.valorLiberado ?? null);
    if (!mudou || (valor !== null && !Number.isFinite(valor))) return;
    iniciar(async () => {
      const r = await salvarContratoEmprestimo(empresaId, {
        contrato,
        instituicao: instituicao.trim() || null,
        valorLiberado: valor,
      });
      setErro(!r.ok);
      if (r.ok) router.refresh();
    });
  };

  return (
    <>
      <td className="px-3 py-1">
        <input
          value={instituicao}
          onChange={(e) => setInstituicao(e.target.value)}
          onBlur={salvar}
          placeholder="Banco / financeira"
          aria-label={`Instituição do contrato ${contrato}`}
          className={cn(
            "w-36 rounded border border-border bg-surface px-1.5 py-0.5 text-xs",
            erro && "border-negative",
            pendente && "opacity-60",
          )}
        />
      </td>
      <td className="px-3 py-1 text-right">
        <input
          value={liberado}
          onChange={(e) => setLiberado(e.target.value)}
          onBlur={salvar}
          inputMode="decimal"
          placeholder="0,00"
          aria-label={`Valor liberado do contrato ${contrato}`}
          className={cn(
            "w-24 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-xs tabular",
            erro && "border-negative",
          )}
        />
      </td>
    </>
  );
}
