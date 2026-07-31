"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { criarEmpresa } from "@/app/(app)/admin/empresas/nova/action";
import { SeletorSegmento } from "@/components/admin/seletor-segmento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { moeda } from "@/lib/format";
import type { Plano } from "@/lib/types";

export function FormNovoCliente({ planos }: { planos: Plano[] }) {
  const [estado, acao, pendente] = useActionState(criarEmpresa, { error: "" });

  return (
    <form action={acao} className="space-y-4">
      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Dados da empresa</h3>
        <div className="space-y-3">
          <CampoTexto id="razao_social" rotulo="Razão social *" required />
          <CampoTexto id="nome_fantasia" rotulo="Nome fantasia *" required />
          <CampoTexto
            id="cnpj"
            rotulo="CNPJ *"
            required
            inputMode="numeric"
            minLength={14}
            maxLength={14}
            pattern="[0-9]{14}"
            placeholder="Somente os 14 números"
            onInput={(evento) => {
              evento.currentTarget.value = evento.currentTarget.value.replace(/\D/g, "").slice(0, 14);
            }}
          />
          <SeletorSegmento />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Plano e cobrança</h3>
        {planos.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoSelect
              id="planoId"
              rotulo="Plano *"
              required
              defaultValue={planos[0].id}
              opcoes={planos.map((plano) => ({
                valor: plano.id,
                rotulo: plano.nome,
                detalhe: moeda(plano.precoMensal),
              }))}
            />
            <CampoSelect
              id="ciclo"
              rotulo="Ciclo *"
              required
              defaultValue="mensal"
              opcoes={[
                { valor: "mensal", rotulo: "Mensal" },
                { valor: "anual", rotulo: "Anual" },
              ]}
            />
          </div>
        ) : (
          <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Cadastre ou ative um plano antes de criar um cliente.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Dados de acesso do cliente</h3>
        <div className="space-y-3">
          <CampoTexto id="email" rotulo="E-mail *" tipo="email" required placeholder="cliente@exemplo.com" />
          <CampoTexto id="senha" rotulo="Senha temporária *" tipo="password" required minLength={6} placeholder="Mínimo de 6 caracteres" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O cliente usará estas credenciais para acessar o sistema.
        </p>
      </div>

      {estado.error ? <p role="alert" className="rounded-lg bg-negative/10 p-3 text-sm text-negative">{estado.error}</p> : null}

      <button
        type="submit"
        disabled={pendente || !planos.length}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden />
        {pendente ? "Criando cliente..." : "Criar cliente e acesso"}
      </button>
    </form>
  );
}
