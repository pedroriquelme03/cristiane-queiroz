/**
 * Validação do cadastro de planos e do registro de pagamento de fatura.
 * Espelha as restrições CHECK da migration 0005.
 */
import { z } from "zod";

import { parseValor } from "@/lib/importacao/parsers";

const valorMonetario = (rotulo: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${rotulo}`)
    .transform((texto, ctx) => {
      const numero = parseValor(texto);
      if (numero === null) {
        // "o preço mensal" -> "Confira o preço mensal" (evita concordância torta)
        ctx.addIssue({ code: "custom", message: `Confira ${rotulo}` });
        return z.NEVER;
      }
      return numero;
    });

const inteiroOpcional = (rotulo: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((texto, ctx) => {
      if (!texto) return null; // vazio = ilimitado
      const n = Number(texto.replace(/\D/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `Confira ${rotulo}` });
        return z.NEVER;
      }
      return n;
    });

export const esquemaPlano = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome do plano").max(60),
    descricao: z.string().trim().max(200).optional().transform((v) => v ?? ""),
    precoMensal: valorMonetario("o preço mensal").refine(
      (v) => v >= 0,
      "O preço não pode ser negativo",
    ),
    precoAnual: z
      .string()
      .trim()
      .optional()
      .transform((texto, ctx) => {
        if (!texto) return null; // sem ciclo anual
        const numero = parseValor(texto);
        if (numero === null) {
          ctx.addIssue({ code: "custom", message: "Preço anual inválido" });
          return z.NEVER;
        }
        return numero;
      }),
    trialDias: z
      .string()
      .trim()
      .optional()
      .transform((t) => (t ? Math.max(0, Number(t.replace(/\D/g, "")) || 0) : 0)),
    // Textarea com um recurso por linha
    recursos: z
      .string()
      .optional()
      .transform((t) =>
        (t ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    limiteUsuarios: inteiroOpcional("o limite de usuários"),
    limiteEmpresas: inteiroOpcional("o limite de empresas"),
    publico: z.union([z.literal("on"), z.literal("")]).optional().transform((v) => v === "on"),
  })
  .refine((p) => p.precoAnual === null || p.precoAnual >= 0, {
    message: "O preço anual não pode ser negativo",
    path: ["precoAnual"],
  });

export type DadosPlano = z.infer<typeof esquemaPlano>;

export const esquemaPagamento = z.object({
  faturaId: z.string().min(1),
  metodo: z.enum(["pix", "boleto", "cartao", "transferencia", "outro"], {
    message: "Selecione o método de pagamento",
  }),
  valorPago: valorMonetario("o valor pago").refine(
    (v) => v > 0,
    "O valor deve ser maior que zero",
  ),
  pagoEm: z
    .string()
    .trim()
    .min(1, "Informe a data do pagamento")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  observacao: z.string().trim().max(200).optional(),
});

export type DadosPagamento = z.infer<typeof esquemaPagamento>;
