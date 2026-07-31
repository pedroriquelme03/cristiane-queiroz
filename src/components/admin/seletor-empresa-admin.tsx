import { SeletorCliente } from "@/app/(app)/admin/visao-cliente/seletor-cliente";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

export async function SeletorEmpresaAdmin({
  className = "w-full sm:w-80",
}: {
  className?: string;
}) {
  const sessao = await getSessao();
  if (sessao.role !== "admin") return null;

  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nome_fantasia, razao_social")
    .order("razao_social");

  return (
    <div className={className}>
      <SeletorCliente
        empresas={empresas ?? []}
        rotaBase=""
        rotulo="Empresa selecionada"
        placeholder="Selecione uma empresa"
      />
    </div>
  );
}
