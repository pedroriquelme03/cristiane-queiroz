"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function criarEmpresa(prevState: any, formData: FormData) {
  const razao_social = formData.get("razao_social") as string;
  const nome_fantasia = formData.get("nome_fantasia") as string;
  const cnpj = formData.get("cnpj") as string;
  const segmento = formData.get("segmento") as string;
  const email = formData.get("email") as string;
  const senha = formData.get("senha") as string;

  // Validação
  if (!razao_social || !nome_fantasia || !cnpj || !segmento || !email || !senha) {
    return { error: "Todos os campos são obrigatórios." };
  }
  if (senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  // 1. Criar empresa
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from("empresas")
    .insert({ razao_social, nome_fantasia, cnpj, segmento })
    .select("id")
    .single();

  if (empresaError) {
    return { error: `Erro ao criar empresa: ${empresaError.message}` };
  }

  // 2. Criar usuário
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: nome_fantasia, empresa_id: empresa.id },
  });

  if (authError) {
    await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
    return { error: `Erro ao criar usuário: ${authError.message}` };
  }

  // 3. Criar perfil
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: authUser.user.id,
      email: email,
      role: "cliente",
      empresa_id: empresa.id,
      nome: nome_fantasia,
    });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
    return { error: `Erro ao criar perfil: ${profileError.message}` };
  }

  redirect("/admin/empresas");
}