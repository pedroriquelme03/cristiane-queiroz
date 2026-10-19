/**
 * Confere o adaptador do Extrato Mensal contra PDFs reais.
 * uso: npx tsx scripts/verifica-extrato.mts <arquivo.pdf> [...]
 * Sem argumentos, procura os exemplos em ../importacao/cataratas-park.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { lerExtratoMensal } from "@/lib/importacao/adaptadores/extrato-mensal";
import { agruparEmLinhas, type PaginaPdf } from "@/lib/importacao/pdf";

const exemplos = path.resolve(import.meta.dirname, "../../importacao/cataratas-park");
const arquivos = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Hotel_Extrato Mensal 05-2026.pdf", "Restaurante_Extrato Mensal 05-2026.pdf"]
      .map((n) => path.join(exemplos, n))
      .filter(existsSync);

if (arquivos.length === 0) {
  console.log("Nenhum PDF de exemplo encontrado; informe o caminho.");
  process.exit(0);
}

let falhas = 0;
for (const arquivo of arquivos) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(arquivo)) }).promise;
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    paginas.push(
      agruparEmLinhas(
        items.flatMap((i) => ("str" in i ? [{ x: i.transform[4], y: i.transform[5], texto: i.str }] : [])),
      ),
    );
  }

  const e = lerExtratoMensal(paginas);
  const rubricas = e.funcionarios.reduce((s, f) => s + f.rubricas.length, 0);
  console.log(`\n== ${path.basename(arquivo)}`);
  console.log(`empresa: ${e.empresa.codigo} - ${e.empresa.nome} (${e.empresa.cnpj})  competência: ${e.competencia}`);
  console.log(`funcionários: ${e.funcionarios.length}  rubricas lidas: ${rubricas}  resumo: ${e.resumoRubricas.length}`);
  console.log(`totais: P ${e.totais.proventos}  D ${e.totais.descontos}  L ${e.totais.liquido}`);
  console.log(`FGTS: ${e.encargos["Valor do FGTS"]}  Total INSS: ${e.encargos["Total INSS"]}  empregados: ${e.situacoes["No. Empregados"]}`);
  const exemplo = e.funcionarios[0];
  console.log(`1º: ${exemplo?.matricula} ${exemplo?.nome} | ${exemplo?.cargo} | depto ${exemplo?.departamento} | ${exemplo?.rubricas.length} rubricas | líquido ${exemplo?.liquido}`);
  if (e.situacoes["No. Empregados"] !== e.funcionarios.length) {
    e.avisos.push(`Situações informa ${e.situacoes["No. Empregados"]} empregados, foram lidos ${e.funcionarios.length}.`);
  }
  if (e.avisos.length) {
    falhas += e.avisos.length;
    for (const a of e.avisos) console.log(`AVISO ${a}`);
  } else {
    console.log("ok   todos os totais conferem");
  }
}

console.log(falhas === 0 ? "\nEXTRATOS CONFEREM" : `\n${falhas} AVISO(S)`);
process.exit(falhas === 0 ? 0 : 1);
