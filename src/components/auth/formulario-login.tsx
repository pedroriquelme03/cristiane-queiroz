"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, LogIn } from "lucide-react";

import { entrar, type EstadoLogin } from "@/app/login/acoes";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoLogin = {};

export function FormularioLogin({
  redirecionarPara,
  desabilitado,
}: {
  redirecionarPara: string;
  /** true quando o Supabase ainda não tem chaves configuradas. */
  desabilitado: boolean;
}) {
  const [estado, acao] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="redirect" value={redirecionarPara} />

      {estado.erro ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-negative/20 bg-negative-soft px-3 py-2.5"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden />
          <p className="text-sm text-negative">{estado.erro}</p>
        </div>
      ) : null}

      <Campo
        id="email"
        rotulo="E-mail"
        tipo="email"
        autoComplete="username"
        defaultValue={estado.email}
        erro={estado.campos?.email}
        desabilitado={desabilitado}
      />
      <Campo
        id="senha"
        rotulo="Senha"
        tipo="password"
        autoComplete="current-password"
        erro={estado.campos?.senha}
        desabilitado={desabilitado}
      />

      <Botao desabilitado={desabilitado} />
    </form>
  );
}

function Campo({
  id,
  rotulo,
  tipo,
  autoComplete,
  defaultValue,
  erro,
  desabilitado,
}: {
  id: "email" | "senha";
  rotulo: string;
  tipo: string;
  autoComplete: string;
  defaultValue?: string;
  erro?: string;
  desabilitado: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        disabled={desabilitado}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={cn(
          "mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm",
          "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          erro ? "border-negative" : "border-border",
        )}
      />
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function Botao({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={desabilitado || pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    >
      <LogIn className="size-4" aria-hidden />
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
