import { FormNovoCliente } from "@/components/admin/form-novo-cliente";
import { getPlanos } from "@/lib/dados-assinatura";
import { getSegmentos } from "@/lib/dados-segmentos";

export default async function NovaEmpresaPage() {
  const [planosTodos, segmentos] = await Promise.all([getPlanos(), getSegmentos()]);
  const planos = planosTodos.filter((plano) => plano.ativo);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Novo cliente</h2>
      <FormNovoCliente planos={planos} segmentos={segmentos} />
    </div>
  );
}
