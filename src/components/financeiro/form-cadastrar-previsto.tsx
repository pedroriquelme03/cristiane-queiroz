"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { opcoesSelectClassificacao, ROTULO_TIPO_CONTA } from "@/lib/plano-contas-padrao";
import type { PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO: EstadoFormulario = {};

type LinhaGrade = {
  planoContaId: string;
  codigo: string;
  conta: string;
  tipo: PlanoConta["tipo"];
  orcamento: OrcamentoLinha | null;
};

/** Cadastro e edição de valores orçados por cliente (empresa), mês e classificação. */
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
  const [contaNovaId, setContaNovaId] = useState<string | null>(null);
  const mesPadrao = competencia.slice(0, 7);
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  useEffect(() => {
    if (estado.ok) {
      setEditando(null);
      setContaNovaId(null);
    }
  }, [estado.ok]);

  const porConta = useMemo(() => {
    const mapa = new Map<string, OrcamentoLinha>();
    for (const item of orcamentos) mapa.set(item.planoContaId, item);
    return mapa;
  }, [orcamentos]);

  const grade: LinhaGrade[] = useMemo(
    () =>
      [...contas]
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
        .map((conta) => ({
          planoContaId: conta.id,
          codigo: conta.codigo,
          conta: conta.nome,
          tipo: conta.tipo,
          orcamento: porConta.get(conta.id) ?? null,
        })),
    [contas, porConta],
  );

  const cadastrados = grade.filter((linha) => linha.orcamento).length;

  const opcoesContas = opcoesSelectClassificacao(contas).map((opcao) => ({
    ...opcao,
    rotulo: opcao.detalhe ? `${opcao.detalhe} — ${opcao.rotulo}` : opcao.rotulo,
    detalhe: undefined,
  }));

  function iniciarCadastro(planoContaId: string) {
    setEditando(null);
    setContaNovaId(planoContaId);
  }

  function iniciarEdicao(item: OrcamentoLinha) {
    setContaNovaId(null);
    setEditando(item);
  }

  const chaveForm = editando?.id ?? (contaNovaId ? `nova-${contaNovaId}` : "novo");
  const planoPadrao =
    editando?.planoContaId ?? contaNovaId ?? contas[0]?.id ?? "";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_1fr]">
      <Card>
        <CardHeader
          titulo={editando ? "Editar orçado" : "Cadastrar orçado"}
          descricao="Valor previsto por classificação no mês do cliente selecionado. Upsert evita duplicar a mesma conta no período."
        />
        <CardBody>
          {!podeEditar || !empresaId ? (
            <p className="text-sm text-muted-foreground">
              {!empresaId
                ? "Selecione o cliente (empresa) no topo para cadastrar o orçamento."
                : "Seu perfil não pode alterar o orçamento."}
            </p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre as classificações em Cadastros → Classificações antes de informar o orçado.
            </p>
          ) : (
            <form action={acao} className="space-y-4" key={chaveForm}>
              <input type="hidden" name="empresaId" value={empresaId} />
              {estado.ok ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive"
                >
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Orçado salvo e persistido.
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
                rotulo="Período (mês) *"
                tipo="month"
                required
                defaultValue={String(
                  valor("competencia", editando?.competencia.slice(0, 7) ?? mesPadrao),
                )}
                erro={estado.campos?.competencia}
                dica="Lista e comparativos passam a usar este mês após salvar."
              />

              <CampoSelect
                id="planoContaId"
                name="planoContaId"
                rotulo="Categoria (classificação) *"
                required
                defaultValue={String(valor("planoContaId", planoPadrao))}
                opcoes={opcoesContas}
                erro={estado.campos?.planoContaId}
              />

              <CampoMoeda
                id="valor"
                name="valor"
                rotulo="Valor orçado *"
                defaultValue={
                  editando
                    ? Math.abs(editando.valorPrevisto)
                    : Number(valor("valor", "") || 0) || undefined
                }
                erro={estado.campos?.valor}
                dica="Informe o valor absoluto; o sinal na DRE segue o tipo da conta."
              />

              <div className="flex flex-wrap items-center gap-2">
                <BotaoSalvar editando={Boolean(editando)} />
                {editando || contaNovaId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(null);
                      setContaNovaId(null);
                    }}
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Orçado por categoria"
          descricao={`${cadastrados} de ${grade.length} classificação${grade.length === 1 ? "" : "ões"} com valor em ${competenciaExtenso(competencia)}`}
        />
        <CardBody className="px-0 py-0">
          {grade.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhuma classificação ativa para este cliente.
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">
                      Categoria
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">
                      Tipo
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Orçado
                    </th>
                    {podeEditar ? (
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">
                        Ações
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {grade.map((linha) => {
                    const item = linha.orcamento;
                    return (
                      <tr key={linha.planoContaId} className="border-b border-border last:border-0">
                        <td className="px-5 py-2.5">
                          <span className="tabular text-xs text-muted-foreground">
                            {linha.codigo}
                          </span>{" "}
                          {linha.conta}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {ROTULO_TIPO_CONTA[linha.tipo]}
                        </td>
                        <td
                          className={cn(
                            "tabular px-3 py-2.5 text-right font-medium",
                            item
                              ? item.valorPrevisto >= 0
                                ? "text-positive"
                                : "text-negative"
                              : "text-muted-foreground",
                          )}
                        >
                          {item ? moeda(item.valorPrevisto) : "—"}
                        </td>
                        {podeEditar && empresaId ? (
                          <td className="px-5 py-2.5">
                            <div className="flex items-center justify-end gap-3">
                              {item ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicao(item)}
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
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => iniciarCadastro(linha.planoContaId)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                                >
                                  <Plus className="size-3.5" aria-hidden />
                                  Informar
                                </button>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
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
      {pending ? "Salvando…" : editando ? "Atualizar orçado" : "Salvar orçado"}
    </button>
  );
}
