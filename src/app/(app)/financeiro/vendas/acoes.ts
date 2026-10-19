"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const RESUMOS = ["categoria", "departamento", "data", "usuario", "produto", "familia"] as const;

const itemSchema = z.object({
  nome: z.string().min(1).max(200),
  quantidade: z.number().finite(),
  valor: z.number().finite(),
});

const relatorioSchema = z.object({
  arquivoNome: z.string().min(1).max(255),
  origem: z.string().trim().min(1, "Informe a origem (ex.: Restaurante Ipê).").max(80),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Não foi possível identificar o mês do relatório."),
  periodo: z
    .object({
      inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .nullable(),
  resumos: z.object(
    Object.fromEntries(RESUMOS.map((r) => [r, z.array(itemSchema).max(5000)])) as Record<
      (typeof RESUMOS)[number],
      z.ZodArray<typeof itemSchema>
    >,
  ),
  totais: z.record(z.string(), z.object({ quantidade: z.number().finite(), valor: z.number().finite() })),
});

async function contexto(empresaIdInformada: string) {
  const alvo = await resolverEmpresaAlvo(empresaIdInformada, {
    papeis: ["admin", "cliente"],
    negado: "Seu perfil não pode importar relatórios de vendas.",
    semEmpresa: "Selecione uma empresa antes de continuar.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

const tabelaAusente = (m: string | undefined) => /vendas_relatorios/i.test(m ?? "");

export async function importarRelatorioVendas(
  empresaIdInformada: string,
  entrada: unknown,
): Promise<Resultado<{ competencia: string }>> {
  const dados = relatorioSchema.safeParse(entrada);
  if (!dados.success) return { ok: false, erro: dados.error.issues[0]?.message ?? "Relatório inválido." };
  const r = dados.data;

  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  // O total do produto é o faturamento; os outros resumos são cortes do mesmo número
  const total = r.totais.produto ?? r.totais.categoria ?? { quantidade: 0, valor: 0 };
  const competencia = `${r.competencia}-01`;

  const { error } = await supabaseAdmin.from("vendas_relatorios").upsert(
    {
      empresa_id: alvo.empresaId,
      competencia,
      origem: r.origem,
      arquivo_nome: r.arquivoNome,
      periodo_inicio: r.periodo?.inicio ?? null,
      periodo_fim: r.periodo?.fim ?? null,
      total_valor: total.valor,
      total_quantidade: total.quantidade,
      resumos: r.resumos,
      importado_por: alvo.sessao.usuarioId || null,
    },
    { onConflict: "empresa_id,competencia,origem" },
  );

  if (error) {
    if (tabelaAusente(error.message)) {
      return { ok: false, erro: "A tabela de vendas ainda não existe no banco (migration 0024)." };
    }
    return { ok: false, erro: "Não foi possível gravar o relatório de vendas." };
  }

  revalidatePath("/financeiro/vendas");
  return { ok: true, competencia };
}

export async function excluirRelatorioVendas(
  empresaIdInformada: string,
  id: string,
): Promise<Resultado> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, erro: "Relatório não encontrado." };
  const alvo = await contexto(empresaIdInformada);
  if ("erro" in alvo) return { ok: false, erro: alvo.erro };

  const { error, count } = await supabaseAdmin
    .from("vendas_relatorios")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("empresa_id", alvo.empresaId);
  if (error) return { ok: false, erro: "Não foi possível excluir o relatório." };
  if (!count) return { ok: false, erro: "Relatório não encontrado." };

  revalidatePath("/financeiro/vendas");
  return { ok: true };
}
