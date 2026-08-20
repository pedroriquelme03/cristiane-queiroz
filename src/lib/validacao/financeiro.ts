/**
 * Esquemas de validação do cadastro manual.
 *
 * Espelham as restrições CHECK das tabelas em supabase/migrations/0001_schema
 * de propósito: o banco é a autoridade, mas errar só lá dá mensagem críptica.
 */
import { z } from "zod";

import { parseData, parseValor } from "@/lib/importacao/parsers";

/** Aceita o valor digitado em pt-BR ("1.234,56") e devolve number. */
const valorMonetario = z
  .string()
  .trim()
  .min(1, "Informe o valor")
  .transform((texto, ctx) => {
    const numero = parseValor(texto);
    if (numero === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return numero;
  });

/** Aceita dd/mm/aaaa ou aaaa-mm-dd e normaliza para ISO. */
const dataIso = z
  .string()
  .trim()
  .min(1, "Informe a data")
  .transform((valor, ctx) => {
    const iso = parseData(valor);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Use o formato dd/mm/aaaa" });
      return z.NEVER;
    }
    return iso;
  });

const dataIsoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor, ctx) => {
    if (!valor) return undefined;
    const iso = parseData(valor);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Use o formato dd/mm/aaaa" });
      return z.NEVER;
    }
    return iso;
  });

const textoOpcional = z
  .string()
  .trim()
  .max(200, "Máximo de 200 caracteres")
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const esquemaLancamento = z.object({
  data: dataIso,
  tipo: z.enum(["entrada", "saida"], { message: "Selecione entrada ou saída" }),
  // valor > 0 no banco: o sinal é carregado pelo tipo, nunca pelo número
  valor: valorMonetario.refine((v) => v > 0, "O valor deve ser maior que zero"),
  descricao: z.string().trim().min(1, "Informe a descrição").max(200),
  contraparte: textoOpcional,
  documento: textoOpcional,
  planoContaId: textoOpcional,
});

export const esquemaTitulo = z
  .object({
    tipo: z.enum(["pagar", "receber"], { message: "Selecione pagar ou receber" }),
    contraparte: z.string().trim().min(1, "Informe o cliente ou fornecedor").max(200),
    vencimento: dataIso,
    emissao: dataIsoOpcional,
    valor: valorMonetario.refine((v) => v > 0, "O valor deve ser maior que zero"),
    valorPago: z
      .string()
      .trim()
      .optional()
      .transform((texto, ctx) => {
        if (!texto) return 0;
        const numero = parseValor(texto);
        if (numero === null) {
          ctx.addIssue({ code: "custom", message: "Valor pago inválido" });
          return z.NEVER;
        }
        return numero;
      })
      .refine((v) => v >= 0, "O valor pago não pode ser negativo"),
    documento: textoOpcional,
    planoContaId: textoOpcional,
    fixa: z
      .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.undefined()])
      .transform((v) => v === "on" || v === "true"),
    mesesRecorrencia: z
      .string()
      .trim()
      .optional()
      .transform((texto) => {
        if (!texto) return 1;
        const n = Number(texto);
        return Number.isFinite(n) ? n : 1;
      })
      .pipe(z.number().int().min(1).max(24)),
  })
  .refine((t) => t.valorPago <= t.valor, {
    message: "O valor pago não pode superar o valor do título",
    path: ["valorPago"],
  })
  .refine((t) => !t.emissao || t.emissao <= t.vencimento, {
    message: "A emissão não pode ser depois do vencimento",
    path: ["emissao"],
  });

export type DadosLancamento = z.infer<typeof esquemaLancamento>;
export type DadosTitulo = z.infer<typeof esquemaTitulo>;

/** Deriva o status a partir dos valores, como o banco espera. */
export function statusDoTitulo(valor: number, valorPago: number) {
  if (valorPago === 0) return "aberto" as const;
  if (valorPago >= valor) return "pago" as const;
  return "parcial" as const;
}
