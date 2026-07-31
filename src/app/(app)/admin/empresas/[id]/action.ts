"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface EstadoAcesso {
  ok?: boolean;
  erro?: string;
}

async function validarAdmin() {
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Não autorizado");
  return sessao;
}

async function usuarioPertenceAEmpresa(empresaId: string, usuarioId: string) {
  const { data, error } = await supabaseAdmin
    .from("empresa_membros")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", usuarioId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function validarLimiteUsuarios(empresaId: string) {
  const [{ count, error: membrosError }, { data: assinatura, error: assinaturaError }] = await Promise.all([
    supabaseAdmin
      .from("empresa_membros")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabaseAdmin
      .from("assinaturas")
      .select("plano:planos(limite_usuarios)")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
  ]);

  if (membrosError || assinaturaError) throw new Error("Não foi possível conferir o limite do plano.");
  const plano = Array.isArray(assinatura?.plano) ? assinatura.plano[0] : assinatura?.plano;
  const limite = plano?.limite_usuarios ?? null;
  if (limite !== null && (count ?? 0) >= limite) {
    throw new Error(`O plano atual permite no máximo ${limite} usuário${limite === 1 ? "" : "s"}.`);
  }
}

export async function criarAcessoEmpresa(
  empresaId: string,
  _estado: EstadoAcesso,
  formData: FormData,
): Promise<EstadoAcesso> {
  try {
    await validarAdmin();
    await validarLimiteUsuarios(empresaId);

    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const senha = String(formData.get("senha") ?? "");
    if (!nome) return { erro: "Informe o nome do usuário." };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "Informe um e-mail válido." };
    if (senha.length < 8) return { erro: "A senha temporária deve ter pelo menos 8 caracteres." };

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (authError || !authUser.user) {
      return { erro: authError?.message.includes("already") ? "Este e-mail já possui acesso." : "Não foi possível criar o acesso." };
    }

    const usuarioId = authUser.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: usuarioId,
      nome,
      email,
      role: "cliente",
    }, { onConflict: "id" });
    const { error: vinculoError } = profileError
      ? { error: profileError }
      : await supabaseAdmin.from("empresa_membros").insert({
          empresa_id: empresaId,
          user_id: usuarioId,
          papel: "cliente",
        });

    if (profileError || vinculoError) {
      await supabaseAdmin.auth.admin.deleteUser(usuarioId);
      return { erro: "O acesso foi criado, mas não pôde ser vinculado à empresa." };
    }

    revalidatePath("/admin/empresas");
    revalidatePath(`/admin/empresas/${empresaId}`);
    return { ok: true };
  } catch (error) {
    return { erro: error instanceof Error ? error.message : "Não foi possível criar o acesso." };
  }
}

export async function redefinirSenhaAcesso(
  empresaId: string,
  usuarioId: string,
  _estado: EstadoAcesso,
  formData: FormData,
): Promise<EstadoAcesso> {
  try {
    await validarAdmin();
    if (!(await usuarioPertenceAEmpresa(empresaId, usuarioId))) {
      return { erro: "Este usuário não pertence à empresa." };
    }

    const senha = String(formData.get("senha") ?? "");
    if (senha.length < 8) return { erro: "A nova senha deve ter pelo menos 8 caracteres." };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(usuarioId, { password: senha });
    if (error) return { erro: "Não foi possível redefinir a senha." };
    return { ok: true };
  } catch (error) {
    return { erro: error instanceof Error ? error.message : "Não foi possível redefinir a senha." };
  }
}

export async function excluirUsuario(empresaId: string, formData: FormData) {
  void formData;
  const sessao = await validarAdmin();

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
