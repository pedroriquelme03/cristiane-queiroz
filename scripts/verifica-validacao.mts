import { esquemaLancamento, esquemaTitulo, statusDoTitulo } from "@/lib/validacao/financeiro";

let falhas = 0;
const caso = (rotulo: string, esquema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, dados: unknown, esperado: string | null) => {
  const r = esquema.safeParse(dados);
  const obtido = r.success ? null : r.error!.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(" | ");
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok   " : "FALHA"} ${rotulo} -> ${obtido ?? "válido"}`);
};

const lancOk = { data: "2026-07-05", tipo: "entrada", valor: "1.234,56", descricao: "Recebimento" };
console.log("--- lançamento ---");
caso("completo válido", esquemaLancamento, lancOk, null);
caso("valor pt-BR", esquemaLancamento, { ...lancOk, valor: "12.480,50" }, null);
caso("valor zero", esquemaLancamento, { ...lancOk, valor: "0" }, "valor: O valor deve ser maior que zero");
caso("valor negativo", esquemaLancamento, { ...lancOk, valor: "-50,00" }, "valor: O valor deve ser maior que zero");
caso("valor ilegível", esquemaLancamento, { ...lancOk, valor: "abc" }, "valor: Valor inválido");
caso("sem descrição", esquemaLancamento, { ...lancOk, descricao: "" }, "descricao: Informe a descrição");
caso("tipo inválido", esquemaLancamento, { ...lancOk, tipo: "transferencia" }, "tipo: Selecione entrada ou saída");
caso("data mal formada", esquemaLancamento, { ...lancOk, data: "05/07/2026" }, "data: Data inválida");

const titOk = { tipo: "pagar", contraparte: "Copel", vencimento: "2026-08-10", valor: "1.000,00" };
console.log("\n--- título ---");
caso("completo válido", esquemaTitulo, titOk, null);
caso("pago parcial", esquemaTitulo, { ...titOk, valorPago: "400,00" }, null);
caso("pago > valor", esquemaTitulo, { ...titOk, valorPago: "1.500,00" }, "valorPago: O valor pago não pode superar o valor do título");
caso("pago negativo", esquemaTitulo, { ...titOk, valorPago: "-10,00" }, "valorPago: O valor pago não pode ser negativo");
caso("emissão após vencimento", esquemaTitulo, { ...titOk, emissao: "2026-09-01" }, "emissao: A emissão não pode ser depois do vencimento");
caso("emissão antes", esquemaTitulo, { ...titOk, emissao: "2026-07-01" }, null);
caso("sem contraparte", esquemaTitulo, { ...titOk, contraparte: "  " }, "contraparte: Informe o cliente ou fornecedor");

console.log("\n--- status derivado ---");
const st = (v: number, p: number, esp: string) => {
  const obtido = statusDoTitulo(v, p);
  const ok = obtido === esp;
  if (!ok) falhas++;
  console.log(`${ok ? "ok   " : "FALHA"} ${v}/${p} -> ${obtido}`);
};
st(1000, 0, "aberto");
st(1000, 400, "parcial");
st(1000, 1000, "pago");
st(1000, 1200, "pago");

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
