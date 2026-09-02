"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Eye, EyeOff, LogIn } from "lucide-react";

import { entrar, type EstadoLogin } from "@/app/login/acoes";
import { cn } from "@/lib/utils";

const ESTADO_INICIAL: EstadoLogin = {};
const CHAVE_EMAIL = "cq.login.email";
const CHAVE_LEMBRAR = "cq.login.lembrar";

export function FormularioLogin({
  redirecionarPara,
  desabilitado,
}: {
  redirecionarPara: string;
  /** true quando o Supabase ainda não tem chaves configuradas. */
  desabilitado: boolean;
}) {
  const [estado, acao] = useActionState(entrar, ESTADO_INICIAL);
  const [emailSalvo, setEmailSalvo] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const querLembrar = localStorage.getItem(CHAVE_LEMBRAR) === "1";
      setLembrar(querLembrar);
      if (querLembrar) {
        setEmailSalvo(localStorage.getItem(CHAVE_EMAIL) ?? "");
      }
    } catch {
      // localStorage pode falhar em modo privado restrito
    }
    setPronto(true);
  }, []);

  function aoEnviar(event: FormEvent<HTMLFormElement>) {
    const dados = new FormData(event.currentTarget);
    const email = String(dados.get("email") ?? "").trim();
    const querLembrar = dados.get("lembrar") === "on";

    try {
      if (querLembrar && email) {
        localStorage.setItem(CHAVE_LEMBRAR, "1");
        localStorage.setItem(CHAVE_EMAIL, email);
      } else {
        localStorage.removeItem(CHAVE_LEMBRAR);
        localStorage.removeItem(CHAVE_EMAIL);
      }
    } catch {
      // ignora falha de armazenamento local
    }
  }

  const emailPadrao = estado.email ?? (pronto ? emailSalvo : undefined);

  return (
    <form action={acao} onSubmit={aoEnviar} className="space-y-4">
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
        defaultValue={emailPadrao}
        // remonta o input quando o e-mail salvo chega do localStorage
        chave={pronto ? `email-${emailPadrao ?? ""}` : "email-loading"}
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

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="lembrar"
          checked={lembrar}
          onChange={(event) => setLembrar(event.target.checked)}
          disabled={desabilitado}
          className="size-4 rounded border-border accent-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
        Lembrar senha
      </label>

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
  chave,
  erro,
  desabilitado,
}: {
  id: "email" | "senha";
  rotulo: string;
  tipo: string;
  autoComplete: string;
  defaultValue?: string;
  chave?: string;
  erro?: string;
  desabilitado: boolean;
}) {
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const ehSenha = tipo === "password";
  const tipoInput = ehSenha ? (senhaVisivel ? "text" : "password") : tipo;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div className="relative mt-1">
        <input
          key={chave ?? id}
          id={id}
          name={id}
          type={tipoInput}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          disabled={desabilitado}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className={cn(
            "w-full rounded-lg border bg-surface px-3 py-2 text-sm",
            "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            ehSenha ? "pr-10" : null,
            erro ? "border-negative" : "border-border",
          )}
        />
        {ehSenha ? (
          <button
            type="button"
            onClick={() => setSenhaVisivel((v) => !v)}
            disabled={desabilitado}
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={senhaVisivel}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {senhaVisivel ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
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
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
    >
      <LogIn className="size-4" aria-hidden />
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
