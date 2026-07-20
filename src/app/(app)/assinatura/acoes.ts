"use server";

import { supabaseConfigurado } from "@/lib/supabase/config";

export interface EstadoCobranca {
  ok?: boolean;
  erro?: string;
  /** Código PIX copia-e-cola gerado para a fatura. */
  pixCopiaCola?: string;
  mensagem?: string;
}

/**
 * Gera a cobrança de uma fatura. Nesta fase devolve um PIX de demonstração; o
 * ponto de integração com o gateway (Mercado Pago/Asaas/Stripe) fica marcado.
 * Nenhuma credencial financeira é tratada aqui — quem paga é o cliente, no app
 * do banco dele, com o código gerado pelo gateway.
 */
export async function gerarCobranca(
  _anterior: EstadoCobranca,
  formData: FormData,
): Promise<EstadoCobranca> {
  const faturaId = String(formData.get("faturaId") ?? "");
  if (!faturaId) return { erro: "Fatura inválida." };

  if (!supabaseConfigurado) {
    // Demonstração: um código PIX fictício, só para ilustrar o fluxo.
    return {
      ok: true,
      pixCopiaCola:
        "00020126360014BR.GOV.BCB.PIX0114+55419999999995204000053039865802BR5921CQ CONSULTORIA LTDA6009FOZ IGUACU62070503***6304DEMO",
      mensagem:
        "Código PIX de demonstração. Com o gateway ligado, este código é emitido pela operadora e o pagamento confirma a fatura automaticamente via webhook.",
    };
  }

  // TODO(gateway): criar cobrança na API do gateway a partir do valor da fatura,
  // gravar faturas.referencia_externa e devolver o PIX/boleto real. A baixa vem
  // pelo webhook -> update fatura + recalcular_status_assinatura.
  return { ok: true };
}

export async function solicitarTrocaPlano(
  formData: FormData,
): Promise<EstadoCobranca> {
  const planoId = String(formData.get("planoId") ?? "");
  if (!planoId) return { erro: "Plano inválido." };

  // Trocar plano é operação da consultoria (RLS: só admin escreve assinaturas).
  // Do lado do cliente é um pedido, não uma escrita direta.
  return {
    ok: true,
    mensagem:
      "Pedido registrado. A consultoria vai confirmar a troca e ela passa a valer na próxima fatura.",
  };
}
