import type { Indicador } from "@/lib/types";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const MOEDA_COMPACTA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function moeda(valor: number) {
  return MOEDA.format(valor);
}

/** Para eixos de grafico e cards estreitos: R$ 1,2 mi */
export function moedaCompacta(valor: number) {
  return MOEDA_COMPACTA.format(valor);
}

export function percentual(valor: number | null, casas = 1) {
  if (valor === null || Number.isNaN(valor)) return "—";
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

export function numero(valor: number) {
  return NUMERO.format(valor);
}

export function data(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

export function dataCurta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function competenciaExtenso(iso: string) {
  const texto = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function mesCurto(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
}

/** Formata o valor de um indicador conforme a unidade dele. */
export function valorIndicador(valor: number, unidade: Indicador["unidade"]) {
  if (unidade === "percentual") return percentual(valor);
  if (unidade === "moeda") return moeda(valor);
  if (unidade === "dias") return `${numero(valor)} dias`;
  return numero(valor);
}

export function cnpj(valor: string) {
  return valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function tamanhoArquivo(bytes: number) {
  const unidades = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${unidades[i]}`;
}

/** Dias entre hoje e a data. Negativo = vencido. */
export function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}
