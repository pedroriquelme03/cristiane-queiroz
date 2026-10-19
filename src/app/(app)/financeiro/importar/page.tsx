import { AssistenteImportacao } from "@/components/importacao/assistente-importacao";
import { getModelosImportacao } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { getSessao } from "@/lib/sessao";

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = empresaAtiva(sessao, params.empresa);
  const podeSalvarModelo =
    Boolean(empresaId) && (sessao.role === "admin" || sessao.role === "cliente");
  const modelos = await getModelosImportacao(empresaId ?? undefined);

  return (
    <AssistenteImportacao
      empresaId={empresaId ?? ""}
      modelosIniciais={modelos}
      podeSalvarModelo={podeSalvarModelo}
    />
  );
}
