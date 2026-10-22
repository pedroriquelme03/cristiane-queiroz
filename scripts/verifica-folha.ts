import {
  calcularCusto,
  categoriaPadrao,
  chaveRubrica,
  resumirRubricas,
  totalFolha,
  type ConfigRubrica,
} from "@/lib/folha";
import type { RubricaExtrato } from "@/lib/importacao/adaptadores/extrato-mensal";

let falhas = 0;
const eq = (rotulo: string, obtido: unknown, esperado: unknown) => {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${rotulo} -> ${a}${ok ? "" : ` (esperado ${b})`}`);
};
const r = (codigo: string, descricao: string, tipo: "P" | "D", valor: number, referencia = "1,00"): RubricaExtrato => ({
  codigo,
  descricao,
  tipo,
  referencia,
  valor,
});

console.log("--- classificação padrão ---");
eq("DIAS NORMAIS", categoriaPadrao(r("8781", "DIAS NORMAIS", "P", 0)), "proventos");
eq("1/3 DAS FERIAS", categoriaPadrao(r("931", "1/3 DAS FERIAS", "P", 0)), "terco_ferias");
eq("1/3 FERIAS PROPORCIONAIS RESCISAO", categoriaPadrao(r("8169", "1/3 FERIAS PROPORCIONAIS RESCISAO", "P", 0)), "terco_ferias");
eq("13 SALARIO INTEGRAL RESCISAO", categoriaPadrao(r("8550", "13 SALARIO INTEGRAL RESCISAO", "P", 0)), "decimo_terceiro");
eq("13o 1/12 INDENIZADO", categoriaPadrao(r("9592", "13o 1/12 INDENIZADO", "P", 0)), "decimo_terceiro");
eq("DIAS FERIAS", categoriaPadrao(r("8783", "DIAS FERIAS", "P", 0)), "ferias");
eq("I.N.S.S.", categoriaPadrao(r("998", "I.N.S.S.", "D", 0)), "inss");
eq("INSS FERIAS", categoriaPadrao(r("812", "INSS FERIAS", "D", 0)), "inss_ferias");
eq("INSS 13 SAL.RESCISAO", categoriaPadrao(r("989", "INSS 13 SAL.RESCISAO", "D", 0)), "inss_13");
eq("Desconto Vale Refeiçao", categoriaPadrao(r("204", "Desconto Vale Refeiçao", "D", 0)), "retornos");

console.log("--- totais ---");
const resumo = [r("1", "HORAS NORMAIS", "P", 1000), r("204", "VALE", "D", 100), r("998", "I.N.S.S.", "D", 80)];
const sem = new Map<string, ConfigRubrica>();
eq("total da folha padrão (P − D)", totalFolha(resumo, sem), 820);
const configs = new Map<string, ConfigRubrica>([
  [chaveRubrica({ codigo: "998", tipo: "D" }), { codigo: "998", tipo: "D", efeito: "ignora", categoria: "inss" }],
]);
eq("rubrica ignorada fica fora do total", totalFolha(resumo, configs), 900);

// Números da tela de referência (Junho/2026): TOTAL CUSTO = R$ 538.625,94
const ref = [
  r("1", "PROVENTOS", "P", 548371.1),
  r("2", "COMISSAO", "P", 21943.46),
  r("3", "PRODUTIVIDADE", "P", 9525.04),
  r("4", "RETORNOS", "D", 284398.87),
  r("5", "13 SALARIO", "P", 21017.16),
  r("6", "FERIAS", "P", 124967.42),
  r("7", "1/3 FERIAS", "P", 24462.52),
  r("8", "INSS", "D", 65542.73),
  r("9", "INSS 13", "D", 1424.18),
  r("10", "INSS FERIAS", "D", 5771.2),
];
const custo = calcularCusto(ref, new Map(), {});
eq("total salário da referência", Math.round(custo.totalSalario * 100) / 100, 579839.6);
eq("total custo da referência", Math.round(custo.totalCusto * 100) / 100, 538625.94);
eq(
  "FGTS manual soma no custo",
  Math.round(calcularCusto(ref, new Map(), { fgts: 100, fgtsProvFerias: 10, fgtsProv13: 1 }).totalCusto * 100) / 100,
  538736.94,
);

console.log("--- resumo filtrado ---");
const func = (rubricas: RubricaExtrato[]) => ({ rubricas });
const agregado = resumirRubricas([
  func([r("200", "HORAS EXTRAS", "P", 10.5, "6:28"), r("204", "VALE", "D", 40, "40,00")]),
  func([r("200", "HORAS EXTRAS", "P", 20.25, "10:49"), r("204", "VALE", "D", 17.33, "40,00")]),
]);
eq("soma valores por rubrica", agregado.map((x) => x.valor), [30.75, 57.33]);
eq("soma horas hh:mm", agregado[0].referencia, "17:17");
eq("soma referência numérica", agregado[1].referencia, "80,00");

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
