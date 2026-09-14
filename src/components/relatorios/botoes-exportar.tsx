"use client";

import { FileDown, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

import { data as formatarData, moeda } from "@/lib/format";

export type TipoColunaRelatorio = "texto" | "moeda" | "data" | "numero";

export type ColunaRelatorio = {
  chave: string;
  rotulo: string;
  tipo?: TipoColunaRelatorio;
};

export type LinhaRelatorio = Record<string, string | number | null | undefined>;

export type FolhaRelatorio = {
  nome: string;
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
};

function valorCelula(
  valor: LinhaRelatorio[string],
  tipo: TipoColunaRelatorio = "texto",
  paraExcel = false,
) {
  if (valor == null || valor === "") return paraExcel ? "" : "—";
  if (tipo === "moeda") {
    const numero = typeof valor === "number" ? valor : Number(valor);
    return paraExcel ? numero : moeda(numero);
  }
  if (tipo === "numero") {
    return typeof valor === "number" ? valor : Number(valor);
  }
  if (tipo === "data") {
    return formatarData(String(valor));
  }
  return String(valor);
}

function escaparHtml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlDaFolha(folha: FolhaRelatorio) {
  const cabecalho = folha.colunas
    .map((coluna) => {
      const direita = coluna.tipo === "moeda" || coluna.tipo === "numero";
      return `<th class="${direita ? "num" : ""}">${escaparHtml(coluna.rotulo)}</th>`;
    })
    .join("");

  const corpo = folha.linhas
    .map((linha) => {
      const celulas = folha.colunas
        .map((coluna) => {
          const direita = coluna.tipo === "moeda" || coluna.tipo === "numero";
          const texto = String(valorCelula(linha[coluna.chave], coluna.tipo ?? "texto"));
          return `<td class="${direita ? "num" : ""}">${escaparHtml(texto)}</td>`;
        })
        .join("");
      return `<tr>${celulas}</tr>`;
    })
    .join("");

  return `
    <h2>${escaparHtml(folha.nome)}</h2>
    <table>
      <thead><tr>${cabecalho}</tr></thead>
      <tbody>${corpo || `<tr><td colspan="${folha.colunas.length}">Nenhum registro no filtro aplicado.</td></tr>`}</tbody>
    </table>
  `;
}

function imprimirHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  window.setTimeout(() => iframe.remove(), 1500);
}

export function BotoesExportar({
  titulo,
  resumoFiltros,
  nomeArquivo,
  folhas,
}: {
  titulo: string;
  resumoFiltros: string;
  nomeArquivo: string;
  folhas: FolhaRelatorio[];
}) {
  function exportarExcel() {
    const pasta = XLSX.utils.book_new();
    for (const folha of folhas) {
      const matriz = [
        folha.colunas.map((coluna) => coluna.rotulo),
        ...folha.linhas.map((linha) =>
          folha.colunas.map((coluna) => valorCelula(linha[coluna.chave], coluna.tipo ?? "texto", true)),
        ),
      ];
      const planilha = XLSX.utils.aoa_to_sheet(matriz);
      XLSX.utils.book_append_sheet(pasta, planilha, folha.nome.slice(0, 31));
    }
    XLSX.writeFile(pasta, `${nomeArquivo}.xlsx`);
  }

  function exportarPdf() {
    const secoes = folhas.map(htmlDaFolha).join("");
    imprimirHtml(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(titulo)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { color: #555; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { font-size: 11px; color: #555; font-weight: 600; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <h1>${escaparHtml(titulo)}</h1>
  <p>${escaparHtml(resumoFiltros)}</p>
  ${secoes}
</body>
</html>`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportarPdf}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-brand/50"
      >
        <FileDown className="size-3.5" aria-hidden />
        Exportar PDF
      </button>
      <button
        type="button"
        onClick={exportarExcel}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90"
      >
        <FileSpreadsheet className="size-3.5" aria-hidden />
        Exportar Excel
      </button>
    </div>
  );
}
