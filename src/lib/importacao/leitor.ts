/**
 * Lê o arquivo enviado e devolve uma matriz de células crua, sem interpretar
 * nada. A conversão fica em esquemas.ts, para que a origem (xlsx ou csv) não
 * mude o resto do fluxo.
 *
 * A leitura é feita em duas etapas: `lerArquivo` guarda todas as abas cruas e
 * `montarPlanilha` aplica aba, linha do cabeçalho e linhas ignoradas. Assim o
 * usuário (ou um modelo salvo) troca essas opções sem ler o arquivo de novo.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { normalizar } from "@/lib/importacao/parsers";

export interface AbaBruta {
  nome: string;
  /** Linhas como estão no arquivo, inclusive as vazias. */
  matriz: unknown[][];
  /** Número (1-based) da primeira linha da matriz no arquivo original. */
  primeiraLinha: number;
}

export interface ArquivoBruto {
  abas: AbaBruta[];
}

export interface OpcoesLeitura {
  /** Nome da aba; sem valor (ou inexistente) usa a primeira. */
  aba?: string | null;
  /** Linha (1-based, como no Excel) do cabeçalho; sem valor usa a primeira não vazia. */
  linhaCabecalho?: number | null;
  /** Linhas cuja primeira célula preenchida começa com um destes textos são descartadas. */
  ignorarLinhasQueComecam?: string[];
}

export interface PlanilhaLida {
  cabecalhos: string[];
  linhas: unknown[][];
  /** Número da linha no arquivo original para cada item de `linhas`. */
  numeros: number[];
  /** Aba efetivamente lida e todas as disponíveis (Excel). */
  aba: string;
  abas: string[];
  /** Linha do cabeçalho efetivamente usada (1-based). */
  linhaCabecalho: number;
  /** Quantas linhas foram descartadas pela regra de ignorar. */
  ignoradas: number;
}

const EXTENSOES_EXCEL = [".xlsx", ".xls", ".xlsm", ".ods"];

export function ehExcel(nomeArquivo: string) {
  const nome = nomeArquivo.toLowerCase();
  return EXTENSOES_EXCEL.some((ext) => nome.endsWith(ext));
}

export async function lerArquivo(arquivo: File): Promise<ArquivoBruto> {
  const abas = ehExcel(arquivo.name) ? await lerExcel(arquivo) : await lerCsv(arquivo);
  if (abas.length === 0) throw new Error("O arquivo não tem nenhuma aba.");
  return { abas };
}

const celulaVazia = (c: unknown) => c == null || String(c).trim() === "";
const linhaVazia = (linha: unknown[]) => linha.every(celulaVazia);

export function montarPlanilha(
  bruto: ArquivoBruto,
  opcoes: OpcoesLeitura = {},
): PlanilhaLida {
  const aba = bruto.abas.find((a) => a.nome === opcoes.aba) ?? bruto.abas[0];
  const { matriz, primeiraLinha } = aba;

  let indiceCabecalho: number;
  if (opcoes.linhaCabecalho) {
    indiceCabecalho = opcoes.linhaCabecalho - primeiraLinha;
    if (indiceCabecalho < 0 || indiceCabecalho >= matriz.length) {
      throw new Error(`A aba "${aba.nome}" não tem a linha ${opcoes.linhaCabecalho}.`);
    }
    if (linhaVazia(matriz[indiceCabecalho])) {
      throw new Error(`A linha ${opcoes.linhaCabecalho} está vazia; escolha a linha do cabeçalho.`);
    }
  } else {
    indiceCabecalho = matriz.findIndex((l) => !linhaVazia(l));
    if (indiceCabecalho === -1) throw new Error("A planilha está vazia.");
  }

  const cabecalhos = matriz[indiceCabecalho].map((c, i) =>
    celulaVazia(c) ? `Coluna ${i + 1}` : String(c).trim(),
  );

  const prefixos = (opcoes.ignorarLinhasQueComecam ?? [])
    .map(normalizar)
    .filter(Boolean);

  const linhas: unknown[][] = [];
  const numeros: number[] = [];
  let ignoradas = 0;

  for (let i = indiceCabecalho + 1; i < matriz.length; i += 1) {
    const linha = matriz[i];
    if (linhaVazia(linha)) continue;
    if (prefixos.length) {
      const primeira = normalizar(String(linha.find((c) => !celulaVazia(c))));
      if (prefixos.some((p) => primeira.startsWith(p))) {
        ignoradas += 1;
        continue;
      }
    }
    linhas.push(linha);
    numeros.push(primeiraLinha + i);
  }

  return {
    cabecalhos,
    linhas,
    numeros,
    aba: aba.nome,
    abas: bruto.abas.map((a) => a.nome),
    linhaCabecalho: primeiraLinha + indiceCabecalho,
    ignoradas,
  };
}

async function lerExcel(arquivo: File): Promise<AbaBruta[]> {
  const buffer = await arquivo.arrayBuffer();
  // cellDates entrega células de data como Date em vez do número de série
  const pasta = XLSX.read(buffer, { type: "array", cellDates: true });

  return pasta.SheetNames.map((nome) => {
    const folha = pasta.Sheets[nome];
    // A matriz começa na primeira célula usada (!ref), não necessariamente na A1
    const inicio = folha["!ref"] ? XLSX.utils.decode_range(folha["!ref"]).s.r : 0;
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(folha, {
      header: 1,
      defval: null,
      blankrows: true,
      raw: true,
    });
    return { nome, matriz, primeiraLinha: inicio + 1 };
  });
}

async function lerCsv(arquivo: File): Promise<AbaBruta[]> {
  const texto = await arquivo.text();
  const resultado = Papa.parse<string[]>(texto, {
    // Linhas vazias são mantidas para a numeração bater com o arquivo
    skipEmptyLines: false,
    // delimiter vazio deixa o papaparse detectar ; ou , sozinho — relatório
    // brasileiro costuma usar ponto e vírgula
    delimiter: "",
  });

  if (resultado.errors.length > 0) {
    const grave = resultado.errors.find((e) => e.type === "Delimiter");
    if (grave) throw new Error("Não foi possível identificar o separador do CSV.");
  }

  return [{ nome: arquivo.name, matriz: resultado.data, primeiraLinha: 1 }];
}
