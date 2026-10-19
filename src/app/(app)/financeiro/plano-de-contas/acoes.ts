"use server";

import { revalidatePath } from "next/cache";

import { resolverEmpresaAlvo } from "@/lib/autorizacao";
import { PLANO_CONTAS_PADRAO, proximoCodigoConta } from "@/lib/plano-contas-padrao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { GrupoDre, PlanoConta } from "@/lib/types";

export interface EstadoPlanoContas {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

async function contextoEmpresa(formData: FormData) {
  const alvo = await resolverEmpresaAlvo(String(formData.get("empresaId") ?? ""), {
    papeis: ["admin", "cliente"],
    negado: "Seu perfil não pode alterar o plano de contas.",
    semEmpresa: "Selecione uma empresa antes de continuar.",
  });
  if ("erro" in alvo) return alvo;
  if (!supabaseConfigurado || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { erro: "O Supabase não está configurado para gravação." } as const;
  }
  return alvo;
}

function revalidar() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/cadastros", "layout");
  revalidatePath("/cadastros/plano-de-contas");
  revalidatePath("/financeiro/plano-de-contas");
  revalidatePath("/financeiro/contas-a-pagar");
  revalidatePath("/financeiro/contas-a-receber");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/financeiro/dre");
  revalidatePath("/financeiro/orcamento");
  revalidatePath("/financeiro/relatorios", "layout");
}

async function gerarCodigoSequencial(empresaId: string, grupoDre: GrupoDre) {
  const { data, error } = await supabaseAdmin
    .from("plano_contas")
    .select("codigo")
    .eq("empresa_id", empresaId)
    .eq("grupo_dre", grupoDre);

  if (error) return { erro: "Não foi possível gerar o código da classificação." } as const;
  return { codigo: proximoCodigoConta(grupoDre, (data ?? []).map((row) => row.codigo)) } as const;
}

export async function salvarContaPlano(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "") as PlanoConta["tipo"];
  const grupoDre = String(formData.get("grupoDre") ?? "") as GrupoDre;
  const campos: Record<string, string> = {};

  if (!nome) campos.nome = "Informe o nome da conta.";
  if (!["receita", "deducao", "custo", "despesa", "investimento", "nao_operacional"].includes(tipo)) {
    campos.tipo = "Selecione o tipo.";
  }
  if (
    ![
      "receita_bruta",
      "deducoes",
      "custo_variavel",
      "despesa_pessoal",
      "despesa_administrativa",
      "despesa_comercial",
      "despesa_financeira",
      "investimento",
      "nao_operacional",
      "outros",
    ].includes(grupoDre)
  ) {
    campos.grupoDre = "Selecione o grupo da DRE.";
  }
  if (Object.keys(campos).length) return { campos };

  if (id) {
    // Edição: código sequencial permanece; só atualiza nome/tipo/grupo.
    const { error } = await supabaseAdmin
      .from("plano_contas")
      .update({
        nome,
        tipo,
        grupo_dre: grupoDre,
        ativo: true,
      })
      .eq("id", id)
      .eq("empresa_id", contexto.empresaId);
    if (error) return { erro: "Não foi possível atualizar a conta." };
  } else {
    const gerado = await gerarCodigoSequencial(contexto.empresaId, grupoDre);
    if ("erro" in gerado) return { erro: gerado.erro };

    const { error } = await supabaseAdmin.from("plano_contas").insert({
      codigo: gerado.codigo,
      nome,
      tipo,
      grupo_dre: grupoDre,
      ativo: true,
      empresa_id: contexto.empresaId,
    });
    if (error) {
      if (error.code === "23505") {
        // Concorrência rara: tenta um código a mais.
        const retry = await gerarCodigoSequencial(contexto.empresaId, grupoDre);
        if ("erro" in retry) return { erro: retry.erro };
        const segunda = await supabaseAdmin.from("plano_contas").insert({
          codigo: retry.codigo,
          nome,
          tipo,
          grupo_dre: grupoDre,
          ativo: true,
          empresa_id: contexto.empresaId,
        });
        if (segunda.error) {
          return { erro: "Não foi possível salvar a conta (código em uso)." };
        }
      } else {
        return { erro: "Não foi possível salvar a conta." };
      }
    }
  }

  revalidar();
  return { ok: true };
}

export async function carregarPlanoContasPadrao(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };

  const registros = PLANO_CONTAS_PADRAO.map((conta) => ({
    empresa_id: contexto.empresaId,
    codigo: conta.codigo,
    nome: conta.nome,
    tipo: conta.tipo,
    grupo_dre: conta.grupoDre,
    ativo: true,
  }));

  const { error } = await supabaseAdmin
    .from("plano_contas")
    .upsert(registros, { onConflict: "empresa_id,codigo" });

  if (error) return { erro: "Não foi possível carregar o plano padrão." };
  revalidar();
  return { ok: true };
}

export async function desativarContaPlano(
  _anterior: EstadoPlanoContas,
  formData: FormData,
): Promise<EstadoPlanoContas> {
  const contexto = await contextoEmpresa(formData);
  if ("erro" in contexto) return { erro: contexto.erro };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { erro: "Conta não encontrada." };

  const { error } = await supabaseAdmin
    .from("plano_contas")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", contexto.empresaId);

  if (error) return { erro: "Não foi possível remover a conta." };
  revalidar();
  return { ok: true };
}
