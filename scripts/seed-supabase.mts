import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

type Segmento = "geral" | "hotelaria" | "comercio" | "servicos" | "industria" | "alimentacao";
type GrupoDre =
  | "receita_bruta"
  | "deducoes"
  | "custo_variavel"
  | "despesa_pessoal"
  | "despesa_administrativa"
  | "despesa_comercial"
  | "despesa_financeira"
  | "investimento"
  | "nao_operacional"
  | "outros";

type TipoConta = "receita" | "deducao" | "custo" | "despesa" | "investimento" | "nao_operacional";
type Area = "financeiro" | "compras" | "estoque" | "comercial" | "rh" | "processos" | "tecnologia" | "gestao";

interface EmpresaSeed {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: Segmento;
}

interface PlanoContaSeed {
  codigo: string;
  nome: string;
  tipo: TipoConta;
  grupo_dre: GrupoDre;
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const hoje = new Date();
const competenciaAtual = inicioMes(hoje);
const competencias = Array.from({ length: 6 }, (_, index) => {
  const data = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - index), 1);
  return iso(data);
});

const planoContas: PlanoContaSeed[] = [
  { codigo: "3.1.01", nome: "Receita de vendas", tipo: "receita", grupo_dre: "receita_bruta" },
  { codigo: "3.1.02", nome: "Receita de servicos", tipo: "receita", grupo_dre: "receita_bruta" },
  { codigo: "4.1.01", nome: "Impostos sobre vendas", tipo: "deducao", grupo_dre: "deducoes" },
  { codigo: "4.2.01", nome: "CMV / insumos", tipo: "custo", grupo_dre: "custo_variavel" },
  { codigo: "5.1.01", nome: "Folha de pagamento", tipo: "despesa", grupo_dre: "despesa_pessoal" },
  { codigo: "5.2.01", nome: "Aluguel", tipo: "despesa", grupo_dre: "despesa_administrativa" },
  { codigo: "5.2.02", nome: "Energia e internet", tipo: "despesa", grupo_dre: "despesa_administrativa" },
  { codigo: "5.3.01", nome: "Marketing e vendas", tipo: "despesa", grupo_dre: "despesa_comercial" },
  { codigo: "5.4.01", nome: "Tarifas e juros", tipo: "despesa", grupo_dre: "despesa_financeira" },
  { codigo: "6.1.01", nome: "Equipamentos", tipo: "investimento", grupo_dre: "investimento" },
];

const areas: Area[] = ["financeiro", "compras", "estoque", "comercial", "rh", "processos", "tecnologia", "gestao"];

async function main() {
  const empresas = await listarOuCriarEmpresas();
  const planos = await garantirPlanos();

  for (const [index, empresa] of empresas.entries()) {
    const plano = planos[index % planos.length];
    await seedEmpresa(empresa, plano.id, index);
  }

  console.log(`Seed concluido para ${empresas.length} empresa(s).`);
}

async function listarOuCriarEmpresas(): Promise<EmpresaSeed[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, segmento")
    .order("razao_social");

  if (error) throw error;
  if (data && data.length > 0) return data as EmpresaSeed[];

  const empresa = {
    id: uuid("empresa:cq-demo"),
    razao_social: "Cliente Demonstração Ltda.",
    nome_fantasia: "Cliente Demonstração",
    cnpj: "00000000000191",
    segmento: "servicos" satisfies Segmento,
    regime_tributario: "simples",
    data_abertura: "2022-01-10",
    qtd_funcionarios: 12,
    ativo: true,
  };

  const { data: criada, error: insertError } = await supabase
    .from("empresas")
    .upsert(empresa, { onConflict: "cnpj" })
    .select("id, razao_social, nome_fantasia, cnpj, segmento")
    .single();

  if (insertError) throw insertError;
  return [criada as EmpresaSeed];
}

