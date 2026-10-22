/**
 * Confere a apuração analítica (classificação, encargos, provisões, DRE)
 * contra Extratos Mensais reais.
 * uso: npx tsx scripts/verifica-folha-analitica.mts <extrato.pdf> [...]
 * Sem argumentos, procura os exemplos em ../importacao/cataratas-park.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  calcularLinha,
  classificar,
  conferir,
  encargosDoExtrato,
  emprestimos,
  lancamentosDre,
  totalizar,
  type ContextoCalculo,
  type FuncionarioAnalitico,
} from "@/lib/folha-analitica";
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
const falha = (msg: string) => {
  falhas += 1;
  console.log(`FALHA ${msg}`);
};
const igual = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

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
  const apuracaoId = path.basename(arquivo);
  const config = encargosDoExtrato(e.encargos);
  const ctx: ContextoCalculo = {
    colunas: new Map(),
    encargosPorUnidade: new Map(),
    encargosPorApuracao: new Map([[apuracaoId, config]]),
    setores: new Map(),
    cadastros: new Map(),
  };

  const funcionarios: FuncionarioAnalitico[] = e.funcionarios.map((f, i) => ({
    ...f,
    id: String(i),
    apuracaoId,
    unidadeId: null,
    cpf: null,
  }));
  const linhas = funcionarios.map((f) => calcularLinha(f, ctx));
  const t = totalizar(linhas);

  console.log(`\n== ${apuracaoId}  (${e.empresa.nome})`);
  console.log(
    `alíquotas do extrato: INSS ${config.inssEmpresa}%  RAT ${config.rat}%  terceiros ${config.terceiros}%  regime ${config.regime ?? "—"}`,
  );

  // Toda rubrica tem coluna reconhecida
  const naoReconhecidas = e.resumoRubricas.filter((r) => classificar(r, ctx.colunas).origem === "nao_reconhecida");
  for (const r of naoReconhecidas) falha(`rubrica não reconhecida: ${r.tipo} ${r.codigo} ${r.descricao}`);

  // Colunas fecham com os totais impressos
  if (!igual(t.campos.totalProventos, e.totais.proventos)) falha(`proventos ${t.campos.totalProventos} × ${e.totais.proventos}`);
  if (!igual(t.campos.totalDescontos, e.totais.descontos)) falha(`descontos ${t.campos.totalDescontos} × ${e.totais.descontos}`);
  if (!igual(t.campos.liquido, e.totais.liquido)) falha(`líquido ${t.campos.liquido} × ${e.totais.liquido}`);

  // Encargos patronais recalculados por funcionário batem com o quadro de INSS
  const patronal = (e.encargos["Empresa"] ?? 0) + (e.encargos["RAT"] ?? 0) + (e.encargos["Terceiros"] ?? 0);
  const patronalCalc = t.campos.inssEmpresa + t.campos.rat + t.campos.terceiros;
  if (!igual(patronalCalc, patronal, 1)) falha(`patronal calculado ${patronalCalc.toFixed(2)} × extrato ${patronal}`);
  const fgtsExtrato =
    (e.encargos["Valor do FGTS"] ?? 0) + (e.encargos["Valor do FGTS Aprendiz"] ?? 0) + (e.encargos["Valor FGTS Rescisório"] ?? 0);
  console.log(`FGTS funcionários ${t.campos.fgts.toFixed(2)}  extrato (mensal+aprendiz+rescisório) ${fgtsExtrato.toFixed(2)}`);

  // INSS do funcionário nunca entra como encargo da empresa
  if (t.campos.encargos !== Math.round((t.campos.fgts + patronalCalc) * 100) / 100) {
    falha("encargos incluem algo além de FGTS + patronal");
  }

  // DRE: soma das naturezas = custo total
  const dre = lancamentosDre(linhas).reduce((s, l) => s + l.valor, 0);
  if (!igual(dre, t.campos.custoTotal, 0.5)) falha(`DRE ${dre.toFixed(2)} × custo ${t.campos.custoTotal}`);

  // Empréstimos: total líquido = descontos de empréstimo − estornos de provisão
  const itens = emprestimos(linhas, ctx);
  const consignado = itens.filter((i) => /Crédito|consignado|Provisão|Estorno/.test(i.tipo)).reduce((s, i) => s + i.valor, 0);
  const contratos = new Set(itens.map((i) => i.contrato).filter(Boolean));

  const pend = conferir({
    apuracoes: [{ id: apuracaoId, unidadeId: null, arquivoNome: apuracaoId, cnpjRelatorio: e.empresa.cnpj, totais: e.totais, encargos: e.encargos, avisos: e.avisos }],
    unidades: [],
    linhas,
    ctx,
  });

  const c = t.campos;
  console.log(`remuneração ${c.remuneracao.toFixed(2)}  encargos ${c.encargos.toFixed(2)}  provisões ${c.provisoes.toFixed(2)}  enc.prov ${c.encargosProvisoes.toFixed(2)}`);
  console.log(`utilização provisões ${c.utilizacaoProvisao.toFixed(2)} (+enc ${c.utilizacaoEncargos.toFixed(2)})  CUSTO TOTAL ${c.custoTotal.toFixed(2)}`);
  console.log(`empréstimos: ${itens.length} itens, consignado líquido ${consignado.toFixed(2)}, ${contratos.size} contratos`);
  console.log(`pendências: ${pend.filter((p) => p.gravidade === "bloqueia").length} bloqueiam, ${pend.filter((p) => p.gravidade === "alerta").length} alertas`);
  for (const p of pend.filter((p) => p.tipo !== "setor_sem_nome")) console.log(`  ${p.gravidade} ${p.descricao}`);
  if (process.env.DETALHE) {
    for (const r of e.resumoRubricas) console.log(`  ${r.tipo} ${r.codigo.padStart(4)} ${r.descricao.padEnd(42)} → ${classificar(r, ctx.colunas).coluna}`);
  }
}

console.log(falhas === 0 ? "\nAPURAÇÃO ANALÍTICA CONFERE" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
