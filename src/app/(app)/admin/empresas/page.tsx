import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Users, Building2, Tag } from "lucide-react";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("*")
    .order("nome_fantasia");

  if (error) {
    console.error("Erro ao buscar empresas:", error);
    return <div className="p-4 text-red-600">Erro ao carregar empresas.</div>;
  }

  // Garantir que empresas é um array (mesmo que vazio)
  const empresasArray = empresas || [];

  const total = empresasArray.length;

  // Calcular segmentos com tipagem explícita
  const segmentos: Record<string, number> = {};
  for (const e of empresasArray) {
    const seg = e.segmento || "outros";
    segmentos[seg] = (segmentos[seg] || 0) + 1;
  }

  const segmentoMaisComum =
    Object.entries(segmentos).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // ... resto do código (os cards e a tabela) permanece igual
}