async function garantirPlanos() {
  const sementes = [
    {
      nome: "Essencial",
      descricao: "Gestao financeira essencial para empresas em organizacao.",
      preco_mensal: 297,
      preco_anual: 2970,
      trial_dias: 14,
      recursos: ["Dashboard executivo", "Fluxo de caixa", "Contas a pagar e receber"],
      limite_usuarios: 3,
      limite_empresas: 1,
      publico: true,
      ativo: true,
      ordem: 1,
    },
    {
      nome: "Profissional",
      descricao: "Gestao completa com acompanhamento consultivo.",
      preco_mensal: 597,
      preco_anual: 5970,
      trial_dias: 14,
      recursos: ["DRE gerencial", "Indicadores", "Plano de acao", "Diagnostico e maturidade"],
      limite_usuarios: 10,
      limite_empresas: 3,
      publico: true,
      ativo: true,
      ordem: 2,
    },
    {
      nome: "Enterprise",
      descricao: "Operacao multiempresa com consultoria dedicada.",
      preco_mensal: 1197,
      preco_anual: 11970,
      trial_dias: 0,
      recursos: ["Usuarios ilimitados", "Documentos", "Reunioes e treinamentos"],
      limite_usuarios: null,
      limite_empresas: null,
      publico: true,
      ativo: true,
      ordem: 3,
    },
  ];

  const planos = [];

  for (const semente of sementes) {
    const { data: existente, error: selectError } = await supabase
      .from("planos")
      .select("id, nome, preco_mensal, preco_anual")
      .eq("nome", semente.nome)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existente) {
      planos.push(existente);
      continue;
    }

    const { data: criado, error: insertError } = await supabase
      .from("planos")
      .insert({ id: uuid(`plano:${semente.nome}`), ...semente })
      .select("id, nome, preco_mensal, preco_anual")
      .single();

    if (insertError) throw insertError;
    planos.push(criado);
  }

  return planos;
}

async function seedEmpresa(empresa: EmpresaSeed, planoId: string, offset: number) {
  console.log(`Alimentando ${empresa.nome_fantasia ?? empresa.razao_social}...`);

  const contas = await garantirPlanoContas(empresa.id);
  await garantirContaBancaria(empresa.id, offset);
  await garantirLancamentos(empresa.id, contas, offset);
  await garantirTitulos(empresa.id, contas, offset);
  await garantirOrcamento(empresa.id, contas, offset);
  await garantirIndicadores(empresa.id, offset);
  await garantirPlanosAcao(empresa.id, offset);
  await garantirDiagnosticos(empresa.id, offset);
  await garantirMaturidade(empresa.id, offset);
  await garantirDocumentos(empresa.id, offset);
  await garantirReunioes(empresa.id, offset);
  await garantirAlertas(empresa.id, offset);
  await garantirAssinaturaEFaturas(empresa.id, planoId, offset);
}

async function garantirPlanoContas(empresaId: string) {
  const registros = planoContas.map((conta) => ({
    id: uuid(`plano-conta:${empresaId}:${conta.codigo}`),
    empresa_id: empresaId,
    ...conta,
    ativo: true,
  }));

  const { error } = await supabase
    .from("plano_contas")
    .upsert(registros, { onConflict: "empresa_id,codigo" });

  if (error) throw error;

  const { data, error: selectError } = await supabase
    .from("plano_contas")
    .select("id, codigo, tipo, grupo_dre")
    .eq("empresa_id", empresaId);

  if (selectError) throw selectError;
  return data ?? [];
}

async function garantirContaBancaria(empresaId: string, offset: number) {
  const { error } = await supabase.from("contas_bancarias").upsert({
    id: uuid(`conta-bancaria:${empresaId}:principal`),
    empresa_id: empresaId,
    nome: "Conta principal",
    banco: "Banco exemplo",
    tipo: "corrente",
    saldo_inicial: 18000 + offset * 3500,
    ativo: true,
  });

  if (error) throw error;
}

