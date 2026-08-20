import { redirect } from "next/navigation";

export default async function EstruturaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const { empresa } = await searchParams;
  const query = typeof empresa === "string" ? `?empresa=${encodeURIComponent(empresa)}` : "";
  redirect(`/cadastros/unidades${query}`);
}
