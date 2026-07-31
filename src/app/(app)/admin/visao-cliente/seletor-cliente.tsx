"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface EmpresaOpcao {
  id: string;
  nome_fantasia: string;
  razao_social: string;
}

export function SeletorCliente({
  empresas,
  empresaSelecionadaId,
  rotaBase = "/visao-cliente",
  rotulo = "Cliente visualizado",
  placeholder = "Selecione um cliente",
}: {
  empresas: EmpresaOpcao[];
  empresaSelecionadaId?: string;
  rotaBase?: string;
  rotulo?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const valorSelecionado = empresaSelecionadaId ?? searchParams.get("empresa") ?? "";

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {rotulo}
      </span>
      <select
        value={valorSelecionado}
        onChange={(event) => {
          const empresaId = event.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (empresaId) {
            params.set("empresa", empresaId);
          } else {
            params.delete("empresa");
          }
          const busca = params.toString();
          const destino = rotaBase || pathname;
          router.push(busca ? `${destino}?${busca}` : destino);
        }}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">{placeholder}</option>
        {empresas.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.razao_social || empresa.nome_fantasia}
          </option>
        ))}
      </select>
    </label>
  );
}
