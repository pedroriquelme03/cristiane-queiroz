import { RelatorioTitulos } from "@/components/relatorios/relatorio-titulos";

export default async function RelatorioContasAPagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return RelatorioTitulos({ tipo: "pagar", searchParams });
}
