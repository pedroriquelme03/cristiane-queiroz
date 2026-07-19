"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/config";

export interface EstadoLogin {
  erro?: string;
  /** Erros por campo, para marcar o input correspondente. */
  campos?: Partial<Record<"email" | "senha", string>>;
  /**
   * E-mail digitado, devolvido para repovoar o campo: o React limpa os
   * formulários depois que a action roda. A senha nunca volta.
   */
  email?: string;
}

const esquemaLogin = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

/**
 * As mensagens do Supabase vêm em inglês e algumas expõem detalhe demais
 * (dizer "usuário não existe" permite enumerar contas). Traduzimos para um
 * conjunto pequeno e deliberadamente genérico.
 */
function traduzirErro(mensagem: string) {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) {
    return "Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  }
  return "Não foi possível entrar. Tente novamente em instantes.";
}

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const emailDigitado = String(formData.get("email") ?? "");

  if (!supabaseConfigurado) {
    return {
      erro:
        "O banco de dados ainda não foi provisionado, então o login está indisponível.",
      email: emailDigitado,
    };
  }

  const analise = esquemaLogin.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!analise.success) {
    const campos: EstadoLogin["campos"] = {};
    for (const problema of analise.error.issues) {
      const campo = problema.path[0];
      if (campo === "email" || campo === "senha") {
        campos[campo] ??= problema.message;
      }
    }
    return { campos, email: emailDigitado };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: analise.data.email,
    password: analise.data.senha,
  });

  if (error) return { erro: traduzirErro(error.message), email: emailDigitado };

  // O destino vem da querystring que o middleware montou ao barrar a rota
  const destino = String(formData.get("redirect") || "/");
  // Só caminhos internos: um redirect aberto viraria vetor de phishing
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";

  revalidatePath("/", "layout");
  redirect(seguro);
}

export async function sair() {
  if (supabaseConfigurado) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
