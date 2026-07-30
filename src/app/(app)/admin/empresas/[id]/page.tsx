import { notFound } from "next/navigation";

import { excluirUsuario } from "./action";
import { BotaoExcluirUsuario } from "./botao-excluir-usuario";
import { FormEditarEmpresa } from "./form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function EditarEmpresaPage({
  params,
}: PageProps<"/admin/empresas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: empresa, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !empresa) notFound();

  const excluirUsuarioPorId = excluirUsuario.bind(null, id);

  return (
    <Card className="max-w-2xl">
      <CardHeader
        titulo="Editar usuário"
        descricao="Atualize os dados cadastrais da empresa vinculada ao usuário."
        acao={<BotaoExcluirUsuario action={excluirUsuarioPorId} />}
      />
      <CardBody>
        <FormEditarEmpresa empresa={empresa} />
      </CardBody>
    </Card>
  );
}
