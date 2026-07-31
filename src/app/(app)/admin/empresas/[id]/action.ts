"use server";

import { redirect } from "next/navigation";

import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function excluirUsuario(empresaId: string, formData: FormData) {
  void formData;
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Não autorizado");

  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from("empresa_membros")
    .select("user_id")
    .eq("empresa_id", empresaId);

  if (vinculosError) throw new Error("Não foi possível localizar o usuário.");
  if (vinculos.some((vinculo) => vinculo.user_id === sessao.usuarioId)) {
    throw new Error("Você não pode excluir o seu próprio acesso.");
  }

  for (const vinculo of vinculos) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(vinculo.user_id);
    if (error) throw new Error(`Não foi possível excluir o usuário: ${error.message}`);
  }

  const { error: empresaDeleteError } = await supabaseAdmin
    .from("empresas")
    .delete()
    .eq("id", empresaId);
  if (empresaDeleteError) throw new Error("Não foi possível excluir o cadastro do usuário.");

  redirect("/admin/empresas");
}
