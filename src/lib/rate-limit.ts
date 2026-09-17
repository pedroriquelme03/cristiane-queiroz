/**
 * Rate limiting compartilhado, apoiado no Postgres (ver migration 0021).
 *
 * Em serverless não dá para confiar em estado de processo: cada instância tem o
 * seu, então um contador em memória não segura brute force. O contador real
 * vive no banco; aqui só montamos a chave, lemos o IP e chamamos a função.
 *
 * Falha aberta de propósito: se o Supabase não estiver configurado ou a chamada
 * der erro, liberamos a ação. O objetivo é frear abuso, não derrubar usuários
 * legítimos por uma indisponibilidade — e o Supabase Auth tem rate limit próprio
 * como segunda camada no caso do login.
 */
import { headers } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

export interface ResultadoRateLimit {
  permitido: boolean;
  restantes: number;
}

/** Melhor esforço para identificar o cliente atrás do proxy/CDN. */
export async function obterIpCliente(): Promise<string> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  return cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}

/**
 * Registra uma tentativa para `chave` e diz se ela cabe no limite.
 * A janela é deslizante por chave: `max` tentativas a cada `janelaSegundos`.
 */
export async function verificarRateLimit(opcoes: {
  chave: string;
  max: number;
  janelaSegundos: number;
}): Promise<ResultadoRateLimit> {
  const permitidoPorPadrao: ResultadoRateLimit = {
    permitido: true,
    restantes: opcoes.max,
  };

  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return permitidoPorPadrao;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
      p_chave: opcoes.chave,
      p_max: opcoes.max,
      p_janela_segundos: opcoes.janelaSegundos,
    });

    if (error || !data) return permitidoPorPadrao;

    // Limpeza oportunística: mantém a tabela enxuta sem depender de cron.
    if (Math.random() < 0.01) {
      await supabaseAdmin
        .rpc("rate_limit_limpar", { p_janela_segundos: opcoes.janelaSegundos })
        .then(() => undefined, () => undefined);
    }

    const linha = Array.isArray(data) ? data[0] : data;
    return {
      permitido: Boolean(linha?.permitido),
      restantes: Number(linha?.restantes ?? 0),
    };
  } catch {
    return permitidoPorPadrao;
  }
}
