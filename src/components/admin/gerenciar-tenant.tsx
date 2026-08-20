"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, Lock, Settings2, Unlock } from "lucide-react";

import {
  alternarBloqueio,
  registrarPagamento,
  trocarPlano,
  type EstadoAdmin,
} from "@/app/(app)/admin/acoes";
import { BadgeStatusAssinatura, BadgeStatusFatura } from "@/components/assinatura/badge-status";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
import { Modal } from "@/components/ui/modal";
import { moeda, data as formatarData } from "@/lib/format";
import { precoNoCiclo } from "@/lib/assinatura";
import type { Fatura, Plano, TenantAssinatura } from "@/lib/types";

const ESTADO_INICIAL: EstadoAdmin = {};

export function GerenciarTenant({
  tenant,
  planos,
}: {
  tenant: TenantAssinatura;
  planos: Plano[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <Settings2 className="size-3.5" aria-hidden />
        Gerenciar
      </button>

      <Modal
        aberto={aberto}
        titulo={tenant.empresa.nomeFantasia}
        descricao={`${tenant.plano.nome} · ${tenant.assinatura.ciclo === "anual" ? "anual" : "mensal"}`}
        onFechar={() => setAberto(false)}
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Situação atual</span>
            <BadgeStatusAssinatura status={tenant.estado.status} />
          </div>

          <FaturasEmAberto faturas={tenant.faturas} />

          <SecaoPlano tenant={tenant} planos={planos} />

          <SecaoBloqueio tenant={tenant} />
        </div>
      </Modal>
    </>
  );
}

function FaturasEmAberto({ faturas }: { faturas: Fatura[] }) {
  const abertas = faturas.filter((f) => f.status === "aberta");
  if (abertas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhuma fatura em aberto.</p>
    );
  }
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Faturas em aberto</h3>
      <ul className="space-y-2">
        {abertas.map((f) => (
          <FaturaComPagamento key={f.id} fatura={f} />
        ))}
      </ul>
    </section>
  );
}

function FaturaComPagamento({ fatura }: { fatura: Fatura }) {
  const [registrando, setRegistrando] = useState(false);
  const [estado, acao] = useActionState(registrarPagamento, ESTADO_INICIAL);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <li className="rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium tabular">{moeda(fatura.valor)}</p>
          <p className="text-xs text-muted-foreground">
            Vence {formatarData(fatura.vencimento)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BadgeStatusFatura fatura={fatura} />
          {!registrando ? (
            <button
              type="button"
              onClick={() => setRegistrando(true)}
              className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground"
            >
              Registrar pagamento
            </button>
          ) : null}
        </div>
      </div>

      {estado.ok ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-positive">
          <CheckCircle2 className="size-3.5" aria-hidden /> Pagamento registrado.
        </p>
      ) : null}
      {estado.erro ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {estado.erro}
        </p>
      ) : null}

      {registrando && !estado.ok ? (
        <form action={acao} className="mt-3 space-y-3 border-t border-border pt-3">
          <input type="hidden" name="faturaId" value={fatura.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              id="valorPago"
              rotulo="Valor recebido"
              inputMode="decimal"
              defaultValue={estado.valores?.valorPago ?? fatura.valor.toString()}
              erro={estado.campos?.valorPago}
            />
            <CampoData
              id="pagoEm"
              name="pagoEm"
              rotulo="Data"
              defaultValue={estado.valores?.pagoEm ?? hoje}
              erro={estado.campos?.pagoEm}
              required
            />
          </div>
          <CampoSelect
            id="metodo"
            rotulo="Método"
            opcoes={[
              { valor: "pix", rotulo: "PIX" },
              { valor: "boleto", rotulo: "Boleto" },
              { valor: "cartao", rotulo: "Cartão" },
              { valor: "transferencia", rotulo: "Transferência" },
              { valor: "outro", rotulo: "Outro" },
            ]}
            erro={estado.campos?.metodo}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRegistrando(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <BotaoConfirmar rotulo="Confirmar pagamento" />
          </div>
        </form>
      ) : null}
    </li>
  );
}

function SecaoPlano({
  tenant,
  planos,
}: {
  tenant: TenantAssinatura;
  planos: Plano[];
}) {
  const [estado, acao] = useActionState<EstadoAdmin, FormData>(
    (_prev, formData) => trocarPlano(formData),
    {},
  );

  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-2 text-sm font-semibold">Plano e cobrança</h3>
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="assinaturaId" value={tenant.assinatura.id} />
        <CampoSelect
          id="planoId"
          rotulo="Plano"
          className="min-w-40 flex-1"
          defaultValue={tenant.assinatura.planoId}
          opcoes={planos.map((p) => ({
            valor: p.id,
            rotulo: `${p.nome} — ${moeda(precoNoCiclo(p, tenant.assinatura.ciclo))}`,
          }))}
        />
        <CampoSelect
          id="ciclo"
          rotulo="Ciclo"
          defaultValue={tenant.assinatura.ciclo}
          opcoes={[
            { valor: "mensal", rotulo: "Mensal" },
            { valor: "anual", rotulo: "Anual" },
          ]}
        />
        <BotaoConfirmar rotulo="Atualizar" variante="secundario" />
      </form>
      {estado.ok ? (
        <p className="mt-2 text-xs text-positive">Plano atualizado.</p>
      ) : estado.erro ? (
        <p className="mt-2 text-xs text-muted-foreground">{estado.erro}</p>
      ) : null}
    </section>
  );
}

function SecaoBloqueio({ tenant }: { tenant: TenantAssinatura }) {
  const [estado, acao] = useActionState<EstadoAdmin, FormData>(
    (_prev, formData) => alternarBloqueio(formData),
    {},
  );
  const bloqueado =
    typeof estado.bloqueado === "boolean"
      ? estado.bloqueado
      : tenant.assinatura.bloqueioManual;

  return (
    <section className="border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Bloqueio manual</h3>
          <p className="text-xs text-muted-foreground">
            {bloqueado
              ? "O acesso está bloqueado manualmente, independente das faturas."
              : "Suspende o acesso na hora, mesmo com faturas em dia."}
          </p>
        </div>
        <form action={acao}>
          <input type="hidden" name="assinaturaId" value={tenant.assinatura.id} />
          <input type="hidden" name="bloquear" value={bloqueado ? "false" : "true"} />
          <button
            type="submit"
            aria-label={bloqueado ? "Desbloquear acesso do cliente" : "Bloquear acesso do cliente"}
            className={
              bloqueado
                ? "flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                : "flex items-center gap-1.5 rounded-lg bg-negative-soft px-3 py-1.5 text-xs font-medium text-negative"
            }
          >
            {bloqueado ? (
              <>
                <Unlock className="size-3.5" aria-hidden /> Desbloquear
              </>
            ) : (
              <>
                <Lock className="size-3.5" aria-hidden /> Bloquear acesso
              </>
            )}
          </button>
        </form>
      </div>
      {estado.erro ? (
        <p className="mt-2 text-xs text-muted-foreground">{estado.erro}</p>
      ) : estado.ok ? (
        <p className="mt-2 text-xs text-positive">
          Acesso {estado.bloqueado ? "bloqueado" : "desbloqueado"}.
        </p>
      ) : null}
    </section>
  );
}

function BotaoConfirmar({
  rotulo,
  variante = "primario",
}: {
  rotulo: string;
  variante?: "primario" | "secundario";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        variante === "primario"
          ? "rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-40"
          : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted disabled:opacity-40"
      }
    >
      {pending ? "…" : rotulo}
    </button>
  );
}
