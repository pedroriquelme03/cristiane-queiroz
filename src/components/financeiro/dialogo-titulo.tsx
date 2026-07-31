"use client";

import { useActionState, useState } from "react";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirTitulo,
  registrarBaixaTitulo,
  salvarTitulo,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import type { PlanoConta, Titulo } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoTitulo({
  tipo,
  contas,
  empresaId,
  titulo,
}: {
  tipo: Titulo["tipo"];
  contas: PlanoConta[];
  empresaId?: string;
  titulo?: Titulo;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarTitulo, ESTADO_INICIAL);
  const ehPagar = tipo === "pagar";
  const editando = Boolean(titulo);
  const sufixo = titulo?.id ?? `novo-${tipo}`;
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!empresaId}
        title={!empresaId ? "Selecione uma empresa" : undefined}
        className={cn(
          "flex items-center gap-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40",
          editando
            ? "text-xs text-muted-foreground hover:text-foreground"
            : "rounded-lg bg-brand px-3 py-1.5 text-xs text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
        {editando ? "Editar" : ehPagar ? "Nova conta a pagar" : "Nova conta a receber"}
      </button>

      <Modal
        aberto={aberto}
        titulo={editando ? "Editar título" : ehPagar ? "Nova conta a pagar" : "Nova conta a receber"}
        descricao="Obrigação ou direito com data de vencimento"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso={editando ? "Título atualizado." : "Título salvo."} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          {titulo ? <input type="hidden" name="id" value={titulo.id} /> : null}

          <CampoTexto
            id={`contraparte-${sufixo}`}
            name="contraparte"
            rotulo={ehPagar ? "Fornecedor" : "Cliente"}
            required
            defaultValue={valor("contraparte", titulo?.contraparte)}
            erro={estado.campos?.contraparte}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id={`emissao-${sufixo}`}
              name="emissao"
              rotulo="Emissão"
              tipo="date"
              defaultValue={valor("emissao", titulo?.emissao)}
              erro={estado.campos?.emissao}
            />
            <CampoTexto
              id={`vencimento-${sufixo}`}
              name="vencimento"
              rotulo="Vencimento"
              tipo="date"
              required
              defaultValue={valor("vencimento", titulo?.vencimento)}
              erro={estado.campos?.vencimento}
            />
          </div>

          <CampoTexto
            id={`valor-titulo-${sufixo}`}
            name="valor"
            rotulo="Valor total"
            inputMode="decimal"
            placeholder="0,00"
            required
            defaultValue={valor("valor", titulo?.valor)}
            erro={estado.campos?.valor}
            dica={titulo?.valorPago ? `Já baixado: R$ ${titulo.valorPago.toFixed(2).replace(".", ",")}` : undefined}
          />
          <input type="hidden" name="valorPago" value="0" />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id={`plano-conta-titulo-${sufixo}`}
              name="planoContaId"
              rotulo="Classificação"
              opcoes={[
                { valor: "", rotulo: "— sem classificação —" },
                ...contas.map((conta) => ({
                  valor: conta.id,
                  rotulo: conta.nome,
                  detalhe: conta.codigo,
                })),
              ]}
              pesquisavel
              defaultValue={valor("planoContaId", titulo?.planoContaId)}
              erro={estado.campos?.planoContaId}
            />
            <CampoTexto
              id={`documento-titulo-${sufixo}`}
              name="documento"
              rotulo="Documento"
              placeholder="Opcional"
              defaultValue={valor("documento", titulo?.documento)}
              erro={estado.campos?.documento}
            />
          </div>

          <Rodape onCancelar={() => setAberto(false)} texto={editando ? "Salvar alterações" : "Salvar título"} />
        </form>
      </Modal>
    </>
  );
}

export function DialogoBaixaTitulo({
  titulo,
  empresaId,
}: {
  titulo: Titulo;
  empresaId: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(registrarBaixaTitulo, ESTADO_INICIAL);
  const saldo = titulo.valor - titulo.valorPago;
  const hoje = new Date().toISOString().slice(0, 10);
  const verbo = titulo.tipo === "pagar" ? "pagamento" : "recebimento";

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-foreground">
        <Banknote className="size-3.5" aria-hidden />
        Registrar baixa
      </button>
      <Modal
        aberto={aberto}
        titulo={`Registrar ${verbo}`}
        descricao={`${titulo.contraparte} · saldo de R$ ${saldo.toFixed(2).replace(".", ",")}`}
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Baixa registrada e fluxo de caixa atualizado." />
          <input type="hidden" name="id" value={titulo.id} />
          <input type="hidden" name="empresaId" value={empresaId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              id={`data-baixa-${titulo.id}`}
              name="data"
              rotulo="Data"
              tipo="date"
              max={hoje}
              required
              defaultValue={estado.valores?.data ?? hoje}
              erro={estado.campos?.data}
            />
            <CampoTexto
              id={`valor-baixa-${titulo.id}`}
              name="valor"
              rotulo="Valor da baixa"
              inputMode="decimal"
              required
              defaultValue={estado.valores?.valor ?? saldo.toFixed(2).replace(".", ",")}
              erro={estado.campos?.valor}
            />
          </div>
          <Rodape onCancelar={() => setAberto(false)} texto="Confirmar baixa" />
        </form>
      </Modal>
    </>
  );
}

export function ExcluirTitulo({ titulo, empresaId }: { titulo: Titulo; empresaId: string }) {
  const [estado, acao] = useActionState(excluirTitulo, ESTADO_INICIAL);
  return (
    <form
      action={acao}
      onSubmit={(event) => {
        if (!confirm(`Excluir o título de "${titulo.contraparte}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={titulo.id} />
      <input type="hidden" name="empresaId" value={empresaId} />
      <button type="submit" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative">
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      {estado.erro ? <p className="mt-1 max-w-48 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}
