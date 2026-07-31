import type { AreaDiagnostico } from "@/lib/types";

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
