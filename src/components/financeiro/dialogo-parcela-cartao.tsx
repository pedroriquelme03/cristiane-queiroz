"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { salvarTitulo, type EstadoFormulario } from "@/app/(app)/financeiro/acoes";
import { Aviso, Rodape } from "@/components/financeiro/dialogo-lancamento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoMoeda } from "@/components/ui/campo-moeda";
import { Modal } from "@/components/ui/modal";
import type { PlanoConta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoFormulario = {};

const MESES = [
  { valor: "01", rotulo: "Janeiro" },
  { valor: "02", rotulo: "Fevereiro" },
  { valor: "03", rotulo: "Março" },
  { valor: "04", rotulo: "Abril" },
  { valor: "05", rotulo: "Maio" },
  { valor: "06", rotulo: "Junho" },
  { valor: "07", rotulo: "Julho" },
  { valor: "08", rotulo: "Agosto" },
  { valor: "09", rotulo: "Setembro" },
  { valor: "10", rotulo: "Outubro" },
  { valor: "11", rotulo: "Novembro" },
  { valor: "12", rotulo: "Dezembro" },
] as const;

function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function competenciaParaDatas(ano: string, mes: string) {
  const y = Number(ano);
  const m = Number(mes);
  const ultimo = ultimoDiaDoMes(y, m);
  const emissao = `${ano}-${mes}-01`;
  const vencimento = `${ano}-${mes}-${String(ultimo).padStart(2, "0")}`;
  return { emissao, vencimento };
}

export function DialogoParcelaCartao({
  contas,
  empresaId,
}: {
  contas: PlanoConta[];
  empresaId?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(salvarTitulo, ESTADO_INICIAL);
  const agora = new Date();
  const mesPadrao = String(agora.getMonth() + 1).padStart(2, "0");
  const anoPadrao = String(agora.getFullYear());
  const [mes, setMes] = useState(mesPadrao);
  const [ano, setAno] = useState(anoPadrao);

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(atual - 1 + i));
  }, []);

  const contasUteis = contas.filter((conta) =>
    ["despesa", "custo", "investimento", "deducao"].includes(conta.tipo),
  );
  const hrefPlano = empresaId
    ? `/cadastros/plano-de-contas?empresa=${empresaId}`
    : "/cadastros/plano-de-contas";

  const { emissao, vencimento } = competenciaParaDatas(ano, mes);
  const rotuloMes = MESES.find((item) => item.valor === mes)?.rotulo ?? mes;
  const documentoPadrao = `Cartão · ${rotuloMes}/${ano}`;

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
        <CreditCard className="size-3.5" aria-hidden />
        Parcela de cartão
      </button>

      <Modal
        aberto={aberto}
        titulo="Parcela de cartão"
        descricao="Informe o mês da fatura e o valor previsto daquele mês"
        onFechar={() => setAberto(false)}
      >
        <form action={acao} className="space-y-4">
          <Aviso estado={estado} textoSucesso="Parcela de cartão cadastrada." />
          <input type="hidden" name="tipo" value="pagar" />
          <input type="hidden" name="empresaId" value={empresaId ?? ""} />
          <input type="hidden" name="fixa" value="true" />
          <input type="hidden" name="mesesRecorrencia" value="1" />
          <input type="hidden" name="valorPago" value="0" />
          <input type="hidden" name="emissao" value={emissao} />
          <input type="hidden" name="vencimento" value={vencimento} />

          <CampoTexto
            id="cartao-contraparte"
            name="contraparte"
            rotulo="Cartão *"
            required
            placeholder="Ex.: Nubank, Itaú Mastercard"
            defaultValue={estado.valores?.contraparte}
            erro={estado.campos?.contraparte}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelect
              id="cartao-mes"
              rotulo="Mês *"
              required
              defaultValue={mes}
              onValueChange={setMes}
              opcoes={MESES.map((item) => ({ valor: item.valor, rotulo: item.rotulo }))}
            />
            <CampoSelect
              id="cartao-ano"
              rotulo="Ano *"
              required
              defaultValue={ano}
              onValueChange={setAno}
              opcoes={anos.map((item) => ({ valor: item, rotulo: item }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Competência {rotuloMes.toLowerCase()} de {ano} — vencimento previsto em{" "}
            {vencimento.split("-").reverse().join("/")}.
          </p>

          <CampoMoeda
            id="cartao-valor"
            name="valor"
            rotulo="Valor previsto *"
            required
            defaultValue={estado.valores?.valor}
            erro={estado.campos?.valor}
            dica="Valor estimado da fatura neste mês"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <CampoSelect
                id="cartao-plano"
                name="planoContaId"
                rotulo="Categoria"
                required
                opcoes={[
                  { valor: "", rotulo: "Selecione a classificação" },
                  ...contasUteis.map((conta) => ({
                    valor: conta.id,
                    rotulo: conta.nome,
                    detalhe: conta.codigo,
                  })),
                ]}
                pesquisavel
                defaultValue={estado.valores?.planoContaId ?? contasUteis[0]?.id}
                erro={estado.campos?.planoContaId}
              />
              {contasUteis.length === 0 ? (
                <p className="text-xs text-warning">
                  Nenhuma categoria cadastrada.{" "}
                  <Link href={hrefPlano} className="font-medium text-brand hover:underline">
                    Cadastrar em Cadastros → Classificações
                  </Link>
                  .
                </p>
              ) : null}
            </div>
            <CampoTexto
              key={`cartao-doc-${documentoPadrao}`}
              id="cartao-documento"
              name="documento"
              rotulo="Documento"
              defaultValue={estado.valores?.documento ?? documentoPadrao}
              erro={estado.campos?.documento}
            />
          </div>

          <Rodape onCancelar={() => setAberto(false)} texto="Salvar parcela" />
        </form>
      </Modal>
    </>
  );
}
