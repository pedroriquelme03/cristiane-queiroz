import { FormNovoCliente } from "@/components/admin/form-novo-cliente";
import { getPlanos } from "@/lib/dados-assinatura";

export default async function NovaEmpresaPage() {
  const planos = (await getPlanos()).filter((plano) => plano.ativo);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Novo cliente</h2>
      <FormNovoCliente planos={planos} />
    </div>
  );
}
