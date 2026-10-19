import { ESQUEMAS, sugerirMapeamento } from "@/lib/importacao/esquemas";
import { montarPlanilha, type ArquivoBruto } from "@/lib/importacao/leitor";
import {
  aplicarMapaDoModelo,
  assinaturaDe,
  configModeloSchema,
  detectarModelo,
  mapaParaConfig,
  type ModeloImportacao,
} from "@/lib/importacao/modelos";

let falhas = 0;
const eq = (rotulo: string, obtido: unknown, esperado: unknown) => {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  const ok = a === b;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${rotulo} -> ${a}${ok ? "" : ` (esperado ${b})`}`);
};
const lanca = (rotulo: string, fn: () => unknown) => {
  try {
    fn();
    falhas++;
    console.log(`FALHA ${rotulo} -> não lançou erro`);
  } catch {
    console.log(`ok   ${rotulo} -> lançou erro`);
  }
};

// Relatório típico de ERP: título, linha em branco, cabeçalho na linha 4, total no fim
const relatorioErp: ArquivoBruto = {
  abas: [
    { nome: "Capa", matriz: [["Relatório gerado em 01/10/2026"]], primeiraLinha: 1 },
    {
      nome: "Movimento",
      primeiraLinha: 1,
      matriz: [
        ["EMPRESA XYZ LTDA", null, null, null],
        ["Extrato de movimento - 09/2026", null, null, null],
        [null, null, null, null],
        ["Dt. Movto", "Histórico", "Favorecido", "Vlr"],
        ["01/09/2026", "Aluguel", "Imobiliária", "-2.500,00"],
        [null, null, null, null],
        ["02/09/2026", "Venda balcão", "Consumidor", "1.200,00"],
        ["Subtotal", null, null, "-1.300,00"],
        ["TOTAL GERAL", null, null, "-1.300,00"],
      ],
    },
  ],
};

console.log("--- leitura ---");
const auto = montarPlanilha(relatorioErp);
eq("sem opções usa a primeira aba", auto.aba, "Capa");
eq("abas disponíveis", auto.abas, ["Capa", "Movimento"]);

const semCabecalho = montarPlanilha(relatorioErp, { aba: "Movimento" });
eq("cabeçalho automático = 1ª linha não vazia", semCabecalho.linhaCabecalho, 1);

const lida = montarPlanilha(relatorioErp, {
  aba: "Movimento",
  linhaCabecalho: 4,
  ignorarLinhasQueComecam: ["subtotal", "Total"],
});
eq("cabeçalhos da linha 4", lida.cabecalhos, ["Dt. Movto", "Histórico", "Favorecido", "Vlr"]);
eq("linhas válidas", lida.linhas.length, 2);
eq("numeração do arquivo preservada (pula vazias)", lida.numeros, [5, 7]);
eq("ignoradas", lida.ignoradas, 2);
eq("aba inexistente cai na primeira", montarPlanilha(relatorioErp, { aba: "Nope" }).aba, "Capa");
lanca("linha de cabeçalho além do fim", () =>
  montarPlanilha(relatorioErp, { aba: "Movimento", linhaCabecalho: 99 }),
);
lanca("linha de cabeçalho vazia", () =>
  montarPlanilha(relatorioErp, { aba: "Movimento", linhaCabecalho: 3 }),
);

const deslocado = montarPlanilha({
  abas: [{ nome: "A", primeiraLinha: 3, matriz: [["data", "valor"], ["01/01/2026", "1"]] }],
});
eq("!ref começando na linha 3", [deslocado.linhaCabecalho, deslocado.numeros], [3, [4]]);

console.log("--- modelo ---");
const campos = ESQUEMAS.lancamentos.campos;
const sugestao = sugerirMapeamento(lida.cabecalhos, campos);
// "Vlr" e "Dt. Movto" já são reconhecidos; "Histórico" também. O modelo fixa o resto.
const mapaUsuario = { ...sugestao, contraparte: 2, documento: null };
const config = configModeloSchema.parse({
  aba: "Movimento",
  linhaCabecalho: 4,
  ignorarLinhasQueComecam: ["subtotal", "total"],
  mapa: mapaParaConfig(lida.cabecalhos, mapaUsuario),
});
eq("mapa salvo por cabeçalho normalizado", config.mapa.contraparte, "favorecido");
eq("'não importar' é salvo como null", config.mapa.documento, null);

// Mesmo relatório, colunas em outra ordem
const reordenado = ["Vlr", "Favorecido", "Dt. Movto", "Histórico"];
const aplicado = aplicarMapaDoModelo(
  reordenado,
  campos,
  sugerirMapeamento(reordenado, campos),
  config,
);
eq("modelo segue o nome, não a posição", [aplicado.valor, aplicado.contraparte, aplicado.data, aplicado.descricao], [0, 1, 2, 3]);
eq("null do modelo vence a sugestão", aplicado.documento, null);

const conflito = aplicarMapaDoModelo(
  ["Nome", "Data", "Valor", "Descrição"],
  campos,
  { data: 1, descricao: 3, valor: 2, tipo: null, contraparte: 0, documento: null, categoria: null },
  configModeloSchema.parse({ mapa: { categoria: "nome" } }),
);
eq("coluna do modelo não é reaproveitada pela sugestão", [conflito.categoria, conflito.contraparte], [0, null]);

console.log("--- detecção ---");
const modelo: ModeloImportacao = {
  id: "m1",
  empresaId: "e1",
  tipo: "lancamentos",
  nome: "ERP XYZ",
  config,
  assinatura: assinaturaDe(lida.cabecalhos),
};
const global: ModeloImportacao = { ...modelo, id: "g1", empresaId: null, nome: "Padrão" };

eq("assinatura ignora 'Coluna N'", assinaturaDe(["Data", "Coluna 2", "Valor"]), ["data", "valor"]);
const achado = detectarModelo(relatorioErp, [global, modelo], "lancamentos");
eq("reconhece o relatório com as opções do modelo", achado?.modelo.id, "m1");
eq("planilha já montada com as opções", achado?.planilha.linhas.length, 2);
eq("tipo diferente não casa", detectarModelo(relatorioErp, [modelo], "titulos"), null);
eq(
  "arquivo de outro layout não casa",
  detectarModelo({ abas: [{ nome: "x", primeiraLinha: 1, matriz: [["a", "b"], [1, 2]] }] }, [modelo], "lancamentos"),
  null,
);

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
