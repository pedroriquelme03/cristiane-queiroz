import { redirect } from "next/navigation";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa } = await searchParams;
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  redirect(
    empresaId
      ? `/financeiro/fluxo-de-caixa?empresa=${encodeURIComponent(empresaId)}`
      : "/financeiro/fluxo-de-caixa",
  );
}
