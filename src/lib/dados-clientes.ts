import { cache } from "react";

import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ClienteConsultoria, TipoDocumentoCliente } from "@/lib/types";

type ClienteConsultoriaRow = {
  id: string;
  nome: string;
  tipo_documento: TipoDocumentoCliente;
  documento: string;
  valor_mensal: number | string;
  ativo: boolean;
  created_at: string;
};

function mapCliente(row: ClienteConsultoriaRow): ClienteConsultoria {
  return {
    id: row.id,
    nome: row.nome,
    tipoDocumento: row.tipo_documento,
    documento: row.documento,
    valorMensal: typeof row.valor_mensal === "string" ? Number(row.valor_mensal) : row.valor_mensal,
    ativo: row.ativo,
    criadoEm: row.created_at.slice(0, 10),
  };
}

export const getClientesConsultoria = cache(async (): Promise<ClienteConsultoria[]> => {
  if (!supabaseConfigurado) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes_consultoria")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  if (error) throw new Error("Não foi possível carregar os clientes de consultoria.");
  return (data ?? []).map(mapCliente);
});

export async function getResumoClientesConsultoria() {
  const clientes = await getClientesConsultoria();
  const receitaMensal = clientes.reduce((soma, cliente) => soma + cliente.valorMensal, 0);

  return {
    total: clientes.length,
    receitaMensal,
  };
}
