/**
 * Gera um dataset de demonstracao consistente: uma pousada em Foz do Iguacu
 * com 12 meses de movimento. Tudo deterministico (seed fixa), para que dois
 * renders produzam exatamente os mesmos numeros.
 *
 * Substituir por queries ao Supabase quando o projeto for provisionado —
 * veja src/lib/dados.ts, que e a fronteira entre as telas e a fonte de dados.
 */
import type {
  Alerta,
  AvaliacaoMaturidade,
  Diagnostico,
  Documento,
  Empresa,
  Indicador,
  Lancamento,
  Orcamento,
  PlanoAcao,
  PlanoConta,
  Reuniao,
  Titulo,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** PRNG deterministico (mulberry32). */
function criarRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = criarRandom(20260718);

/** Variacao aleatoria em torno de 1, ex.: ruido(0.15) -> 0.85 a 1.15 */
const ruido = (amplitude: number) => 1 + (rnd() * 2 - 1) * amplitude;

const iso = (d: Date) => d.toISOString().slice(0, 10);

function addMeses(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

function diasNoMes(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate();
}

const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);

/** Primeiro dia do mes corrente. */
const MES_CORRENTE = new Date(HOJE.getFullYear(), HOJE.getMonth(), 1);

/**
 * Ultimo mes fechado. A consultoria reporta sobre mes fechado: no mes corrente
 * boa parte dos custos ainda nao foi lancada (folha, impostos e CMV caem depois
 * do dia 20), o que inflaria a margem e zeraria linhas inteiras da DRE.
 */
const MES_FECHADO = addMeses(MES_CORRENTE, -1);

/** 12 competencias fechadas, terminando no ultimo mes encerrado. */
export const COMPETENCIAS = Array.from({ length: 12 }, (_, i) =>
  iso(addMeses(MES_FECHADO, i - 11)),
);

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------

export const EMPRESA: Empresa = {
  id: "emp-001",
  razaoSocial: "Recanto das Cataratas Hotelaria Ltda.",
  nomeFantasia: "Pousada Recanto das Cataratas",
  cnpj: "28117645970001",
  segmento: "hotelaria",
  regimeTributario: "presumido",
  dataAbertura: "2014-03-12",
  qtdFuncionarios: 34,
  unidades: [
    { id: "un-1", nome: "Unidade Centro", tipo: "matriz", cidade: "Foz do Iguaçu", uf: "PR" },
    { id: "un-2", nome: "Unidade Vila Yolanda", tipo: "filial", cidade: "Foz do Iguaçu", uf: "PR" },
  ],
};

// ---------------------------------------------------------------------------
// Plano de contas
// ---------------------------------------------------------------------------

export const PLANO_CONTAS: PlanoConta[] = [
  { id: "pc-01", codigo: "3.1.01", nome: "Hospedagem", tipo: "receita", grupoDre: "receita_bruta" },
  { id: "pc-02", codigo: "3.1.02", nome: "Alimentos e bebidas", tipo: "receita", grupoDre: "receita_bruta" },
  { id: "pc-03", codigo: "3.1.03", nome: "Eventos", tipo: "receita", grupoDre: "receita_bruta" },
  { id: "pc-04", codigo: "3.1.04", nome: "Outras receitas", tipo: "receita", grupoDre: "receita_bruta" },
  { id: "pc-05", codigo: "3.2.01", nome: "Impostos sobre vendas", tipo: "deducao", grupoDre: "deducoes" },
  { id: "pc-06", codigo: "4.1.01", nome: "CMV alimentos e bebidas", tipo: "custo", grupoDre: "custo_variavel" },
  { id: "pc-07", codigo: "4.1.02", nome: "Comissões de OTAs", tipo: "custo", grupoDre: "custo_variavel" },
  { id: "pc-08", codigo: "4.1.03", nome: "Enxoval e lavanderia", tipo: "custo", grupoDre: "custo_variavel" },
  { id: "pc-09", codigo: "5.1.01", nome: "Salários e encargos", tipo: "despesa", grupoDre: "despesa_pessoal" },
  { id: "pc-10", codigo: "5.1.02", nome: "Benefícios", tipo: "despesa", grupoDre: "despesa_pessoal" },
  { id: "pc-11", codigo: "5.1.03", nome: "Pró-labore", tipo: "despesa", grupoDre: "despesa_pessoal" },
  { id: "pc-12", codigo: "5.2.01", nome: "Aluguel", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-13", codigo: "5.2.02", nome: "Energia elétrica", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-14", codigo: "5.2.03", nome: "Água e esgoto", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-15", codigo: "5.2.04", nome: "Internet e telefonia", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-16", codigo: "5.2.05", nome: "Contabilidade", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-17", codigo: "5.2.06", nome: "Manutenção predial", tipo: "despesa", grupoDre: "despesa_administrativa" },
  { id: "pc-18", codigo: "5.3.01", nome: "Marketing e publicidade", tipo: "despesa", grupoDre: "despesa_comercial" },
  { id: "pc-19", codigo: "5.4.01", nome: "Tarifas bancárias", tipo: "despesa", grupoDre: "despesa_financeira" },
  { id: "pc-20", codigo: "5.4.02", nome: "Juros e multas", tipo: "despesa", grupoDre: "despesa_financeira" },
  { id: "pc-21", codigo: "6.1.01", nome: "Reforma e mobiliário", tipo: "investimento", grupoDre: "investimento" },
];

export const SALDO_INICIAL = 68_400;

/** Alta temporada em Foz: janeiro, julho e dezembro puxam a ocupacao. */
const SAZONALIDADE = [1.28, 1.05, 0.86, 0.82, 0.78, 0.9, 1.3, 1.02, 0.88, 0.95, 1.0, 1.22];

/** Receita base de hospedagem por mes, com crescimento leve ao longo do ano. */
function receitaHospedagem(competencia: string, indice: number) {
  const mes = new Date(`${competencia}T12:00:00`).getMonth();
  const crescimento = 1 + indice * 0.012; // trabalho da consultoria aparecendo
  return 268_000 * SAZONALIDADE[mes] * crescimento * ruido(0.05);
}

// ---------------------------------------------------------------------------
// Lancamentos (fluxo de caixa realizado)
// ---------------------------------------------------------------------------

/** Percentual da receita de hospedagem que cada outra receita representa. */
const PROPORCAO_RECEITA: Record<string, number> = {
  "pc-02": 0.31, // A&B
  "pc-03": 0.09, // eventos
  "pc-04": 0.03, // outras
};

/** Despesas variaveis, como fracao da receita bruta total do mes. */
const DESPESA_VARIAVEL: Record<string, number> = {
  "pc-05": 0.081, // impostos
  "pc-06": 0.105, // CMV
  "pc-07": 0.072, // comissoes OTA
  "pc-08": 0.028, // enxoval
};

/** Despesas fixas mensais, com o dia do mes em que costumam ser pagas. */
const DESPESA_FIXA: { conta: string; valor: number; dia: number; descricao: string }[] = [
  { conta: "pc-09", valor: 132_000, dia: 5, descricao: "Folha de pagamento" },
  { conta: "pc-10", valor: 14_800, dia: 5, descricao: "Vale transporte e refeição" },
  { conta: "pc-11", valor: 22_000, dia: 10, descricao: "Pró-labore sócios" },
  { conta: "pc-12", valor: 28_500, dia: 10, descricao: "Aluguel Unidade Centro" },
  { conta: "pc-13", valor: 19_200, dia: 15, descricao: "Copel" },
  { conta: "pc-14", valor: 6_400, dia: 15, descricao: "Sanepar" },
  { conta: "pc-15", valor: 2_900, dia: 20, descricao: "Internet e telefonia" },
  { conta: "pc-16", valor: 3_800, dia: 20, descricao: "Honorários contábeis" },
  { conta: "pc-17", valor: 9_500, dia: 22, descricao: "Manutenção predial" },
  { conta: "pc-18", valor: 17_500, dia: 25, descricao: "Marketing e mídia paga" },
  { conta: "pc-19", valor: 1_450, dia: 28, descricao: "Tarifas bancárias" },
];

const CLIENTES = [
  "Booking.com", "Expedia", "Airbnb", "CVC Corp", "Decolar.com",
  "Agência Iguassu Tour", "Grupo Terra Sul", "Reserva direta - site",
  "Loumar Turismo", "Prefeitura de Foz - evento",
];

const FORNECEDORES = [
  "Distribuidora Sul Alimentos", "Copel Distribuição", "Sanepar",
  "Lavanderia Cataratas", "Frigorífico Boa Carne", "Hortifruti Paraná",
  "Nova Era Materiais", "Segurança Vigil Foz", "Claro Empresas",
  "Contabilidade Prisma", "Ar Frio Refrigeração",
];

function gerarLancamentos() {
  const lancamentos: Lancamento[] = [];
  let seq = 0;
  const novoId = () => `lanc-${(seq += 1).toString().padStart(5, "0")}`;

  COMPETENCIAS.forEach((competencia, indice) => {
    const inicio = new Date(`${competencia}T12:00:00`);
    const ano = inicio.getFullYear();
    const mes = inicio.getMonth();
    const totalDias = diasNoMes(ano, mes);

    const hospedagem = receitaHospedagem(competencia, indice);
    const receitaBruta =
      hospedagem *
      (1 + Object.values(PROPORCAO_RECEITA).reduce((a, b) => a + b, 0));

    // --- Receitas: diluidas dia a dia
    for (let dia = 1; dia <= totalDias; dia += 1) {
      const d = new Date(ano, mes, dia);

      // Fim de semana movimenta mais
      const peso = [0, 6].includes(d.getDay()) ? 1.45 : 0.86;

      const receitasDoDia: [string, number][] = [
        ["pc-01", (hospedagem / totalDias) * peso * ruido(0.22)],
        ["pc-02", ((hospedagem * PROPORCAO_RECEITA["pc-02"]) / totalDias) * peso * ruido(0.28)],
      ];

      for (const [conta, valor] of receitasDoDia) {
        lancamentos.push({
          id: novoId(),
          data: iso(d),
          tipo: "entrada",
          valor: Math.round(valor * 100) / 100,
          descricao:
            conta === "pc-01" ? "Recebimento de hospedagem" : "Consumo de A&B",
          contraparte: CLIENTES[Math.floor(rnd() * CLIENTES.length)],
          planoContaId: conta,
        });
      }

      // Eventos e outras receitas caem esporadicamente
      if (rnd() < 0.14) {
        lancamentos.push({
          id: novoId(),
          data: iso(d),
          tipo: "entrada",
          valor: Math.round(hospedagem * PROPORCAO_RECEITA["pc-03"] * 0.28 * ruido(0.4) * 100) / 100,
          descricao: "Locação de espaço para evento",
          contraparte: CLIENTES[Math.floor(rnd() * CLIENTES.length)],
          planoContaId: "pc-03",
        });
      }
      if (rnd() < 0.08) {
        lancamentos.push({
          id: novoId(),
          data: iso(d),
          tipo: "entrada",
          valor: Math.round(hospedagem * PROPORCAO_RECEITA["pc-04"] * 0.5 * ruido(0.5) * 100) / 100,
          descricao: "Receitas diversas (estacionamento, passeios)",
          contraparte: null,
          planoContaId: "pc-04",
        });
      }
    }

    // --- Despesas variaveis: uma competencia por mes, no dia 20
    for (const [conta, fracao] of Object.entries(DESPESA_VARIAVEL)) {
      const d = new Date(ano, mes, Math.min(20, totalDias));
      lancamentos.push({
        id: novoId(),
        data: iso(d),
        tipo: "saida",
        valor: Math.round(receitaBruta * fracao * ruido(0.08) * 100) / 100,
        descricao: PLANO_CONTAS.find((c) => c.id === conta)!.nome,
        contraparte: FORNECEDORES[Math.floor(rnd() * FORNECEDORES.length)],
        planoContaId: conta,
      });
    }

    // --- Despesas fixas
    for (const fixa of DESPESA_FIXA) {
      const d = new Date(ano, mes, Math.min(fixa.dia, totalDias));
      // Energia acompanha a ocupacao; o resto e praticamente estavel
      const fator = fixa.conta === "pc-13" ? SAZONALIDADE[mes] : 1;
      lancamentos.push({
        id: novoId(),
        data: iso(d),
        tipo: "saida",
        valor: Math.round(fixa.valor * fator * ruido(0.06) * 100) / 100,
        descricao: fixa.descricao,
        contraparte: FORNECEDORES[Math.floor(rnd() * FORNECEDORES.length)],
        planoContaId: fixa.conta,
      });
    }

    // --- Investimento pontual: reforma concentrada na baixa temporada
    if ([3, 4, 8].includes(mes) && rnd() < 0.7) {
      lancamentos.push({
        id: novoId(),
        data: iso(new Date(ano, mes, 18)),
        tipo: "saida",
        valor: Math.round(42_000 * ruido(0.35) * 100) / 100,
        descricao: "Reforma de apartamentos e mobiliário",
        contraparte: "Nova Era Materiais",
        planoContaId: "pc-21",
      });
    }
  });

  return lancamentos.sort((a, b) => a.data.localeCompare(b.data));
}

export const LANCAMENTOS = gerarLancamentos();

// ---------------------------------------------------------------------------
// Titulos a pagar e a receber
// ---------------------------------------------------------------------------

function gerarTitulos() {
  const titulos: Titulo[] = [];
  let seq = 0;
  const novoId = () => `tit-${(seq += 1).toString().padStart(4, "0")}`;

  const criar = (
    tipo: "pagar" | "receber",
    contraparte: string,
    valor: number,
    diasOffset: number,
    conta: string,
    status: Titulo["status"] = "aberto",
  ): Titulo => {
    const venc = new Date(HOJE);
    venc.setDate(venc.getDate() + diasOffset);
    const emissao = new Date(venc);
    emissao.setDate(emissao.getDate() - 30);
    return {
      id: novoId(),
      tipo,
      contraparte,
      documento: `NF ${Math.floor(rnd() * 90000 + 10000)}`,
      emissao: iso(emissao),
      vencimento: iso(venc),
      valor: Math.round(valor * 100) / 100,
      valorPago: status === "pago" ? Math.round(valor * 100) / 100 : 0,
      status,
      planoContaId: conta,
    };
  };

  // A receber: OTAs e agencias pagam entre 15 e 45 dias
  const contasReceber: [string, number, number][] = [
    ["Booking.com", 84_300, 12],
    ["Expedia", 46_900, 18],
    ["CVC Corp", 68_500, 25],
    ["Decolar.com", 31_200, 33],
    ["Loumar Turismo", 24_800, 41],
    ["Grupo Terra Sul", 52_400, 55],
    ["Agência Iguassu Tour", 18_700, -8], // vencido
    ["Prefeitura de Foz - evento", 37_500, -22], // vencido
    ["Airbnb", 12_900, -3], // vencido
  ];
  for (const [cliente, valor, offset] of contasReceber) {
    titulos.push(criar("receber", cliente, valor, offset, "pc-01"));
  }

  // A pagar
  const contasPagar: [string, number, number, string][] = [
    ["Distribuidora Sul Alimentos", 38_400, 6, "pc-06"],
    ["Copel Distribuição", 21_100, 9, "pc-13"],
    ["Lavanderia Cataratas", 14_600, 13, "pc-08"],
    ["Frigorífico Boa Carne", 26_800, 17, "pc-06"],
    ["Nova Era Materiais", 33_500, 24, "pc-21"],
    ["Segurança Vigil Foz", 18_900, 28, "pc-17"],
    ["Claro Empresas", 3_100, 35, "pc-15"],
    ["Hortifruti Paraná", 11_400, -5, "pc-06"], // vencido
    ["Ar Frio Refrigeração", 8_700, -14, "pc-17"], // vencido
    ["Contabilidade Prisma", 3_800, 48, "pc-16"],
  ];
  for (const [fornecedor, valor, offset, conta] of contasPagar) {
    titulos.push(criar("pagar", fornecedor, valor, offset, conta));
  }

  // Historico quitado, para as telas nao ficarem so com titulos em aberto
  for (let i = 1; i <= 14; i += 1) {
    const ehPagar = i % 2 === 0;
    titulos.push(
      criar(
        ehPagar ? "pagar" : "receber",
        ehPagar
          ? FORNECEDORES[Math.floor(rnd() * FORNECEDORES.length)]
          : CLIENTES[Math.floor(rnd() * CLIENTES.length)],
        8_000 + rnd() * 60_000,
        -(20 + i * 6),
        ehPagar ? "pc-06" : "pc-01",
        "pago",
      ),
    );
  }

  return titulos.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export const TITULOS = gerarTitulos();

// ---------------------------------------------------------------------------
// Orcamento
// ---------------------------------------------------------------------------

function gerarOrcamento() {
  const orcamento: Orcamento[] = [];

  COMPETENCIAS.forEach((competencia, indice) => {
    const hospedagem = receitaHospedagem(competencia, indice);
    const receitaBruta =
      hospedagem * (1 + Object.values(PROPORCAO_RECEITA).reduce((a, b) => a + b, 0));

    const previsto = (conta: string, valor: number) =>
      orcamento.push({
        planoContaId: conta,
        competencia,
        // O previsto e uma meta redonda, entao difere do realizado de proposito
        valorPrevisto: Math.round((valor * ruido(0.07)) / 100) * 100,
      });

    previsto("pc-01", hospedagem);
    for (const [conta, fracao] of Object.entries(PROPORCAO_RECEITA)) {
      previsto(conta, hospedagem * fracao);
    }
    for (const [conta, fracao] of Object.entries(DESPESA_VARIAVEL)) {
      previsto(conta, -receitaBruta * fracao);
    }
    for (const fixa of DESPESA_FIXA) {
      previsto(fixa.conta, -fixa.valor);
    }
    previsto("pc-21", -12_000);
  });

  return orcamento;
}

export const ORCAMENTO = gerarOrcamento();

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** Serie de 12 meses partindo de `inicio` e caminhando ate `fim`, com ruido. */
function serie(inicio: number, fim: number, amplitude: number, meta: number | null) {
  return COMPETENCIAS.map((competencia, i) => {
    const t = i / (COMPETENCIAS.length - 1);
    const valor = inicio + (fim - inicio) * t;
    return {
      competencia,
      valor: Math.round(valor * ruido(amplitude) * 100) / 100,
      meta,
    };
  });
}

export const INDICADORES: Indicador[] = [
  {
    id: "ind-01", codigo: "taxa_ocupacao", nome: "Taxa de ocupação",
    descricao: "UHs ocupadas sobre UHs disponíveis",
    unidade: "percentual", direcaoMeta: "maior_melhor",
    valores: serie(58, 72, 0.06, 75),
  },
  {
    id: "ind-02", codigo: "diaria_media", nome: "Diária média (ADR)",
    descricao: "Receita de hospedagem por UH ocupada",
    unidade: "moeda", direcaoMeta: "maior_melhor",
    valores: serie(268, 342, 0.04, 350),
  },
  {
    id: "ind-03", codigo: "revpar", nome: "RevPAR",
    descricao: "Receita por UH disponível",
    unidade: "moeda", direcaoMeta: "maior_melhor",
    valores: serie(155, 246, 0.05, 260),
  },
  {
    id: "ind-04", codigo: "margem_lucro", nome: "Margem de lucro",
    descricao: "Resultado líquido sobre a receita",
    unidade: "percentual", direcaoMeta: "maior_melhor",
    valores: serie(6.4, 14.8, 0.08, 15),
  },
  {
    id: "ind-05", codigo: "cmv_hotelaria", nome: "CMV",
    descricao: "Custo da mercadoria vendida sobre a receita de A&B",
    unidade: "percentual", direcaoMeta: "menor_melhor",
    valores: serie(38.2, 31.4, 0.05, 30),
  },
  {
    id: "ind-06", codigo: "folha_faturamento", nome: "Folha sobre faturamento",
    descricao: "Custo de pessoal dividido pela receita",
    unidade: "percentual", direcaoMeta: "menor_melhor",
    valores: serie(41.5, 34.2, 0.04, 32),
  },
  {
    id: "ind-07", codigo: "liquidez_corrente", nome: "Liquidez corrente",
    descricao: "Ativo circulante dividido pelo passivo circulante",
    unidade: "numero", direcaoMeta: "maior_melhor",
    valores: serie(0.92, 1.38, 0.06, 1.5),
  },
  {
    id: "ind-08", codigo: "inadimplencia", nome: "Inadimplência",
    descricao: "Títulos vencidos sobre total a receber",
    unidade: "percentual", direcaoMeta: "menor_melhor",
    valores: serie(11.8, 6.2, 0.12, 5),
  },
  {
    id: "ind-09", codigo: "prazo_recebimento", nome: "Prazo médio de recebimento",
    descricao: "Dias médios entre a venda e o recebimento",
    unidade: "dias", direcaoMeta: "menor_melhor",
    valores: serie(38, 27, 0.07, 25),
  },
  {
    id: "ind-10", codigo: "capital_giro", nome: "Capital de giro",
    descricao: "Ativo circulante menos passivo circulante",
    unidade: "moeda", direcaoMeta: "maior_melhor",
    valores: serie(-42_000, 118_000, 0.15, 150_000),
  },
];

// ---------------------------------------------------------------------------
// Plano de acao
// ---------------------------------------------------------------------------

export const PLANOS_ACAO: PlanoAcao[] = [
  {
    id: "pa-01",
    problema: "CMV de A&B em 38%, muito acima da referência do setor (30%)",
    acao: "Implantar ficha técnica de todos os pratos, renegociar com os três principais fornecedores e adotar inventário semanal",
    area: "compras", responsavel: "Marcos Andrade", prazo: iso(addMeses(MES_CORRENTE, -1)),
    prioridade: "critica", status: "concluido", percentual: 100, impactoEstimado: 96_000,
  },
  {
    id: "pa-02",
    problema: "Ausência de fluxo de caixa projetado — decisões tomadas sem visibilidade",
    acao: "Estruturar projeção rolante de 90 dias com atualização semanal pela controladoria",
    area: "financeiro", responsavel: "Cristiane Queiroz", prazo: iso(addMeses(MES_CORRENTE, -2)),
    prioridade: "critica", status: "concluido", percentual: 100, impactoEstimado: null,
  },
  {
    id: "pa-03",
    problema: "Inadimplência de agências em 11,8%, sem régua de cobrança definida",
    acao: "Criar régua de cobrança automatizada (D+3, D+15, D+30) e exigir garantia para novos convênios",
    area: "financeiro", responsavel: "Juliana Reis", prazo: iso(addMeses(MES_CORRENTE, 1)),
    prioridade: "alta", status: "em_andamento", percentual: 65, impactoEstimado: 74_000,
  },
  {
    id: "pa-04",
    problema: "Folha representa 41% do faturamento, com escala desalinhada da ocupação",
    acao: "Redimensionar a escala por sazonalidade e migrar a governança para produtividade por UH",
    area: "rh", responsavel: "Marcos Andrade", prazo: iso(addMeses(MES_CORRENTE, 2)),
    prioridade: "alta", status: "em_andamento", percentual: 40, impactoEstimado: 132_000,
  },
  {
    id: "pa-05",
    problema: "Dependência de OTAs: 68% das reservas vêm de canais com comissão média de 18%",
    acao: "Implantar motor de reservas próprio e campanha de venda direta com tarifa diferenciada",
    area: "comercial", responsavel: "Patrícia Lemos", prazo: iso(addMeses(MES_CORRENTE, 3)),
    prioridade: "alta", status: "em_andamento", percentual: 25, impactoEstimado: 168_000,
  },
  {
    id: "pa-06",
    problema: "Estoque de A&B sem controle sistêmico, com perdas não mensuradas",
    acao: "Implantar controle de estoque no PDV e rotina de contagem cíclica",
    area: "estoque", responsavel: "Marcos Andrade", prazo: iso(addMeses(MES_CORRENTE, 2)),
    prioridade: "media", status: "em_andamento", percentual: 15, impactoEstimado: 38_000,
  },
  {
    id: "pa-07",
    problema: "Não há rotina de conciliação bancária — divergências identificadas só no fechamento",
    acao: "Estabelecer conciliação diária e revisão semanal da controladoria",
    area: "processos", responsavel: "Juliana Reis", prazo: iso(addMeses(MES_CORRENTE, 1)),
    prioridade: "media", status: "nao_iniciado", percentual: 0, impactoEstimado: null,
  },
  {
    id: "pa-08",
    problema: "PMS e sistema financeiro não conversam, gerando retrabalho de digitação",
    acao: "Avaliar integração via API entre o PMS e o ERP financeiro",
    area: "tecnologia", responsavel: "Patrícia Lemos", prazo: iso(addMeses(MES_CORRENTE, 4)),
    prioridade: "media", status: "nao_iniciado", percentual: 0, impactoEstimado: null,
  },
  {
    id: "pa-09",
    problema: "Sócios sem rotina de análise gerencial mensal",
    acao: "Instituir reunião mensal de resultados com pauta e ata padronizadas",
    area: "gestao", responsavel: "Cristiane Queiroz", prazo: iso(addMeses(MES_CORRENTE, -3)),
    prioridade: "alta", status: "concluido", percentual: 100, impactoEstimado: null,
  },
  {
    id: "pa-10",
    problema: "Precificação da diária definida por intuição, sem análise de concorrência",
    acao: "Implantar política de revenue management com pesquisa semanal de tarifas",
    area: "comercial", responsavel: "Patrícia Lemos", prazo: iso(addMeses(MES_CORRENTE, -1)),
    prioridade: "alta", status: "em_andamento", percentual: 80, impactoEstimado: 145_000,
  },
];

// ---------------------------------------------------------------------------
// Diagnostico e maturidade
// ---------------------------------------------------------------------------

const AREAS = [
  "financeiro", "compras", "estoque", "comercial", "rh", "processos", "tecnologia", "gestao",
] as const;

/** Notas do primeiro diagnostico e do mais recente, para mostrar evolucao. */
const NOTAS_INICIAIS: Record<(typeof AREAS)[number], number> = {
  financeiro: 42, compras: 30, estoque: 28, comercial: 48,
  rh: 38, processos: 32, tecnologia: 25, gestao: 45,
};
const NOTAS_ATUAIS: Record<(typeof AREAS)[number], number> = {
  financeiro: 80, compras: 55, estoque: 60, comercial: 70,
  rh: 50, processos: 58, tecnologia: 42, gestao: 72,
};

const OBSERVACOES: Record<(typeof AREAS)[number], string> = {
  financeiro: "Fluxo de caixa projetado implantado e DRE gerencial mensal em uso pelos sócios.",
  compras: "Cotação com três fornecedores já é rotina; falta formalizar política de compras.",
  estoque: "Controle iniciado no PDV, ainda sem inventário cíclico consolidado.",
  comercial: "Revenue management em implantação; dependência de OTAs segue alta.",
  rh: "Escala em redimensionamento. Faltam descrições de cargo e avaliação de desempenho.",
  processos: "Conciliação bancária e fechamento mensal ainda dependem de uma única pessoa.",
  tecnologia: "PMS e ERP desintegrados; digitação manual gera retrabalho e erro.",
  gestao: "Reunião mensal de resultados consolidada, com pauta e ata padronizadas.",
};

/** Diagnosticos trimestrais: 4 competencias ao longo do ano. */
const COMPETENCIAS_DIAGNOSTICO = [0, 3, 7, 11].map((i) => COMPETENCIAS[i]);

export const DIAGNOSTICOS: Diagnostico[] = COMPETENCIAS_DIAGNOSTICO.map(
  (competencia, i) => {
    const t = i / (COMPETENCIAS_DIAGNOSTICO.length - 1);
    return {
      competencia,
      observacoes:
        i === 0
          ? "Diagnóstico inicial. Empresa lucrativa, porém sem instrumentos de gestão: não havia DRE gerencial, controle de estoque nem projeção de caixa."
          : "Reavaliação trimestral. Evolução consistente nas áreas atacadas pelo plano de ação.",
      itens: AREAS.map((categoria) => ({
        categoria,
        nota: Math.round(
          NOTAS_INICIAIS[categoria] +
            (NOTAS_ATUAIS[categoria] - NOTAS_INICIAIS[categoria]) * t,
        ),
        observacao: OBSERVACOES[categoria],
      })),
    };
  },
);

/** Maturidade acompanha o diagnostico, mas com leitura mensal. */
export const MATURIDADE: AvaliacaoMaturidade[] = COMPETENCIAS.map(
  (competencia, i) => {
    const t = i / (COMPETENCIAS.length - 1);
    const itens = AREAS.map((categoria) => ({
      categoria,
      pontuacao: Math.round(
        NOTAS_INICIAIS[categoria] +
          (NOTAS_ATUAIS[categoria] - NOTAS_INICIAIS[categoria]) * t,
      ),
    }));
    return {
      competencia,
      pontuacaoGeral: Math.round(
        itens.reduce((soma, item) => soma + item.pontuacao, 0) / itens.length,
      ),
      itens,
    };
  },
);

// ---------------------------------------------------------------------------
// Documentos, reunioes e alertas
// ---------------------------------------------------------------------------

export const DOCUMENTOS: Documento[] = [
  { id: "doc-01", nome: "Contrato de consultoria - CQ.pdf", categoria: "contrato", tamanhoBytes: 486_400, criadoEm: COMPETENCIAS[0], enviadoPor: "Cristiane Queiroz" },
  { id: "doc-02", nome: "Diagnóstico empresarial inicial.pdf", categoria: "relatorio", tamanhoBytes: 2_310_144, criadoEm: COMPETENCIAS[0], enviadoPor: "Cristiane Queiroz" },
  { id: "doc-03", nome: "DRE gerencial consolidada.xlsx", categoria: "demonstrativo", tamanhoBytes: 148_480, criadoEm: COMPETENCIAS[9], enviadoPor: "Juliana Reis" },
  { id: "doc-04", nome: "Fluxo de caixa projetado 90 dias.xlsx", categoria: "planilha", tamanhoBytes: 96_256, criadoEm: COMPETENCIAS[10], enviadoPor: "Juliana Reis" },
  { id: "doc-05", nome: "Política de compras e cotação.docx", categoria: "procedimento", tamanhoBytes: 71_680, criadoEm: COMPETENCIAS[6], enviadoPor: "Marcos Andrade" },
  { id: "doc-06", nome: "Ficha técnica - cardápio completo.xlsx", categoria: "planilha", tamanhoBytes: 312_320, criadoEm: COMPETENCIAS[5], enviadoPor: "Marcos Andrade" },
  { id: "doc-07", nome: "Apresentação de resultados - trimestre.pptx", categoria: "apresentacao", tamanhoBytes: 5_872_640, criadoEm: COMPETENCIAS[11], enviadoPor: "Cristiane Queiroz" },
  { id: "doc-08", nome: "Procedimento de conciliação bancária.pdf", categoria: "procedimento", tamanhoBytes: 204_800, criadoEm: COMPETENCIAS[8], enviadoPor: "Juliana Reis" },
  { id: "doc-09", nome: "Balancete patrimonial.pdf", categoria: "demonstrativo", tamanhoBytes: 389_120, criadoEm: COMPETENCIAS[11], enviadoPor: "Contabilidade Prisma" },
  { id: "doc-10", nome: "Estudo de precificação e concorrência.pdf", categoria: "relatorio", tamanhoBytes: 1_638_400, criadoEm: COMPETENCIAS[10], enviadoPor: "Patrícia Lemos" },
];

export const REUNIOES: Reuniao[] = [
  {
    id: "reu-01", tipo: "reuniao", titulo: "Reunião de abertura e alinhamento",
    data: `${COMPETENCIAS[0]}T14:00:00`, participantes: "Cristiane Queiroz, sócios, gerência",
    ata: "Apresentado o escopo da consultoria e o cronograma das primeiras 12 semanas. Levantadas as principais dores: falta de visibilidade de caixa, CMV alto e dependência de OTAs.",
    gravacaoUrl: null,
  },
  {
    id: "reu-02", tipo: "reuniao", titulo: "Apresentação do diagnóstico inicial",
    data: `${COMPETENCIAS[1]}T14:00:00`, participantes: "Cristiane Queiroz, sócios",
    ata: "Diagnóstico apresentado com pontuação por área. Maturidade geral de 36/100. Definidas as três frentes prioritárias: CMV, caixa e inadimplência.",
    gravacaoUrl: "#",
  },
  {
    id: "reu-03", tipo: "treinamento", titulo: "Treinamento: leitura de DRE gerencial",
    data: `${COMPETENCIAS[3]}T09:00:00`, participantes: "Sócios, gerência, controladoria",
    ata: "Treinamento de 3h sobre estrutura da DRE, margem de contribuição e ponto de equilíbrio. Material de apoio disponibilizado em Documentos.",
    gravacaoUrl: "#",
  },
  {
    id: "reu-04", tipo: "treinamento", titulo: "Treinamento: ficha técnica e controle de CMV",
    data: `${COMPETENCIAS[5]}T09:00:00`, participantes: "Chef, cozinha, compras",
    ata: "Construção conjunta das fichas técnicas dos 40 itens do cardápio. Definida rotina de inventário semanal.",
    gravacaoUrl: "#",
  },
  {
    id: "reu-05", tipo: "reuniao", titulo: "Revisão trimestral de resultados",
    data: `${COMPETENCIAS[7]}T14:00:00`, participantes: "Cristiane Queiroz, sócios",
    ata: "CMV reduzido de 38% para 33%. Margem subiu de 6,4% para 10,1%. Aprovado o avanço na frente comercial.",
    gravacaoUrl: "#",
  },
  {
    id: "reu-06", tipo: "treinamento", titulo: "Treinamento: revenue management",
    data: `${COMPETENCIAS[9]}T09:00:00`, participantes: "Comercial, reservas, gerência",
    ata: "Fundamentos de tarifação dinâmica, análise de concorrência e gestão de canais. Definida rotina semanal de pesquisa de tarifas.",
    gravacaoUrl: "#",
  },
  {
    id: "reu-07", tipo: "reuniao", titulo: "Reunião mensal de resultados",
    data: `${COMPETENCIAS[11]}T14:00:00`, participantes: "Cristiane Queiroz, sócios, controladoria",
    ata: "Margem atingiu 14,8%, próxima da meta de 15%. Foco do próximo ciclo: reduzir dependência de OTAs e estruturar a área de RH.",
    gravacaoUrl: null,
  },
];

export const ALERTAS: Alerta[] = [
  {
    id: "al-01", severidade: "critico",
    titulo: "R$ 69,1 mil a receber em atraso",
    descricao: "Três títulos vencidos, o mais antigo há 22 dias (Prefeitura de Foz). Régua de cobrança ainda em implantação.",
  },
  {
    id: "al-02", severidade: "atencao",
    titulo: "R$ 20,1 mil a pagar vencidos",
    descricao: "Hortifruti Paraná e Ar Frio Refrigeração. Risco de juros e de restrição de fornecimento.",
  },
  {
    id: "al-03", severidade: "atencao",
    titulo: "Folha ainda em 34% do faturamento",
    descricao: "Acima da meta de 32%. A ação de redimensionamento da escala está em 40%.",
  },
  {
    id: "al-04", severidade: "info",
    titulo: "Concentração de vencimentos na próxima semana",
    descricao: "R$ 59,5 mil a pagar entre os dias 6 e 13, contra R$ 84,3 mil previstos de recebimento da Booking.",
  },
];
