/**
 * Confere o adaptador do relatório de vendas contra PDFs reais.
 * uso: npx tsx scripts/verifica-vendas.mts <arquivo.pdf> [...]
 * Sem argumentos, procura os exemplos em ../importacao/cataratas-park.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { lerRelatorioVendas, ROTULO_RESUMO, type ResumoVendas } from "@/lib/importacao/adaptadores/relatorio-vendas";
import { agruparEmLinhas, type PaginaPdf } from "@/lib/importacao/pdf";

const exemplos = path.resolve(import.meta.dirname, "../../importacao/cataratas-park");
const arquivos = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Receita Ipê 01-2026.pdf", "Rel. Hospedagem cataratas.pdf"].map((n) => path.join(exemplos, n)).filter(existsSync);

if (arquivos.length === 0) {
  console.log("Nenhum PDF de exemplo encontrado; informe o caminho.");
  process.exit(0);
}

const mostrar = process.env.MOSTRAR as ResumoVendas | undefined;
let falhas = 0;
for (const arquivo of arquivos) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(arquivo)) }).promise;
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    paginas.push(
      agruparEmLinhas(
        items.flatMap((i) =>
          "str" in i ? [{ x: i.transform[4], y: i.transform[5], texto: i.str, largura: i.width }] : [],
        ),
      ),
    );
  }

  const r = lerRelatorioVendas(paginas);
  console.log(`\n== ${path.basename(arquivo)}  competência ${r.competencia}  período ${r.periodo?.inicio} a ${r.periodo?.fim}`);
  for (const resumo of Object.keys(r.resumos) as ResumoVendas[]) {
    const t = r.totais[resumo];
    console.log(`${ROTULO_RESUMO[resumo].padEnd(18)} ${String(r.resumos[resumo].length).padStart(4)} itens   total ${t?.valor} (${t?.quantidade} un.)`);
  }
  for (const item of r.resumos[mostrar ?? "departamento"]) console.log(`   ${item.nome} | ${item.quantidade} | ${item.valor}`);
  if (r.avisos.length) {
    falhas += r.avisos.length;
    for (const a of r.avisos) console.log(`AVISO ${a}`);
  } else {
    console.log("ok   todos os resumos fecham com o total impresso");
  }
}

console.log(falhas === 0 ? "\nRELATÓRIOS CONFEREM" : `\n${falhas} AVISO(S)`);
process.exit(falhas === 0 ? 0 : 1);
