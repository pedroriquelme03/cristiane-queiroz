"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";

import {
  excluirTitulo,
  listarBaixasTitulo,
  registrarBaixaTitulo,
  salvarTitulo,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import { Aviso, CamposImpacto, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { Modal } from "@/components/ui/modal";
import { data as formatarData, moeda as formatarMoeda, documentoPessoa } from "@/lib/format";
import {
  opcoesSelectClassificacao,
  TIPOS_CLASSIFICACAO_PAGAR,
  TIPOS_CLASSIFICACAO_RECEBER,
} from "@/lib/plano-contas-padrao";
import type {
  BaixaTitulo,
  ClienteConsultoria,
  ContaBancaria,
  PlanoConta,
  Titulo,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

type ClienteConsultoriaOpcao = Pick<
  ClienteConsultoria,
  "nome" | "documento" | "valorMensal"
>;

export function DialogoTitulo({
  tipo,
  contas,
  empresaId,
  titulo,
  fixaPadrao = false,
  clientesConsultoria,
}: {
  tipo: Titulo["tipo"];
  contas: PlanoConta[];
  empresaId?: string;
  titulo?: Titulo;
  /** Abre o formulário já marcado como conta fixa. */
  fixaPadrao?: boolean;
  /** Clientes de consultoria (admin) — select no recebimento fixo. */
  clientesConsultoria?: ClienteConsultoriaOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarTitulo, ESTADO_INICIAL);
  const [contaFixa, setContaFixa] = useState(Boolean(titulo?.fixa) || Boolean(fixaPadrao));
  const clienteInicial = titulo?.contraparte ?? "";
  const [contraparteSelecionada, setContraparteSelecionada] = useState(clienteInicial);
  const [valorMensalCliente, setValorMensalCliente] = useState<number | undefined>(() => {
    const cliente = clientesConsultoria?.find((item) => item.nome === clienteInicial);
    return cliente?.valorMensal;
  });
  const [documentoCliente, setDocumentoCliente] = useState<string | undefined>(() => {
    const cliente = clientesConsultoria?.find((item) => item.nome === clienteInicial);
    return cliente?.documento;
  });
  const ehPagar = tipo === "pagar";
  const editando = Boolean(titulo);
  const usarSelectCliente =
    !ehPagar &&
    fixaPadrao &&
    Boolean(clientesConsultoria?.length);
  const sufixo = titulo?.id ?? `novo-${tipo}`;
  const valor = (campo: string, padrao?: string | number | null) =>
    estado.valores?.[campo] ?? padrao ?? "";
  const tiposUteis = ehPagar ? TIPOS_CLASSIFICACAO_PAGAR : TIPOS_CLASSIFICACAO_RECEBER;
  const contasUteis = contas.filter((conta) => tiposUteis.includes(conta.tipo));
  const hrefPlano = empresaId
    ? `/cadastros/plano-de-contas?empresa=${empresaId}`
    : "/cadastros/plano-de-contas";

  function aoSelecionarCliente(nome: string) {
    setContraparteSelecionada(nome);
    const cliente = clientesConsultoria?.find((item) => item.nome === nome);
    if (!cliente) return;
    setValorMensalCliente(cliente.valorMensal);
    setDocumentoCliente(cliente.documento);
  }

  const valorTituloPadrao = valor("valor", titulo?.valor ?? valorMensalCliente ?? "");
  const documentoTituloPadrao = valor(
    "documento",
    titulo?.documento ?? (documentoCliente ? documentoPessoa(documentoCliente) : undefined),
  );

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

          {usarSelectCliente ? (
            <CampoSelect
              id={`contraparte-${sufixo}`}
              name="contraparte"
              rotulo="Cliente"
              required
              pesquisavel
              defaultValue={contraparteSelecionada}
              onValueChange={aoSelecionarCliente}
              opcoes={(clientesConsultoria ?? []).map((cliente) => ({
                valor: cliente.nome,
                rotulo: cliente.nome,
                detalhe: documentoPessoa(cliente.documento),
              }))}
              erro={estado.campos?.contraparte}
              dica="Clientes cadastrados em Administração → Clientes → Consultoria"
            />
          ) : (
            <CampoTexto
              id={`contraparte-${sufixo}`}
              name="contraparte"
              rotulo={ehPagar ? "Fornecedor" : "Cliente"}
              required
              defaultValue={valor("contraparte", titulo?.contraparte)}
              erro={estado.campos?.contraparte}
            />
          )}

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
            key={`valor-titulo-${sufixo}-${String(valorTituloPadrao ?? "")}`}
            id={`valor-titulo-${sufixo}`}
            name="valor"
            rotulo="Valor total"
            required
            defaultValue={valorTituloPadrao}
            erro={estado.campos?.valor}
            dica={
              titulo?.valorPago
                ? `Já baixado: ${formatarMoeda(titulo.valorPago)}`
                : usarSelectCliente
                  ? "Preenchido com o valor mensal do cliente; ajuste se necessário."
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
                required
                opcoes={opcoesSelectClassificacao(contasUteis, {
                  placeholder: "Selecione a classificação",
                  tipos: tiposUteis,
                })}
                pesquisavel
                defaultValue={valor("planoContaId", titulo?.planoContaId ?? contasUteis[0]?.id)}
                erro={estado.campos?.planoContaId}
                dica={
                  contasUteis.length === 0
                    ? undefined
                    : ehPagar
                      ? "Vem de Cadastros → Classificações (despesas, custos e investimentos)"
                      : "Vem de Cadastros → Classificações (contas do tipo receita)"
                }
              />
              {contasUteis.length === 0 ? (
                <p className="text-xs text-warning">
                  Nenhuma classificação de {ehPagar ? "despesa" : "receita"} cadastrada.{" "}
                  <Link href={hrefPlano} className="font-medium text-brand hover:underline">
                    Cadastrar em Cadastros → Classificações
                  </Link>
                  {" "}ou use o botão Nova classificação nesta tela.
                </p>
              ) : null}
            </div>
            <CampoTexto
              key={`documento-titulo-${sufixo}-${documentoTituloPadrao ?? ""}`}
              id={`documento-titulo-${sufixo}`}
              name="documento"
              rotulo="Documento"
              placeholder="Opcional"
              defaultValue={documentoTituloPadrao}
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

          <CamposImpacto
            sufixo={sufixo}
            impactaDrePadrao={
              estado.valores?.impactaDre !== undefined
                ? estado.valores.impactaDre === "on" || estado.valores.impactaDre === "true"
                : (titulo?.impactaDre ?? true)
            }
            impactaFluxoPadrao={
              estado.valores?.impactaFluxo !== undefined
                ? estado.valores.impactaFluxo === "on" || estado.valores.impactaFluxo === "true"
                : (titulo?.impactaFluxo ?? true)
            }
            erro={estado.campos?.impactaDre}
            dicaDre="Competência pela emissão (o pagamento/baixa vai só ao fluxo)"
            dicaFluxo="Saldo em aberto entra pelo vencimento"
          />

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
  contasBancarias = [],
}: {
  titulo: Titulo;
  empresaId: string;
  contasBancarias?: ContaBancaria[];
}) {
  const [aberto, setAberto] = useState(false);
  const [sessaoFormulario, setSessaoFormulario] = useState("");
  const verbo = titulo.tipo === "pagar" ? "pagamento" : "recebimento";

  function abrir() {
    setSessaoFormulario(crypto.randomUUID());
    setAberto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1 text-xs font-medium text-brand hover:text-foreground"
      >
        <Banknote className="size-3.5" aria-hidden />
        Registrar baixa
      </button>
      <Modal
        aberto={aberto}
        titulo={`Registrar ${verbo}`}
        descricao={`${titulo.contraparte}${titulo.documento ? ` · ${titulo.documento}` : ""}`}
        onFechar={() => setAberto(false)}
      >
        {aberto && sessaoFormulario ? (
          <FormularioBaixaTitulo
            key={sessaoFormulario}
            titulo={titulo}
            empresaId={empresaId}
            contasBancarias={contasBancarias}
            idempotencyKey={sessaoFormulario}
            onConcluido={() => setAberto(false)}
            onCancelar={() => setAberto(false)}
          />
        ) : null}
      </Modal>
    </>
  );
}

function FormularioBaixaTitulo({
  titulo,
  empresaId,
  contasBancarias,
  idempotencyKey,
  onConcluido,
  onCancelar,
}: {
  titulo: Titulo;
  empresaId: string;
  contasBancarias: ContaBancaria[];
  idempotencyKey: string;
  onConcluido: () => void;
  onCancelar: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const [estado, acao] = useActionState(registrarBaixaTitulo, ESTADO_INICIAL);
  const [historico, setHistorico] = useState<BaixaTitulo[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [, startTransition] = useTransition();
  const enviandoRef = useRef(false);
  const saldo = Math.round((titulo.valor - titulo.valorPago) * 100) / 100;
  const hoje = new Date().toISOString().slice(0, 10);
  const verbo = titulo.tipo === "pagar" ? "pagamento" : "recebimento";
  const rotuloPago = titulo.tipo === "pagar" ? "Total pago" : "Total recebido";

  useEffect(() => {
    let cancelado = false;
    void listarBaixasTitulo(titulo.id, empresaId).then((itens) => {
      if (!cancelado) {
        setHistorico(itens);
        setCarregandoHistorico(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [titulo.id, empresaId]);

  useEffect(() => {
    if (estado.erro || estado.campos) enviandoRef.current = false;
  }, [estado.erro, estado.campos]);

  useEffect(() => {
    if (!estado.ok) return;
    enviandoRef.current = false;
    onConcluido();
    startTransition(() => {
      router.refresh();
    });
  }, [estado.ok, onConcluido, router]);

  return (
    <form
      id={formId}
      action={acao}
      className="space-y-4"
      onSubmit={(evento) => {
        if (enviandoRef.current) {
          evento.preventDefault();
          return;
        }
        enviandoRef.current = true;
      }}
    >
      <Aviso estado={estado} textoSucesso="Baixa registrada e fluxo de caixa atualizado." />
      <input type="hidden" name="id" value={titulo.id} />
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Valor original</dt>
          <dd className="tabular font-medium">{formatarMoeda(titulo.valor)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{rotuloPago}</dt>
          <dd className="tabular font-medium">{formatarMoeda(titulo.valorPago)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo em aberto</dt>
          <dd className="tabular font-medium text-brand">{formatarMoeda(saldo)}</dd>
        </div>
      </dl>

      {carregandoHistorico ? (
        <p className="text-xs text-muted-foreground">Carregando histórico…</p>
      ) : historico.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Histórico de baixas</p>
          <ul className="max-h-28 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {historico.map((baixa) => (
              <li key={baixa.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="tabular text-muted-foreground">{formatarData(baixa.data)}</span>
                <span className="tabular font-medium">{formatarMoeda(baixa.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contasBancarias.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          Cadastre uma conta bancária ou caixa em{" "}
          <Link
            href={`/cadastros/contas-bancarias?empresa=${encodeURIComponent(empresaId)}`}
            className="font-medium text-brand hover:underline"
          >
            Cadastros → Contas bancárias
          </Link>{" "}
          para registrar a baixa.
        </p>
      ) : (
        <CampoSelect
          id={`conta-bancaria-${titulo.id}`}
          name="contaBancariaId"
          rotulo={titulo.tipo === "pagar" ? "Conta de saída *" : "Conta de entrada *"}
          required
          pesquisavel
          defaultValue={estado.valores?.contaBancariaId ?? contasBancarias[0]?.id ?? ""}
          opcoes={contasBancarias.map((conta) => ({
            valor: conta.id,
            rotulo: conta.nome,
            detalhe: formatarMoeda(conta.saldoAtual ?? conta.saldoInicial),
          }))}
          erro={estado.campos?.contaBancariaId}
          dica="A movimentação atualiza o saldo desta conta, sem alterar o saldo inicial."
        />
      )}

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
          rotulo={`Valor do ${verbo}`}
          required
          defaultValue={estado.valores?.valor ?? saldo}
          erro={estado.campos?.valor}
          dica={`Máximo: ${formatarMoeda(saldo)}. Pode ser parcial.`}
        />
      </div>
      <Rodape
        onCancelar={onCancelar}
        texto={`Confirmar ${verbo}`}
        desabilitado={contasBancarias.length === 0}
      />
    </form>
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
