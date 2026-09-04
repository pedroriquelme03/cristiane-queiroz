/**
 * Validação do conteúdo da página /bio (link na bio), editado no admin.
 * As listas de serviços e links chegam como JSON (string) e são validadas aqui.
 */
import { z } from "zod";

const servico = z.object({
  icone: z.string().trim().min(1).max(40).default("compass"),
  titulo: z.string().trim().min(1, "Informe o título do serviço").max(80),
  texto: z.string().trim().max(120).default(""),
  tipo: z.enum(["whatsapp", "url"]).default("whatsapp"),
  valor: z.string().trim().min(1, "Informe a mensagem ou o link do serviço").max(500),
});

const link = z.object({
  icone: z.string().trim().min(1).max(40).default("globe"),
  titulo: z.string().trim().min(1, "Informe o título do link").max(80),
  texto: z.string().trim().max(120).default(""),
  url: z.string().trim().min(1, "Informe o link").max(500),
});

/** Lista que chega como string JSON vinda de um campo hidden do formulário. */
const listaJson = <T extends z.ZodTypeAny>(item: T, rotulo: string) =>
  z
    .string()
    .optional()
    .transform((texto, ctx): z.infer<T>[] => {
      if (!texto) return [];
      let bruto: unknown;
      try {
        bruto = JSON.parse(texto);
      } catch {
        ctx.addIssue({ code: "custom", message: `Não foi possível ler ${rotulo}.` });
        return z.NEVER;
      }
      const analise = z.array(item).safeParse(bruto);
      if (!analise.success) {
        ctx.addIssue({ code: "custom", message: `Confira os itens de ${rotulo}.` });
        return z.NEVER;
      }
      return analise.data;
    });

export const esquemaBio = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(80),
  subtitulo: z.string().trim().max(80).default(""),
  tagline: z.string().trim().max(200).default(""),
  whatsapp: z
    .string()
    .trim()
    .min(1, "Informe o WhatsApp")
    .transform((texto, ctx) => {
      const digitos = texto.replace(/\D/g, "");
      if (digitos.length < 10 || digitos.length > 15) {
        ctx.addIssue({ code: "custom", message: "WhatsApp inválido (use DDI+DDD+número)." });
        return z.NEVER;
      }
      return digitos;
    }),
  fotoUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  ativo: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
  servicos: listaJson(servico, "os serviços"),
  links: listaJson(link, "os links"),
});

export type EntradaBio = z.infer<typeof esquemaBio>;
