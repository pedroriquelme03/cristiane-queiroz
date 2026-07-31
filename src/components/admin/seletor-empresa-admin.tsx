import { SeletorCliente } from "@/app/(app)/admin/visao-cliente/seletor-cliente";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";

interface EmpresaOpcao {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
}

export async function SeletorEmpresaAdmin({
  className = "w-full sm:w-80",
  empresas: empresasProp,
  placeholder = "Selecione uma empresa",
}: {
  className?: string;
  empresas?: EmpresaOpcao[];
  placeholder?: string;
}) {
  const sessao = await getSessao();
  if (sessao.role !== "admin") return null;

  const empresas = empresasProp ?? await listarEmpresas();

  return (
    <div className={className}>
      <SeletorCliente
        empresas={empresas.map((empresa) => ({
          id: empresa.id,
          nome_fantasia: empresa.nome_fantasia ?? empresa.razao_social ?? "Empresa sem nome",
          razao_social: empresa.razao_social ?? empresa.nome_fantasia ?? "Empresa sem nome",
        }))}
        rotaBase=""
        rotulo="Empresa selecionada"
        placeholder={placeholder}
      />
    </div>
  );
}

async function listarEmpresas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    .select("id, nome_fantasia, razao_social")
    .order("razao_social");

  return data ?? [];
}
