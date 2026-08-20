"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirTitulo,
  registrarBaixaTitulo,
  salvarTitulo,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { Modal } from "@/components/ui/modal";
import { moeda as formatarMoeda } from "@/lib/format";
import type { PlanoConta, Titulo } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

export function DialogoTitulo({
  tipo,
  contas,
  empresaId,
  titulo,
  fixaPadrao = false,
}: {
  tipo: Titulo["tipo"];
  contas: PlanoConta[];
  empresaId?: string;
  titulo?: Titulo;
  /** Abre o formulário já marcado como conta fixa. */
  fixaPadrao?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarTitulo, ESTADO_INICIAL);
  const [contaFixa, setContaFixa] = useState(Boolean(titulo?.fixa) || Boolean(fixaPadrao));
  const ehPagar = tipo === "pagar";
  const editando = Boolean(titulo);
  const sufixo = titulo?.id ?? `novo-${tipo}`;
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";
  const contasUteis = contas.filter((conta) =>
    ehPagar
      ? ["despesa", "custo", "investimento", "deducao"].includes(conta.tipo)
      : ["receita"].includes(conta.tipo),
  );
  const hrefPlano = empresaId
    ? `/cadastros/plano-de-contas?empresa=${empresaId}`
    : "/cadastros/plano-de-contas";

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
            : fixaPadrao
              ? "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:border-brand/50"
              : "rounded-lg bg-brand px-3 py-1.5 text-xs text-brand-foreground",
        )}
      >
        {editando ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
        {editando
          ? "Editar"
          : fixaPadrao
            ? ehPagar
              ? "Nova conta fixa"
              : "Novo recebimento fixo"
            : ehPagar
              ? "Nova conta a pagar"
              : "Nova conta a receber"}
      </button>

      <Modal
        aberto={aberto}
        titulo={
          editando
            ? "Editar título"
            : fixaPadrao
              ? ehPagar
                ? "Nova conta fixa"
                : "Novo recebimento fixo"
              : ehPagar
                ? "Nova conta a pagar"
                : "Nova conta a receber"
        }
        descricao={
          fixaPadrao || contaFixa
            ? ehPagar
              ? "Despesa recorrente mensal — aluguel, energia, internet, etc."
              : "Receita recorrente mensal — mensalidade, contrato, aluguel recebido, etc."
            : "Obrigação ou direito com data de vencimento"
        }
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso
            estado={estado}
            textoSucesso={
              editando
                ? "Título atualizado."
                : contaFixa
                  ? ehPagar
                    ? "Conta fixa cadastrada e parcelas geradas."
                    : "Recebimento fixo cadastrado e parcelas geradas."
                  : "Título salvo."
            }
          />
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
            <CampoData
              id={`emissao-${sufixo}`}
              name="emissao"
              rotulo="Emissão"
              defaultValue={String(valor("emissao", titulo?.emissao) || "")}
              erro={estado.campos?.emissao}
            />
            <CampoData
              id={`vencimento-${sufixo}`}
              name="vencimento"
              rotulo={contaFixa ? "1º vencimento" : "Vencimento"}
              required
              defaultValue={String(valor("vencimento", titulo?.vencimento) || "")}
              erro={estado.campos?.vencimento}
            />
          </div>

          <CampoMoeda
            key={`valor-titulo-${sufixo}-${String(valor("valor", titulo?.valor))}`}
            id={`valor-titulo-${sufixo}`}
            name="valor"
            rotulo="Valor total"
            required
            defaultValue={valor("valor", titulo?.valor)}
            erro={estado.campos?.valor}
            dica={
              titulo?.valorPago
                ? `Já baixado: ${formatarMoeda(titulo.valorPago)}`
                : "Digite o valor; a formatação acompanha a moeda escolhida."
            }
          />
          <input type="hidden" name="valorPago" value="0" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <CampoSelect
                id={`plano-conta-titulo-${sufixo}`}
                name="planoContaId"
                rotulo="Classificação"
                opcoes={[
                  { valor: "", rotulo: "— sem classificação —" },
                  ...contasUteis.map((conta) => ({
                    valor: conta.id,
                    rotulo: conta.nome,
                    detalhe: conta.codigo,
                  })),
                ]}
                pesquisavel
                defaultValue={valor("planoContaId", titulo?.planoContaId)}
                erro={estado.campos?.planoContaId}
                dica={
                  contasUteis.length === 0
                    ? undefined
                    : ehPagar
                      ? "Contas de despesa, custo e investimento"
                      : "Contas de receita"
                }
              />
              {contasUteis.length === 0 ? (
                <p className="text-xs text-warning">
                  Nenhuma classificação cadastrada.{" "}
                  <Link href={hrefPlano} className="font-medium text-brand hover:underline">
                    Cadastrar no Plano de contas
                  </Link>
                  .
                </p>
              ) : null}
            </div>
            <CampoTexto
              id={`documento-titulo-${sufixo}`}
              name="documento"
              rotulo="Documento"
              placeholder="Opcional"
              defaultValue={valor("documento", titulo?.documento)}
              erro={estado.campos?.documento}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-muted/40 px-3 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="fixa"
                checked={contaFixa}
                onChange={(evento) => setContaFixa(evento.target.checked)}
                className="size-4 rounded border-border accent-brand"
              />
              {ehPagar
                ? "Conta fixa (recorrente mensal)"
                : "Recebimento fixo (recorrente mensal)"}
            </label>
            {contaFixa && !editando ? (
              <CampoSelect
                id={`meses-recorrencia-${sufixo}`}
                name="mesesRecorrencia"
                rotulo="Gerar parcelas"
                defaultValue={String(valor("mesesRecorrencia", "6"))}
                opcoes={[
                  { valor: "3", rotulo: "Próximos 3 meses" },
                  { valor: "6", rotulo: "Próximos 6 meses" },
                  { valor: "12", rotulo: "Próximos 12 meses" },
                ]}
                dica="Cria um título por mês a partir do 1º vencimento."
              />
            ) : null}
            {contaFixa && editando ? (
              <input type="hidden" name="mesesRecorrencia" value="1" />
            ) : null}
          </div>

          <Rodape
            onCancelar={() => setAberto(false)}
            texto={
              editando
                ? "Salvar alterações"
                : contaFixa
                  ? ehPagar
                    ? "Salvar conta fixa"
                    : "Salvar recebimento fixo"
                  : "Salvar título"
            }
          />
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
        descricao={`${titulo.contraparte} · saldo de ${formatarMoeda(saldo)}`}
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Baixa registrada e fluxo de caixa atualizado." />
          <input type="hidden" name="id" value={titulo.id} />
          <input type="hidden" name="empresaId" value={empresaId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoData
              id={`data-baixa-${titulo.id}`}
              name="data"
              rotulo="Data"
              required
              defaultValue={estado.valores?.data ?? hoje}
              erro={estado.campos?.data}
            />
            <CampoMoeda
              id={`valor-baixa-${titulo.id}`}
              name="valor"
              rotulo="Valor da baixa"
              required
              defaultValue={estado.valores?.valor ?? saldo}
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
