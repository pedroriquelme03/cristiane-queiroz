"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, QrCode } from "lucide-react";

import { gerarCobranca, type EstadoCobranca } from "@/app/(app)/assinatura/acoes";
import { Modal } from "@/components/ui/modal";
import { moeda, data as formatarData } from "@/lib/format";
import type { Fatura } from "@/lib/types";

const ESTADO_INICIAL: EstadoCobranca = {};

export function PagarFatura({ fatura, destaque }: { fatura: Fatura; destaque?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(gerarCobranca, ESTADO_INICIAL);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          destaque
            ? "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
            : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
        }
      >
        Pagar
      </button>

      <Modal
        aberto={aberto}
        titulo="Pagar fatura"
        descricao={`${moeda(fatura.valor)} · vence ${formatarData(fatura.vencimento)}`}
        onFechar={() => setAberto(false)}
      >
        {!estado.ok ? (
          <form action={acao} className="space-y-4">
            <input type="hidden" name="faturaId" value={fatura.id} />
            <p className="text-sm text-muted-foreground">
              Gere o código PIX para pagar esta fatura no app do seu banco. A
              confirmação é automática assim que o pagamento cai.
            </p>
            <BotaoGerar />
          </form>
        ) : (
          <ResultadoPix estado={estado} />
        )}
      </Modal>
    </>
  );
}

function BotaoGerar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-40"
    >
      <QrCode className="size-4" aria-hidden />
      {pending ? "Gerando…" : "Gerar código PIX"}
    </button>
  );
}

function ResultadoPix({ estado }: { estado: EstadoCobranca }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!estado.pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(estado.pixCopiaCola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o usuário copia manualmente
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-muted p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          PIX copia e cola
        </p>
        <p className="tabular break-all font-mono text-xs">{estado.pixCopiaCola}</p>
        <button
          type="button"
          onClick={copiar}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
        >
          {copiado ? (
            <>
              <Check className="size-3.5" aria-hidden /> Copiado
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden /> Copiar código
            </>
          )}
        </button>
      </div>
      {estado.mensagem ? (
        <p className="text-xs text-muted-foreground">{estado.mensagem}</p>
      ) : null}
    </div>
  );
}
