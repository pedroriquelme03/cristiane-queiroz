import { notFound } from "next/navigation";

import { ConteudoVisaoCliente } from "@/app/(app)/admin/visao-cliente/page";
import { getSessao } from "@/lib/sessao";

export default async function VisaoClientePage(props: PageProps<"/visao-cliente">) {
  const sessao = await getSessao();
  if (sessao.role !== "admin") notFound();

  return <ConteudoVisaoCliente searchParams={props.searchParams} />;
}
