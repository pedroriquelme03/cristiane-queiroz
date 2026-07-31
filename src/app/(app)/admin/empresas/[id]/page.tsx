import { notFound } from "next/navigation";

import { excluirUsuario } from "./action";
import { BotaoExcluirUsuario } from "./botao-excluir-usuario";
import { FormEditarEmpresa } from "./form";
import { GerenciarAcessos } from "@/components/admin/gerenciar-acessos";
import { VincularPlano } from "@/components/admin/vincular-plano";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPlanos } from "@/lib/dados-assinatura";
import { createClient } from "@/lib/supabase/server";

export default async function EditarEmpresaPage({
  params,
}: PageProps<"/admin/empresas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: empresa, error },
    { data: membros, error: membrosError },
    { data: assinatura, error: assinaturaError },
    planos,
  ] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).single(),
    supabase.from("empresa_membros").select("user_id, papel").eq("empresa_id", id),
    supabase.from("assinaturas").select("id").eq("empresa_id", id).maybeSingle(),
    getPlanos(),
  ]);

  if (error || !empresa) notFound();
  if (membrosError) throw new Error("Não foi possível carregar os acessos da empresa.");
  if (assinaturaError) throw new Error("Não foi possível carregar o plano da empresa.");

  const usuarioIds = (membros ?? []).map((membro) => membro.user_id);
  const { data: profiles, error: profilesError } = usuarioIds.length
    ? await supabase.from("profiles").select("id, nome, email").in("id", usuarioIds)
    : { data: [], error: null };
  if (profilesError) throw new Error("Não foi possível carregar os usuários da empresa.");

  const profilesPorId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const acessos = (membros ?? []).map((membro) => {
    const profile = profilesPorId.get(membro.user_id);
    return {
      id: membro.user_id,
      nome: profile?.nome || profile?.email || "Usuário",
      email: profile?.email || "E-mail não informado",
      papel: membro.papel,
    };
  });

  const excluirUsuarioPorId = excluirUsuario.bind(null, id);

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      {!assinatura ? (
        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Vincular plano"
            descricao="Este cadastro foi criado sem assinatura. Selecione o plano para liberar a gestão do cliente."
          />
          <CardBody>
            <VincularPlano empresaId={id} planos={planos.filter((plano) => plano.ativo)} />
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader
          titulo="Editar empresa"
          descricao="Atualize os dados cadastrais vinculados aos acessos."
          acao={<BotaoExcluirUsuario action={excluirUsuarioPorId} />}
        />
        <CardBody>
          <FormEditarEmpresa empresa={empresa} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          titulo="Acessos à plataforma"
          descricao={`${acessos.length} login${acessos.length === 1 ? "" : "s"} vinculado${acessos.length === 1 ? "" : "s"} a esta empresa`}
        />
        <CardBody>
          <GerenciarAcessos empresaId={id} acessos={acessos} />
        </CardBody>
      </Card>
    </div>
  );
}
