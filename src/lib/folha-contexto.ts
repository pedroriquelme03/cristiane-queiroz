/**
 * Monta o contexto de cálculo da folha a partir da configuração salva (ou da
 * congelada no fechamento). Puro: usado no servidor e no navegador.
 */
import type { ApuracaoUnidade, ConfigFolha } from "@/lib/dados-folha";
import {
  chaveColaborador,
  chaveSetor,
  encargosDoExtrato,
  type ColunaRubrica,
  type ContextoCalculo,
} from "@/lib/folha-analitica";

export function montarContexto(
  config: ConfigFolha,
  apuracoes: Pick<ApuracaoUnidade, "id" | "encargos">[],
): ContextoCalculo {
  return {
    colunas: new Map<string, ColunaRubrica | null | undefined>(
      config.rubricas.map((r) => [`${r.tipo}:${r.codigo}`, r.coluna]),
    ),
    encargosPorUnidade: new Map(Object.entries(config.encargos)),
    // Unidade sem alíquota cadastrada: usa as deduzidas do próprio relatório
    encargosPorApuracao: new Map(apuracoes.map((a) => [a.id, encargosDoExtrato(a.encargos)])),
    setores: new Map(config.setores.map((s) => [chaveSetor(s.unidadeId, s.codigo), s.nome])),
    cadastros: new Map(
      config.cadastros.map((c) => [
        chaveColaborador(c.unidadeId, c.matricula),
        { escala: c.escala, jornadaSemanal: c.jornadaSemanal, setor: c.setor },
      ]),
    ),
  };
}
