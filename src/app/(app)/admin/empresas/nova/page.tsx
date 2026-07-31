"use client";

import { useActionState } from "react";
import { criarEmpresa } from "./action"; // ← NOME CORRETO: action.ts

export default function NovaEmpresaPage() {
  const [state, action] = useActionState(criarEmpresa, { error: "" });

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Novo usuário</h2>
      <form action={action} className="space-y-4">
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Dados da empresa</h3>
          <label htmlFor="razao_social" className="block text-sm font-medium mb-1">
            Razão Social *
          </label>
          <input
            id="razao_social"
            name="razao_social"
            type="text"
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="nome_fantasia" className="block text-sm font-medium mb-1">
            Nome Fantasia *
          </label>
          <input
            id="nome_fantasia"
            name="nome_fantasia"
            type="text"
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="cnpj" className="block text-sm font-medium mb-1">
            CNPJ *
          </label>
          <input
            id="cnpj"
            name="cnpj"
            type="text"
            required
            inputMode="numeric"
            minLength={14}
            maxLength={14}
            pattern="[0-9]{14}"
            placeholder="Somente os 14 números"
            onInput={(event) => {
              event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 14);
            }}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="segmento" className="block text-sm font-medium mb-1">
            Segmento *
          </label>
          <select
            id="segmento"
            name="segmento"
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          >
            <option value="hotelaria">Hotelaria</option>
            <option value="comercio">Comércio</option>
            <option value="servicos">Serviços</option>
            <option value="industria">Indústria</option>
            <option value="alimentacao">Alimentação</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Dados de acesso do cliente</h3>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="cliente@exemplo.com"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
          <div className="mt-3">
            <label htmlFor="senha" className="block text-sm font-medium mb-1">
              Senha *
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            O usuário receberá essas credenciais para acessar o sistema.
          </p>
        </div>

        {state.error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{state.error}</div>}

        <button
          type="submit"
          className="px-4 py-2 bg-brand text-brand-foreground rounded-lg hover:opacity-90"
        >
          Criar usuário
        </button>
      </form>
    </div>
  );
}
