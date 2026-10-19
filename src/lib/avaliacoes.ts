import type { AreaDiagnostico, ProgressoDiagnostico } from "@/lib/types";

export type TipoAvaliacao = "diagnostico" | "maturidade";

export const AREAS_AVALIACAO: { id: AreaDiagnostico; rotulo: string }[] = [
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "compras", rotulo: "Compras" },
  { id: "estoque", rotulo: "Estoque" },
  { id: "comercial", rotulo: "Comercial" },
  { id: "rh", rotulo: "RH" },
  { id: "processos", rotulo: "Processos" },
  { id: "tecnologia", rotulo: "Tecnologia" },
  { id: "gestao", rotulo: "Gestão" },
];

export const ROTULO_AREA = Object.fromEntries(
  AREAS_AVALIACAO.map((area) => [area.id, area.rotulo]),
) as Record<AreaDiagnostico, string>;

/** Andamento da execução (não é a nota de avaliação). */
export const PROGRESSO_DIAGNOSTICO: {
  valor: ProgressoDiagnostico;
  rotulo: string;
}[] = [
  { valor: 0, rotulo: "Não iniciado (0%)" },
  { valor: 30, rotulo: "Iniciado (30%)" },
  { valor: 50, rotulo: "Em andamento (50%)" },
  { valor: 100, rotulo: "Concluído (100%)" },
];

export const ROTULO_PROGRESSO_DIAGNOSTICO: Record<ProgressoDiagnostico, string> = {
  0: "Não iniciado",
  30: "Iniciado",
  50: "Em andamento",
  100: "Concluído",
};
