import { redirect } from "next/navigation";

export default async function EstruturaAdminPage({
  params,
}: PageProps<"/admin/empresas/[id]/estrutura">) {
  const { id } = await params;
  redirect(`/empresa/estrutura?empresa=${encodeURIComponent(id)}`);
}
