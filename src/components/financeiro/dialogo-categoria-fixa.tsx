"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags } from "lucide-react";

import {
  atualizarCategoriaContaFixa,
  criarCategoriaRapida,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { PlanoConta, Titulo } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

/** Cadastro rápido de categoria (plano de contas) a partir de Contas fixas. */
export function DialogoNovaCategoria({
  empresaId,
  tipoPadrao = "despesa",
}: {
  empresaId?: string;
  tipoPadrao?: "despesa" | "receita";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(criarCategoriaRapida, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) {
      setAberto(false);
      router.refresh();
    }
  }, [estado, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!empresaId}
        title={!empresaId ? "Selecione uma empresa" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-brand/50",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        <Plus className="size-3.5" aria-hidden />
        Nova classificação
      </button>

      <Modal
        aberto={aberto}
        titulo="Nova classificação"
        descricao="Salva em Cadastros → Classificações e fica disponível no campo Classificação"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Classificação criada." />
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          <input type="hidden" name="tipo" value={tipoPadrao} />
          <CampoTexto
            id="categoria-nome"
            name="nome"
            rotulo="Nome *"
            required
            placeholder={tipoPadrao === "receita" ? "Ex.: Mensalidade" : "Ex.: Cartão, Aluguel"}
            defaultValue={estado.valores?.nome}
            erro={estado.campos?.nome}
          />
          <Rodape onCancelar={() => setAberto(false)} texto="Criar classificação" />
        </form>
      </Modal>
    </>
  );
}

/** Altera a categoria de todas as parcelas de uma conta fixa. */
export function DialogoEditarCategoriaFixa({
  grupo,
  contas,
  empresaId,
  tipo,
}: {
  grupo: { titulo: Titulo };
  contas: PlanoConta[];
  empresaId: string;
  tipo: Titulo["tipo"];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(atualizarCategoriaContaFixa, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok) {
      setAberto(false);
      router.refresh();
    }
  }, [estado, router]);

  const contasUteis = contas.filter((conta) =>
    tipo === "pagar"
      ? ["despesa", "custo", "investimento", "deducao"].includes(conta.tipo)
      : ["receita"].includes(conta.tipo),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Tags className="size-3.5" aria-hidden />
        Categoria
      </button>

      <Modal
        aberto={aberto}
        titulo="Editar categoria"
        descricao={`${grupo.titulo.contraparte} — aplica a todas as parcelas desta conta fixa`}
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Categoria atualizada." />
          <input type="hidden" name="empresaId" value={empresaId} />
          <input type="hidden" name="tituloId" value={grupo.titulo.id} />
          {grupo.titulo.grupoFixaId ? (
            <input type="hidden" name="grupoFixaId" value={grupo.titulo.grupoFixaId} />
          ) : null}
          <CampoSelect
            id={`categoria-fixa-${grupo.titulo.id}`}
            name="planoContaId"
            rotulo="Categoria"
            required
            pesquisavel
            defaultValue={grupo.titulo.planoContaId ?? contasUteis[0]?.id ?? ""}
            opcoes={[
              { valor: "", rotulo: "Selecione a classificação" },
              ...contasUteis.map((conta) => ({
                valor: conta.id,
                rotulo: conta.nome,
                detalhe: conta.codigo,
              })),
            ]}
            erro={estado.campos?.planoContaId}
          />
          <Rodape onCancelar={() => setAberto(false)} texto="Salvar categoria" />
        </form>
      </Modal>
    </>
  );
}

export function nomeCategoria(planoContaId: string | null, contas: PlanoConta[]): string {
  if (!planoContaId) return "—";
  return contas.find((conta) => conta.id === planoContaId)?.nome ?? "—";
}
