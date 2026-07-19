/**
 * Conversores para os formatos que aparecem em relatório exportado de ERP
 * brasileiro. São a parte que mais quebra numa importação, então cada caso
 * tratado aqui está documentado com o formato de origem.
 */

/**
 * Datas aceitas:
 *   31/12/2026  ·  31/12/26  ·  31-12-2026  ·  2026-12-31
 *   número de série do Excel (45657) — quando a célula é do tipo data
 *
 * Devolve ISO (aaaa-mm-dd) ou null se não reconhecer.
 */
export function parseData(bruto: unknown): string | null {
  if (bruto == null || bruto === "") return null;

  // O xlsx entrega células de data como Date quando cellDates está ligado
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) {
    return paraIso(bruto);
  }

  // Número de série do Excel: dias desde 30/12/1899
  if (typeof bruto === "number" && bruto > 0 && bruto < 100_000) {
    const base = Date.UTC(1899, 11, 30);
    return paraIso(new Date(base + bruto * 86_400_000));
  }

  const texto = String(bruto).trim();
  if (!texto) return null;

  // ISO, o formato mais fácil
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validar(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // dd/mm/aaaa e variantes com hífen ou ponto.
  // \d{4} vem antes de \d{2} de propósito: a alternância casa a primeira que
  // servir, e na ordem inversa "2026" viraria o ano 20.
  const br = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    let ano = Number(br[3]);
    // Ano com dois dígitos: 90..99 vira 1990..1999, o resto vira 20xx
    if (br[3].length === 2) ano += ano >= 90 ? 1900 : 2000;
    return validar(ano, mes, dia);
  }

  return null;
}

function validar(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita datas que "transbordam", como 31/02
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return paraIso(d);
}

function paraIso(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Valores aceitos:
 *   1.234,56  ·  1234,56  ·  1,234.56  ·  1234.56  ·  R$ 1.234,56
 *   (1.234,56) e -1.234,56 — ambos negativos
 *   1.234,56 D / C — débito e crédito de extrato bancário
 *
 * Devolve number ou null.
 */
export function parseValor(bruto: unknown): number | null {
  if (bruto == null || bruto === "") return null;
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;

  let texto = String(bruto).trim();
  if (!texto) return null;

  // Parênteses são a notação contábil de negativo
  let negativo = /^\(.*\)$/.test(texto);
  if (negativo) texto = texto.slice(1, -1);

  // Sufixo D/C de extrato: D é saída
  const sufixo = texto.match(/\s*([DC])$/i);
  if (sufixo) {
    if (sufixo[1].toUpperCase() === "D") negativo = true;
    texto = texto.slice(0, sufixo.index).trim();
  }

  texto = texto.replace(/R\$|\s/gi, "");
  if (texto.startsWith("-")) {
    negativo = true;
    texto = texto.slice(1);
  }

  // Descobre qual separador é o decimal: o último que aparecer, se tiver
  // 1 ou 2 dígitos depois. "1.234" é mil e duzentos, "1.23" é um e pouco.
  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  const separador = Math.max(ultimaVirgula, ultimoPonto);

  if (separador >= 0) {
    const decimais = texto.length - separador - 1;
    if (decimais >= 1 && decimais <= 2) {
      const inteiro = texto.slice(0, separador).replace(/[.,]/g, "");
      const fracao = texto.slice(separador + 1);
      texto = `${inteiro}.${fracao}`;
    } else {
      // Só separadores de milhar
      texto = texto.replace(/[.,]/g, "");
    }
  }

  if (!/^\d*\.?\d*$/.test(texto) || texto === "" || texto === ".") return null;

  const valor = Number(texto);
  if (!Number.isFinite(valor)) return null;
  return negativo ? -valor : valor;
}

/** Normaliza cabeçalho para comparar: minúsculo, sem acento e sem pontuação. */
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
