import { redirect } from "next/navigation";

export default async function EstruturaAdminPage({
  params,
}: PageProps<"/admin/empresas/[id]/estrutura">) {
  const { id } = await params;
  redirect(`/cadastros/unidades?empresa=${encodeURIComponent(id)}`);
}