async function garantirLancamentos(empresaId: string, contas: { id: string; codigo: string }[], offset: number) {
  const conta = (codigo: string) => contas.find((item) => item.codigo === codigo)?.id ?? null;
  const registros = competencias.flatMap((competencia, index) => {
    const fator = 1 + offset * 0.08 + index * 0.025;
    const base = new Date(`${competencia}T12:00:00`);
    const dia = (n: number) => iso(new Date(base.getFullYear(), base.getMonth(), n));
    return [
      lancamento(empresaId, competencia, "vendas", dia(5), "entrada", 42000 * fator, "Recebimento de vendas", "Clientes", conta("3.1.01")),
      lancamento(empresaId, competencia, "servicos", dia(12), "entrada", 9800 * fator, "Recebimento de servicos", "Clientes", conta("3.1.02")),
      lancamento(empresaId, competencia, "impostos", dia(16), "saida", 5200 * fator, "Impostos sobre vendas", "Receita Federal", conta("4.1.01")),
      lancamento(empresaId, competencia, "insumos", dia(18), "saida", 14500 * fator, "Compra de insumos", "Fornecedores", conta("4.2.01")),
      lancamento(empresaId, competencia, "folha", dia(25), "saida", 12600 * fator, "Folha de pagamento", "Equipe", conta("5.1.01")),
      lancamento(empresaId, competencia, "aluguel", dia(10), "saida", 4800 * fator, "Aluguel", "Imobiliaria", conta("5.2.01")),
      lancamento(empresaId, competencia, "marketing", dia(20), "saida", 2200 * fator, "Campanhas comerciais", "Agencia", conta("5.3.01")),
    ];
  });

  const { error } = await supabase.from("lancamentos").upsert(registros);
  if (error) throw error;
}

function lancamento(
  empresaId: string,
  competencia: string,
  chave: string,
  data: string,
  tipo: "entrada" | "saida",
  valor: number,
  descricao: string,
  contraparte: string,
  planoContaId: string | null,
) {
  return {
    id: uuid(`lancamento:${empresaId}:${competencia}:${chave}`),
    empresa_id: empresaId,
    data,
    tipo,
    valor: Math.round(valor * 100) / 100,
    descricao,
    contraparte,
    plano_conta_id: planoContaId,
    origem: "manual",
  };
}

async function garantirTitulos(empresaId: string, contas: { id: string; codigo: string }[], offset: number) {
  const conta = (codigo: string) => contas.find((item) => item.codigo === codigo)?.id ?? null;
  const registros = [
    titulo(empresaId, "receber", "Cliente Alpha", -12, 7200 + offset * 350, 0, "aberto", conta("3.1.01")),
    titulo(empresaId, "receber", "Cliente Beta", 8, 5400 + offset * 300, 0, "aberto", conta("3.1.02")),
    titulo(empresaId, "receber", "Cliente Gamma", -28, 4100 + offset * 220, 4100 + offset * 220, "pago", conta("3.1.01")),
    titulo(empresaId, "pagar", "Fornecedor Central", -5, 3800 + offset * 200, 0, "aberto", conta("4.2.01")),
    titulo(empresaId, "pagar", "Energia e internet", 6, 1450 + offset * 120, 0, "aberto", conta("5.2.02")),
    titulo(empresaId, "pagar", "Marketing", -20, 2200 + offset * 180, 2200 + offset * 180, "pago", conta("5.3.01")),
  ];

  const { error } = await supabase.from("titulos").upsert(registros);
  if (error) throw error;
}

function titulo(
  empresaId: string,
  tipo: "pagar" | "receber",
  contraparte: string,
  vencimentoOffset: number,
  valor: number,
  valorPago: number,
  status: "aberto" | "parcial" | "pago" | "cancelado",
  planoContaId: string | null,
) {
  const vencimento = dataRelativa(vencimentoOffset);
  return {
    id: uuid(`titulo:${empresaId}:${tipo}:${contraparte}:${vencimento}`),
    empresa_id: empresaId,
    tipo,
    contraparte,
    documento: null,
    emissao: dataRelativa(vencimentoOffset - 20),
    vencimento,
    valor: Math.round(valor * 100) / 100,
    valor_pago: Math.round(valorPago * 100) / 100,
    data_pagamento: status === "pago" ? dataRelativa(vencimentoOffset + 1) : null,
    status,
    plano_conta_id: planoContaId,
    origem: "manual",
  };
}

