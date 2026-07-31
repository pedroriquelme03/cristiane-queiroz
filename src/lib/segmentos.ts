import type { Segmento } from "@/lib/types";

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  geral: "Geral",
  hotelaria: "Hotelaria",
  comercio: "Comércio",
  servicos: "Serviços",
  industria: "Indústria",
  alimentacao: "Alimentação",
};

export const SEGMENTOS_CADASTRO = [
  { valor: "hotelaria", rotulo: ROTULO_SEGMENTO.hotelaria },
  { valor: "comercio", rotulo: ROTULO_SEGMENTO.comercio },
  { valor: "servicos", rotulo: ROTULO_SEGMENTO.servicos },
  { valor: "industria", rotulo: ROTULO_SEGMENTO.industria },
  { valor: "alimentacao", rotulo: ROTULO_SEGMENTO.alimentacao },
] satisfies { valor: Exclude<Segmento, "geral">; rotulo: string }[];
