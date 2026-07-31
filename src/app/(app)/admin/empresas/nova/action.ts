"use server";

import { redirect } from "next/navigation";
import { getSessao } from "@/lib/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function criarEmpresa(
  _prevState: { error: string },
  formData: FormData,
) {
  const sessao = await getSessao();
  if (sessao.role !== "admin") throw new Error("Não autorizado");

  const razao_social = formData.get("razao_social") as string;
  const nome_fantasia = formData.get("nome_fantasia") as string;
  const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
  const segmento = formData.get("segmento") as string;
  const email = formData.get("email") as string;
  const senha = formData.get("senha") as string;
  const planoId = String(formData.get("planoId") ?? "");
  const ciclo = String(formData.get("ciclo") ?? "");

  // Validação
  if (!razao_social || !nome_fantasia || !cnpj || !segmento || !email || !senha || !planoId || !ciclo) {
    return { error: "Todos os campos são obrigatórios." };
  }
  if (!/^\d{14}$/.test(cnpj)) {
    return { error: "O CNPJ deve conter exatamente 14 números." };
  }
  if (senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }
  if (ciclo !== "mensal" && ciclo !== "anual") {
    return { error: "Selecione um ciclo de cobrança válido." };
  }

  const { data: plano, error: planoError } = await supabaseAdmin
    .from("planos")
    .select("id, ativo, trial_dias, preco_anual")
    .eq("id", planoId)
    .maybeSingle();

  if (planoError || !plano || !plano.ativo) {
    return { error: "O plano selecionado não está disponível." };
  }
  if (ciclo === "anual" && plano.preco_anual === null) {
    return { error: "O plano selecionado não oferece cobrança anual." };
  }

  // 1. Criar empresa
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from("empresas")
    .insert({ razao_social, nome_fantasia, cnpj, segmento })
    .select("id")
    .single();

  if (empresaError) {
    return { error: `Erro ao criar usuário: ${empresaError.message}` };
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
    return { error: `Erro ao criar acesso do usuário: ${authError.message}` };
  }

  // 3. Criar ou completar o perfil. Alguns projetos têm um trigger que cria
  // o profile automaticamente quando o usuário é criado no Supabase Auth.
  // O upsert cobre os dois cenários sem duplicar a chave primária.
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: authUser.user.id,
      email: email,
      role: "cliente",
      nome: nome_fantasia,
    }, { onConflict: "id" });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
    return { error: `Erro ao criar perfil do usuário: ${profileError.message}` };
  }

  // 4. Vincular o acesso à empresa criada. Esta é a fonte de verdade para
  // permissões e para descobrir a empresa do cliente durante a sessão.
  const { error: vinculoError } = await supabaseAdmin
    .from("empresa_membros")
    .insert({ empresa_id: empresa.id, user_id: authUser.user.id, papel: "cliente" });

  if (vinculoError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
    return { error: `Erro ao vincular o usuário à empresa: ${vinculoError.message}` };
  }

  // 5. Criar a assinatura no mesmo fluxo para que nenhum novo cliente fique
  // sem plano e, consequentemente, invisível na gestão de assinaturas.
  const hoje = new Date();
  const trialDias = plano.trial_dias ?? 0;
  const trialFim = trialDias > 0 ? new Date(hoje) : null;
  trialFim?.setDate(trialFim.getDate() + trialDias);
  const { error: assinaturaError } = await supabaseAdmin.from("assinaturas").insert({
    empresa_id: empresa.id,
    plano_id: plano.id,
    ciclo,
    status: trialDias > 0 ? "trial" : "ativa",
    inicio: hoje.toISOString().slice(0, 10),
    trial_fim: trialFim?.toISOString().slice(0, 10) ?? null,
    dia_vencimento: Math.min(28, hoje.getDate()),
  });

  if (assinaturaError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    await supabaseAdmin.from("empresas").delete().eq("id", empresa.id);
    return { error: `Erro ao vincular o plano: ${assinaturaError.message}` };
  }

  redirect("/admin/empresas");
}
