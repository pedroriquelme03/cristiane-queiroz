/**
 * Exportação da tabela analítica filtrada — Excel (.xlsx) e PDF (impressão) —
 * com a mesma estrutura da tela: grupos de colunas, subtotais por setor,
 * totais por unidade e total consolidado.
 */
import * as XLSX from "xlsx";

import type { ColunaTabela } from "@/components/folha/colunas-tabela";
import { ROTULO_GRUPO } from "@/components/folha/colunas-tabela";
import type { UnidadeFolha } from "@/lib/dados-folha";
import type { GrupoUnidade, Totais } from "@/lib/folha-analitica";
import { moeda } from "@/lib/format";

export interface MetaExportacao {
  titulo: string;
  filtros: string;
  nomeArquivo: string;
  unidades: UnidadeFolha[];
  /** "agregado": só subtotais, sem linhas de funcionário. */
  semIndividuais: boolean;
}

type Celula = string | number | null;
type TipoLinha = "cabecalho" | "unidade" | "funcionario" | "subtotal" | "total-unidade" | "total-geral";

interface LinhaExport {
  tipo: TipoLinha;
  celulas: Celula[];
}

function montarLinhas(grupos: GrupoUnidade[], colunas: ColunaTabela[], meta: MetaExportacao, geral: Totais) {
  const nomeUnidade = (id: string | null) =>
    id ? meta.unidades.find((u) => u.id === id)?.nome ?? "Unidade" : "Sem unidade";
  const linhaTotal = (tipo: TipoLinha, rotulo: string, t: Totais): LinhaExport => ({
    tipo,
    celulas: colunas.map((c, i) => (i === 0 ? rotulo : c.total ? c.total(t) : null)),
  });

  const linhas: LinhaExport[] = [];
  for (const g of grupos) {
    linhas.push({ tipo: "unidade", celulas: [nomeUnidade(g.unidadeId).toUpperCase(), ...colunas.slice(1).map(() => null)] });
    for (const s of g.setores) {
      if (!meta.semIndividuais) {
        for (const l of s.linhas) {
          linhas.push({ tipo: "funcionario", celulas: colunas.map((c) => c.valor(l)) });
        }
      }
      linhas.push(linhaTotal("subtotal", `Subtotal ${s.nome} (${s.totais.funcionarios})`, s.totais));
    }
    linhas.push(linhaTotal("total-unidade", `Total ${nomeUnidade(g.unidadeId)} (${g.totais.funcionarios})`, g.totais));
  }
  linhas.push(linhaTotal("total-geral", `Total consolidado (${geral.funcionarios})`, geral));
  return linhas;
}

export function exportarExcel(grupos: GrupoUnidade[], colunas: ColunaTabela[], meta: MetaExportacao, geral: Totais) {
  const linhas = montarLinhas(grupos, colunas, meta, geral);

  // Linha 1: título; 2: filtros; 4: grupos de colunas; 5: rótulos
  const gruposLinha: Celula[] = colunas.map((c, i) =>
    i === 0 || colunas[i - 1].grupo !== c.grupo ? ROTULO_GRUPO[c.grupo] : null,
  );
  const matriz: Celula[][] = [
    [meta.titulo],
    [meta.filtros],
    [],
    gruposLinha,
    colunas.map((c) => c.rotulo),
    ...linhas.map((l) => l.celulas.map((v) => (v === "—" ? "" : v))),
  ];
  const planilha = XLSX.utils.aoa_to_sheet(matriz);

  // Mescla o rótulo de cada grupo sobre as suas colunas
  const merges: XLSX.Range[] = [];
  let inicio = 0;
  colunas.forEach((c, i) => {
    const ultimo = i === colunas.length - 1 || colunas[i + 1].grupo !== c.grupo;
    if (ultimo) {
      if (i > inicio) merges.push({ s: { r: 3, c: inicio }, e: { r: 3, c: i } });
      inicio = i + 1;
    }
  });
  planilha["!merges"] = merges;

  // Formato de moeda nas colunas numéricas
  const primeiraLinhaDados = 5;
  colunas.forEach((c, ci) => {
    if (c.tipo !== "moeda") return;
    for (let r = primeiraLinhaDados; r < matriz.length; r += 1) {
      const ref = XLSX.utils.encode_cell({ r, c: ci });
      const cel = planilha[ref];
      if (cel && typeof cel.v === "number") cel.z = '#,##0.00;[Red]-#,##0.00';
    }
  });
  planilha["!cols"] = colunas.map((c) => ({ wch: c.tipo === "texto" ? Math.max(12, c.rotulo.length + 2) : 14 }));
  planilha["!freeze"] = { xSplit: 0, ySplit: primeiraLinhaDados };

  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, planilha, "Apuração da folha");
  XLSX.writeFile(pasta, `${meta.nomeArquivo}.xlsx`);
}

const escapar = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exportarPdf(grupos: GrupoUnidade[], colunas: ColunaTabela[], meta: MetaExportacao, geral: Totais) {
  const linhas = montarLinhas(grupos, colunas, meta, geral);
  const formatar = (c: ColunaTabela, v: Celula) => {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return c.tipo === "moeda" ? moeda(v) : v.toLocaleString("pt-BR");
    return String(v);
  };

  const gruposHtml: string[] = [];
  let inicio = 0;
  colunas.forEach((c, i) => {
    const ultimo = i === colunas.length - 1 || colunas[i + 1].grupo !== c.grupo;
    if (ultimo) {
      gruposHtml.push(`<th colspan="${i - inicio + 1}" class="grupo">${escapar(ROTULO_GRUPO[c.grupo])}</th>`);
      inicio = i + 1;
    }
  });

  const corpo = linhas
    .map(
      (l) =>
        `<tr class="${l.tipo}">${l.celulas
          .map((v, i) => {
            const c = colunas[i];
            const num = c.tipo !== "texto";
            return `<td class="${num ? "num" : ""}">${escapar(formatar(c, v))}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapar(meta.titulo)}</title>
<style>
  @page { size: A3 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 7px; color: #111; margin: 0; }
  h1 { font-size: 13px; margin: 0 0 4px; }
  p { color: #555; margin: 0 0 8px; font-size: 9px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 2px 3px; white-space: nowrap; }
  th { background: #f3f4f6; font-weight: 600; }
  th.grupo { background: #e5e7eb; text-align: center; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.unidade td { background: #111827; color: #fff; font-weight: 700; }
  tr.subtotal td { background: #f3f4f6; font-weight: 600; }
  tr.total-unidade td { background: #e5e7eb; font-weight: 700; }
  tr.total-geral td { background: #d1d5db; font-weight: 700; }
  thead { display: table-header-group; }
</style></head>
<body>
  <h1>${escapar(meta.titulo)}</h1>
  <p>${escapar(meta.filtros)}</p>
  <table>
    <thead><tr>${gruposHtml.join("")}</tr><tr>${colunas.map((c) => `<th>${escapar(c.rotulo)}</th>`).join("")}</tr></thead>
    <tbody>${corpo}</tbody>
  </table>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
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
