/**
 * Lê o arquivo enviado e devolve uma matriz de células crua, sem interpretar
 * nada. A conversão fica em esquemas.ts, para que a origem (xlsx ou csv) não
 * mude o resto do fluxo.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface PlanilhaLida {
  cabecalhos: string[];
  linhas: unknown[][];
  /** Nome da aba, quando o arquivo é Excel. */
  aba?: string;
}

const EXTENSOES_EXCEL = [".xlsx", ".xls", ".xlsm", ".ods"];

export function ehExcel(nomeArquivo: string) {
  const nome = nomeArquivo.toLowerCase();
  return EXTENSOES_EXCEL.some((ext) => nome.endsWith(ext));
}

export async function lerArquivo(arquivo: File): Promise<PlanilhaLida> {
  const matriz = ehExcel(arquivo.name)
    ? await lerExcel(arquivo)
    : await lerCsv(arquivo);

  const naoVazias = matriz.filter((linha) =>
    linha.some((celula) => celula != null && String(celula).trim() !== ""),
  );

  if (naoVazias.length === 0) {
    throw new Error("A planilha está vazia.");
  }

  const [cabecalho, ...resto] = naoVazias;
  const cabecalhos = cabecalho.map((c, i) =>
    c == null || String(c).trim() === "" ? `Coluna ${i + 1}` : String(c).trim(),
  );

  return { cabecalhos, linhas: resto };
}

async function lerExcel(arquivo: File): Promise<unknown[][]> {
  const buffer = await arquivo.arrayBuffer();
  // cellDates entrega células de data como Date em vez do número de série
  const pasta = XLSX.read(buffer, { type: "array", cellDates: true });

  const nomeAba = pasta.SheetNames[0];
  if (!nomeAba) throw new Error("O arquivo não tem nenhuma aba.");

  return XLSX.utils.sheet_to_json<unknown[]>(pasta.Sheets[nomeAba], {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
}

async function lerCsv(arquivo: File): Promise<unknown[][]> {
  const texto = await arquivo.text();
  const resultado = Papa.parse<string[]>(texto, {
    skipEmptyLines: "greedy",
    // delimiter vazio deixa o papaparse detectar ; ou , sozinho — relatório
    // brasileiro costuma usar ponto e vírgula
    delimiter: "",
  });

  if (resultado.errors.length > 0) {
    const grave = resultado.errors.find((e) => e.type === "Delimiter");
    if (grave) throw new Error("Não foi possível identificar o separador do CSV.");
  }

  return resultado.data;
}