async function garantirOrcamento(empresaId: string, contas: { id: string; codigo: string; tipo: string }[], offset: number) {
  const registros = competencias.flatMap((competencia, index) =>
    contas.map((conta) => {
      const sinal = conta.tipo === "receita" ? 1 : -1;
      const valorBase = conta.tipo === "receita" ? 25000 : 4500;
      return {
        id: uuid(`orcamento:${empresaId}:${competencia}:${conta.id}`),
        empresa_id: empresaId,
        plano_conta_id: conta.id,
        competencia,
        valor_previsto: Math.round((valorBase * (1 + offset * 0.05 + index * 0.02) * sinal) * 100) / 100,
      };
    }),
  );

  const { error } = await supabase
    .from("orcamentos")
    .upsert(registros, { onConflict: "empresa_id,plano_conta_id,competencia" });

  if (error) throw error;
}

async function garantirIndicadores(empresaId: string, offset: number) {
  const indicadores = [
    indicador(empresaId, "margem_liquida", "Margem liquida", "Percentual de resultado sobre receita", "percentual", "maior_melhor"),
    indicador(empresaId, "ticket_medio", "Ticket medio", "Valor medio por venda", "moeda", "maior_melhor"),
    indicador(empresaId, "prazo_recebimento", "Prazo medio de recebimento", "Dias entre venda e recebimento", "dias", "menor_melhor"),
  ];

  const { error } = await supabase
    .from("indicadores")
    .upsert(indicadores, { onConflict: "empresa_id,codigo" });

  if (error) throw error;

  const valores = indicadores.flatMap((indicador, indicadorIndex) =>
    competencias.map((competencia, index) => ({
      id: uuid(`indicador-valor:${empresaId}:${indicador.codigo}:${competencia}`),
      indicador_id: indicador.id,
      empresa_id: empresaId,
      competencia,
      valor: indicador.codigo === "prazo_recebimento"
        ? 34 - index - offset
        : indicador.codigo === "ticket_medio"
          ? 180 + index * 8 + offset * 12
          : 8 + index * 1.2 + indicadorIndex + offset,
      meta: indicador.codigo === "prazo_recebimento" ? 28 : indicador.codigo === "ticket_medio" ? 220 : 15,
    })),
  );

  const { error: valoresError } = await supabase
    .from("indicador_valores")
    .upsert(valores, { onConflict: "indicador_id,empresa_id,competencia" });

  if (valoresError) throw valoresError;
}

function indicador(
  empresaId: string,
  codigo: string,
  nome: string,
  descricao: string,
  unidade: "percentual" | "moeda" | "numero" | "dias",
  direcaoMeta: "maior_melhor" | "menor_melhor",
) {
  return {
    id: uuid(`indicador:${empresaId}:${codigo}`),
    empresa_id: empresaId,
    codigo,
    nome,
    descricao,
    segmento: "geral",
    unidade,
    direcao_meta: direcaoMeta,
    ativo: true,
  };
}

async function garantirPlanosAcao(empresaId: string, offset: number) {
  const registros = [
    {
      id: uuid(`plano-acao:${empresaId}:cobranca`),
      empresa_id: empresaId,
      problema: "Recebimentos vencidos sem rotina formal de cobranca.",
      acao: "Implantar regua semanal de cobranca e registrar retornos.",
      area: "financeiro",
      responsavel: "Consultoria CQ",
      prazo: dataRelativa(14 + offset),
      prioridade: "alta",
      status: "em_andamento",
      percentual: 55,
      impacto_estimado: 6500 + offset * 500,
    },
    {
      id: uuid(`plano-acao:${empresaId}:compras`),
      empresa_id: empresaId,
      problema: "Compras sem cotacao padronizada.",
      acao: "Criar rotina de cotacao com tres fornecedores por categoria.",
      area: "compras",
      responsavel: "Gestor da empresa",
      prazo: dataRelativa(28 + offset),
      prioridade: "media",
      status: "nao_iniciado",
      percentual: 0,
      impacto_estimado: 4200 + offset * 350,
    },
  ];

  const { error } = await supabase.from("planos_acao").upsert(registros);
  if (error) throw error;
}

