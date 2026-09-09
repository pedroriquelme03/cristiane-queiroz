"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirPrevistoForm,
  salvarPrevisto,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { OrcamentoLinha } from "@/lib/dados";
import { competenciaExtenso, moeda } from "@/lib/format";
import type { PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO: EstadoFormulario = {};

export function FormCadastrarPrevistos({
  empresaId,
  competencia,
  contas,
  orcamentos,
  podeEditar,
}: {
  empresaId?: string;
  competencia: string;
  contas: PlanoConta[];
  orcamentos: OrcamentoLinha[];
  podeEditar: boolean;
}) {
  const [estado, acao] = useActionState(salvarPrevisto, ESTADO);
  const [editando, setEditando] = useState<OrcamentoLinha | null>(null);
  const mesPadrao = competencia.slice(0, 7);
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  useEffect(() => {
    if (estado.ok) setEditando(null);
  }, [estado.ok]);

  const opcoesContas = contas.map((conta) => ({
    valor: conta.id,
    rotulo: `${conta.codigo} — ${conta.nome}`,
    detalhe: rotuloTipoConta(conta.tipo),
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_1fr]">
      <Card>
        <CardHeader
          titulo={editando ? "Editar previsto" : "Cadastrar previstos"}
          descricao="Valores orçados por conta para comparar com o realizado na DRE"
        />
        <CardBody>
          {!podeEditar || !empresaId ? (
            <p className="text-sm text-muted-foreground">
              {!empresaId
                ? "Selecione uma empresa no topo para cadastrar previstos."
                : "Seu perfil não pode alterar o orçamento."}
            </p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre o plano de contas antes de informar os previstos.
            </p>
          ) : (
            <form action={acao} className="space-y-4" key={editando?.id ?? "novo"}>
              <input type="hidden" name="empresaId" value={empresaId} />
              {estado.ok ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Previsto salvo.
                </p>
              ) : null}
              {estado.erro ? (
                <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
                  {estado.erro}
                </p>
              ) : null}

              <CampoTexto
                id="competencia"
                name="competencia"
                rotulo="Mês *"
                tipo="month"
                required
                defaultValue={String(valor("competencia", editando?.competencia.slice(0, 7) ?? mesPadrao))}
                erro={estado.campos?.competencia}
                dica="O previsto vale para todo o mês selecionado."
              />

              <CampoSelect
                id="planoContaId"
                name="planoContaId"
                rotulo="Conta *"
                required
                defaultValue={String(valor("planoContaId", editando?.planoContaId ?? contas[0]?.id ?? ""))}
                opcoes={opcoesContas}
                erro={estado.campos?.planoContaId}
              />

              <CampoMoeda
                id="valor"
                name="valor"
                rotulo="Valor previsto *"
                defaultValue={
                  editando
                    ? Math.abs(editando.valorPrevisto)
                    : Number(valor("valor", "") || 0) || undefined
                }
                erro={estado.campos?.valor}
              />

              <div className="flex flex-wrap items-center gap-2">
                <BotaoSalvar editando={Boolean(editando)} />
                {editando ? (
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Previstos do mês"
          descricao={`${orcamentos.length} conta${orcamentos.length === 1 ? "" : "s"} em ${competenciaExtenso(competencia)}`}
        />
        <CardBody className="px-0 py-0">
          {orcamentos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum previsto cadastrado para este mês.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Conta</th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">Tipo</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Valor previsto</th>
                    {podeEditar ? (
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Ações</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {orcamentos.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="tabular text-xs text-muted-foreground">{item.codigo}</span>{" "}
                        {item.conta}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {rotuloTipoConta(item.tipo)}
                      </td>
                      <td
                        className={cn(
                          "tabular px-3 py-2.5 text-right font-medium",
                          item.valorPrevisto >= 0 ? "text-positive" : "text-negative",
                        )}
                      >
                        {moeda(item.valorPrevisto)}
                      </td>
                      {podeEditar && empresaId ? (
                        <td className="px-5 py-2.5">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setEditando(item)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3.5" aria-hidden />
                              Editar
                            </button>
                            <form action={excluirPrevistoForm}>
                              <input type="hidden" name="empresaId" value={empresaId} />
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-negative"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                Excluir
                              </button>
                            </form>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BotaoSalvar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
    >
      <Plus className="size-4" aria-hidden />
      {pending ? "Salvando…" : editando ? "Atualizar previsto" : "Cadastrar previsto"}
    </button>
  );
}

function rotuloTipoConta(tipo: PlanoConta["tipo"]) {
  switch (tipo) {
    case "receita":
      return "Receita";
    case "deducao":
      return "Dedução";
    case "custo":
      return "Custo";
    case "despesa":
      return "Despesa";
    case "investimento":
      return "Investimento";
    case "nao_operacional":
      return "Não operacional";
    default:
      return tipo;
  }
}
