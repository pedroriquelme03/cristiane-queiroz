/**
 * Extrai o texto de um PDF agrupado em linhas, preservando a posição x de cada
 * trecho. Relatórios de folha impressos em PDF têm colunas lado a lado
 * (proventos | descontos), e é a posição que permite separar uma da outra.
 */

export interface TrechoPdf {
  x: number;
  texto: string;
  /** Largura do trecho; permite colar pedaços que o PDF quebrou ("Inde" "fi" "nido"). */
  largura?: number;
}

export interface LinhaPdf {
  y: number;
  trechos: TrechoPdf[];
}

export type PaginaPdf = LinhaPdf[];

/** Trechos com y a até esta distância são considerados a mesma linha. */
const TOLERANCIA_Y = 2;

export function agruparEmLinhas(
  itens: { x: number; y: number; texto: string; largura?: number }[],
): PaginaPdf {
  const linhas: LinhaPdf[] = [];
  for (const item of itens) {
    if (!item.texto.trim()) continue;
    const y = Math.round(item.y);
    let linha = linhas.find((l) => Math.abs(l.y - y) <= TOLERANCIA_Y);
    if (!linha) {
      linha = { y, trechos: [] };
      linhas.push(linha);
    }
    linha.trechos.push({ x: Math.round(item.x), texto: item.texto.trim(), largura: item.largura });
  }
  // PDF conta y de baixo para cima: maior y = mais acima na página
  linhas.sort((a, b) => b.y - a.y);
  for (const linha of linhas) linha.trechos.sort((a, b) => a.x - b.x);
  return linhas;
}

/** Lê o PDF no navegador. O pdfjs é carregado sob demanda (é pesado). */
export async function lerPdf(arquivo: File): Promise<PaginaPdf[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
    .promise;
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const pagina = await doc.getPage(n);
    const { items } = await pagina.getTextContent();
    paginas.push(
      agruparEmLinhas(
        items.flatMap((item) =>
          "str" in item
            ? [{ x: item.transform[4], y: item.transform[5], texto: item.str, largura: item.width }]
            : [],
        ),
      ),
    );
  }
  await doc.destroy();
  return paginas;
}