async function garantirDiagnosticos(empresaId: string, offset: number) {
  for (const [index, competencia] of competencias.slice(0, 3).entries()) {
    const diagnosticoId = uuid(`diagnostico:${empresaId}:${competencia}`);
    const { error } = await supabase.from("diagnosticos").upsert(
      {
        id: diagnosticoId,
        empresa_id: empresaId,
        competencia,
        observacoes: `Leitura ${index + 1}: controles em evolucao e prioridades revisadas.`,
      },
      { onConflict: "empresa_id,competencia" },
    );
    if (error) throw error;

    const itens = areas.map((area, areaIndex) => ({
      id: uuid(`diagnostico-item:${diagnosticoId}:${area}`),
      diagnostico_id: diagnosticoId,
      categoria: area,
      nota: Math.min(92, 38 + index * 10 + areaIndex * 3 + offset),
      observacao: "Rotina avaliada e proximo passo definido.",
    }));

    const { error: itensError } = await supabase
      .from("diagnostico_itens")
      .upsert(itens, { onConflict: "diagnostico_id,categoria" });

    if (itensError) throw itensError;
  }
}

async function garantirMaturidade(empresaId: string, offset: number) {
  for (const [index, competencia] of competencias.entries()) {
    const avaliacaoId = uuid(`maturidade:${empresaId}:${competencia}`);
    const pontuacao = Math.min(88, 42 + index * 5 + offset);
    const { error } = await supabase.from("maturidade_avaliacoes").upsert(
      {
        id: avaliacaoId,
        empresa_id: empresaId,
        competencia,
        pontuacao_geral: pontuacao,
      },
      { onConflict: "empresa_id,competencia" },
    );
    if (error) throw error;

    const itens = areas.map((area, areaIndex) => ({
      id: uuid(`maturidade-item:${avaliacaoId}:${area}`),
      avaliacao_id: avaliacaoId,
      categoria: area,
      pontuacao: Math.min(95, pontuacao - 8 + areaIndex * 2),
    }));

    const { error: itensError } = await supabase
      .from("maturidade_itens")
      .upsert(itens, { onConflict: "avaliacao_id,categoria" });

    if (itensError) throw itensError;
  }
}

async function garantirDocumentos(empresaId: string, offset: number) {
  const registros = [
    {
      id: uuid(`documento:${empresaId}:diagnostico`),
      empresa_id: empresaId,
      nome: "Diagnostico empresarial inicial.pdf",
      categoria: "relatorio",
      storage_path: `seed/${empresaId}/diagnostico.pdf`,
      tamanho_bytes: 380000 + offset * 1000,
      mime_type: "application/pdf",
      visivel_cliente: true,
    },
    {
      id: uuid(`documento:${empresaId}:dre`),
      empresa_id: empresaId,
      nome: "DRE gerencial consolidada.xlsx",
      categoria: "demonstrativo",
      storage_path: `seed/${empresaId}/dre.xlsx`,
      tamanho_bytes: 128000 + offset * 1000,
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      visivel_cliente: true,
    },
  ];

  const { error } = await supabase.from("documentos").upsert(registros);
  if (error) throw error;
}

