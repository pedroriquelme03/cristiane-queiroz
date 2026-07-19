import { normalizar, parseData, parseValor } from "@/lib/importacao/parsers";

let falhas = 0;
const eq = (rotulo: string, obtido: unknown, esperado: unknown) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${rotulo} -> ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
};

console.log("--- datas ---");
eq("31/12/2026", parseData("31/12/2026"), "2026-12-31");
eq("01/02/26", parseData("01/02/26"), "2026-02-01");
eq("01/02/95", parseData("01/02/95"), "1995-02-01");
eq("2026-12-31", parseData("2026-12-31"), "2026-12-31");
eq("05-06-2026", parseData("05-06-2026"), "2026-06-05");
eq("serie excel 45657", parseData(45657), "2024-12-31"); // conferido: no Excel 45658 = 01/01/2025
eq("Date", parseData(new Date(Date.UTC(2026, 5, 10))), "2026-06-10");
eq("31/02/2026 invalida", parseData("31/02/2026"), null);
eq("vazio", parseData(""), null);
eq("lixo", parseData("nao e data"), null);

console.log("--- valores ---");
eq("1.234,56", parseValor("1.234,56"), 1234.56);
eq("1234,56", parseValor("1234,56"), 1234.56);
eq("1,234.56", parseValor("1,234.56"), 1234.56);
eq("1234.56", parseValor("1234.56"), 1234.56);
eq("R$ 1.234,56", parseValor("R$ 1.234,56"), 1234.56);
eq("(1.234,56)", parseValor("(1.234,56)"), -1234.56);
eq("-1.234,56", parseValor("-1.234,56"), -1234.56);
eq("1.234,56 D", parseValor("1.234,56 D"), -1234.56);
eq("1.234,56 C", parseValor("1.234,56 C"), 1234.56);
eq("1.234 (milhar)", parseValor("1.234"), 1234);
eq("1.234.567", parseValor("1.234.567"), 1234567);
eq("numero puro", parseValor(890.1), 890.1);
eq("0", parseValor("0"), 0);
eq("vazio", parseValor(""), null);
eq("lixo", parseValor("abc"), null);

console.log("--- normalizar ---");
eq("Descrição", normalizar("Descrição"), "descricao");
eq("VENCIMENTO ", normalizar("VENCIMENTO "), "vencimento");
eq("Valor (R$)", normalizar("Valor (R$)"), "valor r");
eq("Data de Emissão", normalizar("Data de Emissão"), "data de emissao");

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
