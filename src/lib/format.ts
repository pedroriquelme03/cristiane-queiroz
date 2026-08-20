import type { Indicador } from "@/lib/types";
import { parseData } from "@/lib/importacao/parsers";

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

/** Exibe data no padrão dd/mm/aaaa. Aceita ISO ou já em BR. */
export function data(valor: string) {
  const iso = brParaIso(valor) ?? valor.slice(0, 10);
  const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return valor;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

/** Alias explícito do padrão do sistema. */
export function dataBr(valor: string) {
  return data(valor);
}

export function dataCurta(valor: string) {
  return data(valor).slice(0, 5); // dd/mm
}

/** Converte ISO (aaaa-mm-dd) ou Date-like para dd/mm/aaaa. */
export function isoParaBr(valor: string | null | undefined) {
  if (!valor) return "";
  const iso = brParaIso(valor);
  if (!iso) return "";
  const [, ano, mes, dia] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return ano ? `${dia}/${mes}/${ano}` : "";
}

/** Converte dd/mm/aaaa (ou ISO) para aaaa-mm-dd. */
export function brParaIso(valor: string | null | undefined) {
  if (!valor) return null;
  return parseData(valor.trim());
}

export function somenteDigitosData(valor: string) {
  return valor.replace(/\D/g, "");
}

/** Monta máscara progressiva dd/mm/aaaa a partir dos dígitos. */
export function digitosParaBr(digitos: string) {
  const d = digitos.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function competenciaExtenso(iso: string) {
  const normalizado = brParaIso(iso) ?? iso;
  const texto = new Date(`${normalizado}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function mesCurto(iso: string) {
  const normalizado = brParaIso(iso) ?? iso;
  return new Date(`${normalizado}T12:00:00`)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
}

/** Data e hora no padrão dd/mm/aaaa, HH:mm. */
export function dataHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dataParte = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const horaParte = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dataParte}, ${horaParte}`;
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
  const normalizado = brParaIso(iso) ?? iso;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${normalizado}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}