async function garantirReunioes(empresaId: string, offset: number) {
  const registros = [
    {
      id: uuid(`reuniao:${empresaId}:resultado`),
      empresa_id: empresaId,
      tipo: "reuniao",
      titulo: "Reuniao mensal de resultados",
      data: `${dataRelativa(-10 - offset)}T14:00:00-03:00`,
      participantes: "Consultoria CQ, socios e financeiro",
      ata: "Resultados revisados, prioridades financeiras alinhadas e proximas acoes definidas.",
      gravacao_url: null,
    },
    {
      id: uuid(`reuniao:${empresaId}:treinamento-dre`),
      empresa_id: empresaId,
      tipo: "treinamento",
      titulo: "Treinamento: leitura de DRE gerencial",
      data: `${dataRelativa(-25 - offset)}T09:00:00-03:00`,
      participantes: "Gestores, financeiro e consultoria",
      ata: "Conceitos de receita, margem, custos e despesas apresentados ao time.",
      gravacao_url: "https://example.com/gravacao-dre",
    },
  ];

  const { error } = await supabase.from("reunioes").upsert(registros);
  if (error) throw error;
}

async function garantirAlertas(empresaId: string, offset: number) {
  const registros = [
    {
      id: uuid(`alerta:${empresaId}:receber`),
      empresa_id: empresaId,
      tipo: "financeiro",
      severidade: "atencao",
      titulo: "Recebimentos vencidos",
      descricao: "Existem titulos a receber vencidos que precisam de cobranca ativa.",
      resolvido: false,
    },
    {
      id: uuid(`alerta:${empresaId}:caixa`),
      empresa_id: empresaId,
      tipo: "financeiro",
      severidade: offset % 2 === 0 ? "info" : "atencao",
      titulo: "Acompanhar caixa projetado",
      descricao: "Revise os compromissos dos proximos dias e confirme entradas previstas.",
      resolvido: false,
    },
  ];

  const { error } = await supabase.from("alertas").upsert(registros);
  if (error) throw error;
}

async function garantirAssinaturaEFaturas(empresaId: string, planoId: string, offset: number) {
  const assinaturaId = uuid(`assinatura:${empresaId}`);
  const vencida = offset % 3 === 0;

  const { error } = await supabase.from("assinaturas").upsert(
    {
      id: assinaturaId,
      empresa_id: empresaId,
      plano_id: planoId,
      ciclo: "mensal",
      status: "ativa",
      dia_vencimento: 5,
      carencia_dias: 7,
      inicio: dataRelativa(-120),
      trial_fim: null,
      bloqueio_manual: false,
      cancelada_em: null,
    },
    { onConflict: "empresa_id" },
  );
  if (error) throw error;

  const registros = [
    {
      id: uuid(`fatura:${empresaId}:${competenciaAtual}`),
      assinatura_id: assinaturaId,
      empresa_id: empresaId,
      competencia: competenciaAtual,
      emissao: dataRelativa(-12),
      vencimento: vencida ? dataRelativa(-4) : dataRelativa(9),
      valor: 597,
      valor_pago: 0,
      status: "aberta",
      pago_em: null,
      metodo_pagamento: null,
      referencia_externa: null,
      observacao: null,
    },
    {
      id: uuid(`fatura:${empresaId}:${competencias[competencias.length - 2]}`),
      assinatura_id: assinaturaId,
      empresa_id: empresaId,
      competencia: competencias[competencias.length - 2],
      emissao: dataRelativa(-42),
      vencimento: dataRelativa(-30),
      valor: 597,
      valor_pago: 597,
      status: "paga",
      pago_em: dataRelativa(-28),
      metodo_pagamento: "pix",
      referencia_externa: null,
      observacao: null,
    },
  ];

  const { error: faturasError } = await supabase.from("faturas").upsert(registros);
  if (faturasError) throw faturasError;
}

function uuid(seed: string) {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const conteudo = readFileSync(envPath, "utf8");
  for (const linha of conteudo.split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const chave = trimmed.slice(0, index);
    const valor = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
    process.env[chave] ??= valor;
  }
}

function inicioMes(data: Date) {
  return iso(new Date(data.getFullYear(), data.getMonth(), 1));
}

function dataRelativa(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return iso(data);
}

function iso(data: Date) {
  return data.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error("Falha ao executar seed:");
  console.error(error);
  process.exit(1);
});
