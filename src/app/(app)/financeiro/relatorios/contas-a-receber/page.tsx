import { RelatorioTitulos } from "@/components/relatorios/relatorio-titulos";

export default async function RelatorioContasAReceberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return RelatorioTitulos({ tipo: "receber", searchParams });
}
