/**
 * Define o que cada tipo de importação espera e como adivinhar o mapeamento a
 * partir dos cabeçalhos da planilha do cliente.
 */
import { normalizar, parseData, parseValor } from "@/lib/importacao/parsers";

export type TipoImportacao = "lancamentos" | "titulos";

export type TipoCampo = "data" | "valor" | "texto" | "opcao";

export interface Campo {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  /** Cabeçalhos que costumam aparecer nos relatórios, já normalizados. */
  sinonimos: string[];
  /** Para tipo "opcao": valores aceitos e como reconhecê-los. */
  opcoes?: { valor: string; rotulo: string; sinonimos: string[] }[];
  ajuda?: string;
}

export interface EsquemaImportacao {
  tipo: TipoImportacao;
  rotulo: string;
  descricao: string;
  campos: Campo[];
}

const CAMPO_TIPO_MOVIMENTO: Campo = {
  chave: "tipo",
  rotulo: "Tipo",
  tipo: "opcao",
  obrigatorio: false,
  sinonimos: ["tipo", "natureza", "d c", "debito credito", "entrada saida", "operacao"],
  opcoes: [
    {
      valor: "entrada",
      rotulo: "Entrada",
      sinonimos: ["entrada", "credito", "c", "receita", "recebimento", "e"],
    },
    {
      valor: "saida",
      rotulo: "Saída",
      sinonimos: ["saida", "debito", "d", "despesa", "pagamento", "s"],
    },
  ],
  ajuda:
    "Se a planilha não tiver essa coluna, o sinal do valor decide: negativo é saída.",
};

export const ESQUEMAS: Record<TipoImportacao, EsquemaImportacao> = {
  lancamentos: {
    tipo: "lancamentos",
    rotulo: "Lançamentos (fluxo de caixa)",
    descricao: "Movimentações já realizadas: entradas e saídas do caixa e das contas.",
    campos: [
      {
        chave: "data",
        rotulo: "Data",
        tipo: "data",
        obrigatorio: true,
        sinonimos: ["data", "data lancamento", "data movimento", "dt", "data pagamento", "competencia"],
      },
      {
        chave: "descricao",
        rotulo: "Descrição",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["descricao", "historico", "memo", "observacao", "lancamento"],
      },
      {
        chave: "valor",
        rotulo: "Valor",
        tipo: "valor",
        obrigatorio: true,
        sinonimos: ["valor", "valor r", "montante", "total", "vlr"],
      },
      CAMPO_TIPO_MOVIMENTO,
      {
        chave: "contraparte",
        rotulo: "Cliente / fornecedor",
        tipo: "texto",
        obrigatorio: false,
        sinonimos: ["contraparte", "cliente", "fornecedor", "favorecido", "beneficiario", "razao social", "nome"],
      },
      {
        chave: "documento",
        rotulo: "Documento",
        tipo: "texto",
        obrigatorio: false,
        sinonimos: ["documento", "doc", "nf", "nota", "nota fiscal", "numero"],
      },
      {
        chave: "categoria",
        rotulo: "Categoria / plano de contas",
        tipo: "texto",
        obrigatorio: false,
        sinonimos: ["categoria", "plano de contas", "conta", "classificacao", "centro de custo", "grupo"],
      },
    ],
  },

  titulos: {
    tipo: "titulos",
    rotulo: "Títulos (contas a pagar e a receber)",
    descricao: "Obrigações e direitos em aberto ou já liquidados, com vencimento.",
    campos: [
      {
        chave: "tipo",
        rotulo: "Pagar ou receber",
        tipo: "opcao",
        obrigatorio: false,
        sinonimos: ["tipo", "natureza", "especie", "pagar receber"],
        opcoes: [
          { valor: "pagar", rotulo: "A pagar", sinonimos: ["pagar", "a pagar", "p", "despesa", "fornecedor"] },
          { valor: "receber", rotulo: "A receber", sinonimos: ["receber", "a receber", "r", "receita", "cliente"] },
        ],
        ajuda: "Sem essa coluna, escolha o tipo na etapa de conferência.",
      },
      {
        chave: "contraparte",
        rotulo: "Cliente / fornecedor",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["contraparte", "cliente", "fornecedor", "favorecido", "razao social", "nome", "sacado"],
      },
      {
        chave: "vencimento",
        rotulo: "Vencimento",
        tipo: "data",
        obrigatorio: true,
        sinonimos: ["vencimento", "data vencimento", "dt vencimento", "venc"],
      },
      {
        chave: "valor",
        rotulo: "Valor",
        tipo: "valor",
        obrigatorio: true,
        sinonimos: ["valor", "valor r", "valor titulo", "montante", "total", "vlr"],
      },
      {
        chave: "emissao",
        rotulo: "Emissão",
        tipo: "data",
        obrigatorio: false,
        sinonimos: ["emissao", "data emissao", "dt emissao"],
      },
      {
        chave: "valorPago",
        rotulo: "Valor pago",
        tipo: "valor",
        obrigatorio: false,
        sinonimos: ["valor pago", "pago", "baixado", "valor baixa", "liquidado"],
      },
      {
        chave: "documento",
        rotulo: "Documento",
        tipo: "texto",
        obrigatorio: false,
        sinonimos: ["documento", "doc", "nf", "nota", "nota fiscal", "titulo", "numero"],
      },
    ],
  },
};

