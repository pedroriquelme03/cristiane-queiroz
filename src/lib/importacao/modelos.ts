/**
 * Modelos de importação: guardam como ler o relatório de um cliente para que a
 * próxima importação do mesmo layout não precise ser configurada de novo.
 *
 * O mapeamento é salvo pelo nome do cabeçalho (normalizado), nunca pelo índice:
 * relatórios de ERP mudam a ordem das colunas entre versões com frequência.
 */
import { z } from "zod";

import type { Campo, TipoImportacao } from "@/lib/importacao/esquemas";
import { montarPlanilha, type ArquivoBruto, type PlanilhaLida } from "@/lib/importacao/leitor";
import { normalizar } from "@/lib/importacao/parsers";

export const configModeloSchema = z.object({
  aba: z.string().trim().max(120).nullable().default(null),
  linhaCabecalho: z.number().int().min(1).max(10_000).nullable().default(null),
  ignorarLinhasQueComecam: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .default([]),
  mapa: z.record(z.string().max(40), z.string().max(200).nullable()).default({}),
});

export type ConfigModelo = z.infer<typeof configModeloSchema>;

export interface ModeloImportacao {
  id: string;
  /** null = modelo global, disponível para todas as empresas. */
  empresaId: string | null;
  tipo: TipoImportacao;
  nome: string;
  config: ConfigModelo;
  assinatura: string[];
}

/** Cabeçalhos genéricos ("Coluna 3") não identificam layout nenhum. */
const ehCabecalhoGerado = (c: string) => /^coluna \d+$/.test(c);

export function assinaturaDe(cabecalhos: string[]): string[] {
  return [...new Set(cabecalhos.map(normalizar).filter((c) => c && !ehCabecalhoGerado(c)))];
}

/** Converte o mapeamento por índice (do assistente) em mapeamento por cabeçalho. */
export function mapaParaConfig(
  cabecalhos: string[],
  mapa: Record<string, number | null>,
): ConfigModelo["mapa"] {
  return Object.fromEntries(
    Object.entries(mapa).map(([campo, indice]) => [
      campo,
      indice === null ? null : normalizar(cabecalhos[indice] ?? ""),
    ]),
  );
}

/**
 * Aplica o mapeamento do modelo sobre a sugestão automática. Campo que o modelo
 * marcou como "não importar" fica nulo; campo cuja coluna sumiu do arquivo
 * mantém a sugestão, para o usuário revisar.
 */
export function aplicarMapaDoModelo(
  cabecalhos: string[],
  campos: Campo[],
  sugestao: Record<string, number | null>,
  modelo: ConfigModelo,
): Record<string, number | null> {
  const normalizados = cabecalhos.map(normalizar);
  const resultado: Record<string, number | null> = {};
  const usados = new Set<number>();
  const pendentes: Campo[] = [];

  for (const campo of campos) {
    const alvo = modelo.mapa[campo.chave];
    if (alvo === null) {
      resultado[campo.chave] = null;
      continue;
    }
    const indice =
      alvo === undefined ? -1 : normalizados.findIndex((c, i) => c === alvo && !usados.has(i));
    if (indice === -1) {
      pendentes.push(campo);
    } else {
      resultado[campo.chave] = indice;
      usados.add(indice);
    }
  }

  // Uma coluna fica com um campo só: o do modelo vence a sugestão
  for (const campo of pendentes) {
    const sugerido = sugestao[campo.chave] ?? null;
    resultado[campo.chave] = sugerido !== null && !usados.has(sugerido) ? sugerido : null;
    if (resultado[campo.chave] !== null) usados.add(sugerido as number);
  }

  return resultado;
}

/** Fração da assinatura do modelo presente nos cabeçalhos (0 a 1). */
export function aderencia(modelo: ModeloImportacao, planilha: PlanilhaLida): number {
  if (modelo.assinatura.length === 0) return 0;
  const presentes = new Set(assinaturaDe(planilha.cabecalhos));
  const acertos = modelo.assinatura.filter((c) => presentes.has(c)).length;
  return acertos / modelo.assinatura.length;
}

/** Aderência mínima para aplicar um modelo sem o usuário escolher. */
export const ADERENCIA_MINIMA = 0.8;

/**
 * Procura, entre os modelos do tipo, o que melhor reconhece o arquivo. Cada
 * modelo é testado com as próprias opções de leitura (aba e cabeçalho), já que
 * é justamente isso que muda de um relatório para outro. Modelos da empresa
 * vencem os globais em caso de empate.
 */
export function detectarModelo(
  bruto: ArquivoBruto,
  modelos: ModeloImportacao[],
  tipo: TipoImportacao,
): { modelo: ModeloImportacao; planilha: PlanilhaLida } | null {
  let melhor: { modelo: ModeloImportacao; planilha: PlanilhaLida; nota: number } | null = null;

  for (const modelo of modelos) {
    if (modelo.tipo !== tipo) continue;
    let planilha: PlanilhaLida;
    try {
      planilha = montarPlanilha(bruto, modelo.config);
    } catch {
      continue;
    }
    const nota = aderencia(modelo, planilha) + (modelo.empresaId ? 0.001 : 0);
    if (nota >= ADERENCIA_MINIMA && (!melhor || nota > melhor.nota)) {
      melhor = { modelo, planilha, nota };
    }
  }

  return melhor ? { modelo: melhor.modelo, planilha: melhor.planilha } : null;
}
