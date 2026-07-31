"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

interface EmpresaForm {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  segmento: string;
}

export function FormEditarEmpresa({ empresa }: { empresa: EmpresaForm }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
    if (!/^\d{14}$/.test(cnpj)) {
      setError("O CNPJ deve conter exatamente 14 números.");
      setSaving(false);
      return;
    }

    const dados = {
      razao_social: formData.get("razao_social") as string,
      nome_fantasia: formData.get("nome_fantasia") as string,
      cnpj,
      segmento: formData.get("segmento") as string,
    };

    const supabase = createBrowserClient();
    const { error } = await supabase
      .from("empresas")
      .update(dados)
      .eq("id", empresa.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push("/admin/empresas");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="razao_social" className="block text-sm font-medium mb-1">
          Razão Social *
        </label>
        <input
          id="razao_social"
          name="razao_social"
          type="text"
          defaultValue={empresa.razao_social}
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
          defaultValue={empresa.nome_fantasia}
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
            defaultValue={empresa.cnpj}
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
          defaultValue={empresa.segmento}
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

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-brand text-brand-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
