"use client";

import { useActionState } from "react";
import { CheckCircle2, KeyRound, Plus, UserRound } from "lucide-react";

import {
  criarAcessoEmpresa,
  redefinirSenhaAcesso,
  type EstadoAcesso,
} from "@/app/(app)/admin/empresas/[id]/action";

const ESTADO_INICIAL: EstadoAcesso = {};

interface Acesso {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export function GerenciarAcessos({ empresaId, acessos }: { empresaId: string; acessos: Acesso[] }) {
  const [estado, acao, pendente] = useActionState(
    criarAcessoEmpresa.bind(null, empresaId),
    ESTADO_INICIAL,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {acessos.length ? acessos.map((acesso) => (
          <article key={acesso.id} className="rounded-lg border border-border px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <UserRound className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{acesso.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{acesso.email}</p>
                  </div>
                  <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-muted-foreground">
                    {acesso.papel === "consultor" ? "Consultor" : "Cliente"}
                  </span>
                </div>
                <RedefinirSenha empresaId={empresaId} usuarioId={acesso.id} />
              </div>
            </div>
          </article>
        )) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum acesso vinculado.
          </p>
        )}
      </div>

      <details className="border-t border-border pt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90">
          <Plus className="size-4" aria-hidden />
          Novo acesso
        </summary>
        <form action={acao} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Nome
            <input name="nome" required className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            E-mail
            <input name="email" type="email" required className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Senha temporária
            <input name="senha" type="password" minLength={8} required autoComplete="new-password" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            A senha atual nunca é exibida. Você pode apenas definir uma nova senha temporária.
          </p>
          {estado.erro ? <p role="alert" className="text-xs text-negative sm:col-span-2">{estado.erro}</p> : null}
          {estado.ok ? (
            <p role="status" className="flex items-center gap-1 text-xs text-positive sm:col-span-2">
              <CheckCircle2 className="size-3.5" aria-hidden /> Acesso criado.
            </p>
          ) : null}
          <button disabled={pendente} className="justify-self-start rounded-lg bg-brand px-4 py-2 text-xs font-medium text-brand-foreground disabled:opacity-50 sm:col-span-2">
            {pendente ? "Criando..." : "Criar acesso"}
          </button>
        </form>
      </details>
    </div>
  );
}

function RedefinirSenha({ empresaId, usuarioId }: { empresaId: string; usuarioId: string }) {
  const [estado, acao, pendente] = useActionState(
    redefinirSenhaAcesso.bind(null, empresaId, usuarioId),
    ESTADO_INICIAL,
  );

  return (
    <details className="mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-brand hover:underline">
        <KeyRound className="size-3.5" aria-hidden />
        Redefinir senha
      </summary>
      <form action={acao} className="mt-2 flex flex-wrap items-start gap-2">
        <input
          name="senha"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="Nova senha temporária"
          aria-label="Nova senha temporária"
          className="min-w-48 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
        <button disabled={pendente} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-muted disabled:opacity-50">
          {pendente ? "Salvando..." : "Atualizar"}
        </button>
        {estado.erro ? <p role="alert" className="w-full text-xs text-negative">{estado.erro}</p> : null}
        {estado.ok ? <p role="status" className="w-full text-xs text-positive">Senha redefinida.</p> : null}
      </form>
    </details>
  );
}