/**
 * Adivinha qual coluna da planilha corresponde a cada campo.
 *
 * Casa primeiro por igualdade exata do cabeçalho normalizado e só depois por
 * conteúdo parcial — sem isso, "data" casaria com "data vencimento" antes de
 * chegar na coluna "data" de verdade. Cada coluna é usada uma única vez.
 */
export function sugerirMapeamento(
  cabecalhos: string[],
  campos: Campo[],
): Record<string, number | null> {
  const normalizados = cabecalhos.map(normalizar);
  const usados = new Set<number>();
  const mapa: Record<string, number | null> = {};

  const procurar = (campo: Campo, exato: boolean) => {
    for (let i = 0; i < normalizados.length; i += 1) {
      if (usados.has(i)) continue;
      const cabecalho = normalizados[i];
      const casa = campo.sinonimos.some((s) =>
        exato ? cabecalho === s : cabecalho.includes(s) || s.includes(cabecalho),
      );
      if (casa) return i;
    }
    return null;
  };

  for (const campo of campos) mapa[campo.chave] = null;

  for (const exato of [true, false]) {
    for (const campo of campos) {
      if (mapa[campo.chave] !== null) continue;
      const indice = procurar(campo, exato);
      if (indice !== null) {
        mapa[campo.chave] = indice;
        usados.add(indice);
      }
    }
  }

  return mapa;
}

export interface LinhaValidada {
  /** Número da linha na planilha, contando o cabeçalho (para o usuário achar). */
  numero: number;
  valores: Record<string, string | number | null>;
  erros: { campo: string; mensagem: string }[];
}

/** Converte e valida uma linha crua conforme o esquema e o mapeamento. */
export function validarLinha(
  linha: unknown[],
  numero: number,
  campos: Campo[],
  mapa: Record<string, number | null>,
): LinhaValidada {
  const valores: Record<string, string | number | null> = {};
  const erros: { campo: string; mensagem: string }[] = [];

  for (const campo of campos) {
    const indice = mapa[campo.chave];
    const bruto = indice === null ? null : linha[indice];
    const vazio = bruto == null || String(bruto).trim() === "";

    if (vazio) {
      valores[campo.chave] = null;
      if (campo.obrigatorio) {
        erros.push({ campo: campo.chave, mensagem: `${campo.rotulo} é obrigatório` });
      }
      continue;
    }

    if (campo.tipo === "data") {
      const data = parseData(bruto);
      if (data === null) {
        erros.push({
          campo: campo.chave,
          mensagem: `${campo.rotulo}: "${bruto}" não é uma data reconhecida`,
        });
      }
      valores[campo.chave] = data;
    } else if (campo.tipo === "valor") {
      const valor = parseValor(bruto);
      if (valor === null) {
        erros.push({
          campo: campo.chave,
          mensagem: `${campo.rotulo}: "${bruto}" não é um número reconhecido`,
        });
      }
      valores[campo.chave] = valor;
    } else if (campo.tipo === "opcao") {
      const texto = normalizar(String(bruto));
      const opcao = campo.opcoes?.find(
        (o) => o.valor === texto || o.sinonimos.includes(texto),
      );
      if (!opcao) {
        erros.push({
          campo: campo.chave,
          mensagem: `${campo.rotulo}: "${bruto}" não corresponde a nenhuma opção`,
        });
      }
      valores[campo.chave] = opcao?.valor ?? null;
    } else {
      valores[campo.chave] = String(bruto).trim();
    }
  }

  return { numero, valores, erros };
}

/**
 * Regras que dependem de mais de um campo, aplicadas depois da conversão.
 * Em lançamentos, o tipo pode vir do sinal do valor quando não há coluna.
 */
export function aplicarRegrasDoTipo(
  tipo: TipoImportacao,
  linha: LinhaValidada,
): LinhaValidada {
  if (tipo !== "lancamentos") return linha;

  const valor = linha.valores.valor;
  if (typeof valor !== "number") return linha;

  if (linha.valores.tipo == null) {
    linha.valores.tipo = valor < 0 ? "saida" : "entrada";
  }
  // O sinal já foi absorvido pelo tipo; o valor é sempre positivo no banco
  linha.valores.valor = Math.abs(valor);

  if (linha.valores.valor === 0) {
    linha.erros.push({ campo: "valor", mensagem: "Valor não pode ser zero" });
  }

  return linha;
}
