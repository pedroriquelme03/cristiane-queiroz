import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

/**
 * Dados demonstrativos reais, isolados por empresa no Supabase.
 *
 * A allowlist EMPRESAS_DEMO impede que este script escreva em clientes reais.
 * Assinaturas e acessos nunca sao alterados. Os UUIDs deterministicos tornam
 * novas execucoes idempotentes para o mesmo mes de referencia.
 */

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
const competencias = Array.from({ length: 12 }, (_, index) => {
  const data = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - index), 1);
  return iso(data);
});

const EMPRESAS_DEMO = new Set([
  "TESTE ESSENCIAL",
  "TESTE PROFISSIONAL",
  "TESTE ENTERPRISE",
]);
const empresaSolicitada = argumentoEmpresa();

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
  const empresas = await listarEmpresasDemo();

  for (const empresa of empresas) {
    await seedEmpresa(empresa, indiceEmpresa(empresa));
  }

  console.log(`Demo concluida para ${empresas.length} empresa(s) de teste.`);
}

async function listarEmpresasDemo(): Promise<EmpresaSeed[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, razao_social, nome_fantasia, cnpj, segmento")
    .order("razao_social");

  if (error) throw error;
  const empresas = (data ?? []).filter((empresa) => {
    const nome = (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase();
    return EMPRESAS_DEMO.has(nome);
  }) as EmpresaSeed[];

  const empresasAlvo = empresaSolicitada ? new Set([empresaSolicitada]) : EMPRESAS_DEMO;
  const filtradas = empresas.filter((empresa) => {
    const nome = (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase();
    return empresasAlvo.has(nome);
  });

  if (filtradas.length !== empresasAlvo.size) {
    const encontradas = new Set(empresas.map((empresa) =>
      (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase(),
    ));
    const faltantes = [...empresasAlvo].filter((nome) => !encontradas.has(nome));
    throw new Error(`Empresas demo nao encontradas: ${faltantes.join(", ")}.`);
  }

  return filtradas;
}

async function seedEmpresa(empresa: EmpresaSeed, offset: number) {
  console.log(`Alimentando ${empresa.nome_fantasia ?? empresa.razao_social}...`);

  const contas = await garantirPlanoContas(empresa.id);
  await garantirEstrutura(empresa);
  await garantirContaBancaria(empresa);
  await garantirLancamentos(empresa, contas);
  await garantirTitulos(empresa, contas);
  await garantirOrcamento(empresa, contas);
  await garantirIndicadores(empresa);
  await garantirPlanosAcao(empresa.id, offset);
  await garantirDiagnosticos(empresa.id, offset);
  await garantirMaturidade(empresa.id, offset);
  await garantirDocumentos(empresa.id, offset);
  await garantirReunioes(empresa.id, offset);
  await garantirAlertas(empresa);
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

async function garantirEstrutura(empresa: EmpresaSeed) {
  const nome = (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase();
  const perfil = nome.includes("ENTERPRISE")
    ? {
        colaboradores: 32,
        unidades: [
          ["Hotel Centro", "matriz", "Foz do Iguacu", "PR"],
          ["Hotel Cataratas", "filial", "Foz do Iguacu", "PR"],
        ],
        areas: [
          ["Administrativo", [["Gerencia", 2], ["Financeiro", 4]]],
          ["Hospedagem", [["Recepcao", 6], ["Governanca", 6]]],
          ["Alimentos e bebidas", [["Cozinha", 4], ["Salao", 4]]],
          ["Comercial", [["Vendas", 4], ["Marketing", 2]]],
        ],
      }
    : nome.includes("PROFISSIONAL")
      ? {
          colaboradores: 18,
          unidades: [["Pousada Principal", "matriz", "Foz do Iguacu", "PR"]],
          areas: [
            ["Administrativo", [["Gestao", 2], ["Financeiro", 2]]],
            ["Hospedagem", [["Recepcao", 4], ["Governanca", 4]]],
            ["Alimentos e bebidas", [["Cozinha", 3], ["Salao", 3]]],
          ],
        }
      : {
          colaboradores: 8,
          unidades: [["Loja Principal", "matriz", "Foz do Iguacu", "PR"]],
          areas: [
            ["Administrativo", [["Financeiro", 2]]],
            ["Comercial", [["Vendas", 3]]],
            ["Operacoes", [["Atendimento", 3]]],
          ],
        };

  const { error: empresaError } = await supabase
    .from("empresas")
    .update({ qtd_funcionarios: perfil.colaboradores })
    .eq("id", empresa.id);
  if (empresaError) throw empresaError;

  const unidades = perfil.unidades.map(([unidadeNome, tipo, cidade, uf]) => ({
    id: uuid(`demo:unidade:${empresa.id}:${unidadeNome}`),
    empresa_id: empresa.id,
    nome: unidadeNome,
    tipo,
    cidade,
    uf,
    ativo: true,
  }));
  const { error: unidadesError } = await supabase.from("unidades").upsert(unidades);
  if (unidadesError) throw unidadesError;

  for (const [areaIndex, [areaNome, cargos]] of perfil.areas.entries()) {
    const areaId = uuid(`demo:area:${empresa.id}:${areaNome}`);
    const { error: areaError } = await supabase.from("estrutura_areas").upsert(
      { id: areaId, empresa_id: empresa.id, nome: areaNome, ordem: areaIndex },
      { onConflict: "empresa_id,nome" },
    );
    if (areaError) throw areaError;

    const registrosCargos = (cargos as [string, number][]).map(([cargoNome, quantidade], cargoIndex) => ({
      id: uuid(`demo:cargo:${empresa.id}:${areaNome}:${cargoNome}`),
      empresa_id: empresa.id,
      area_id: areaId,
      nome: cargoNome,
      quantidade,
      ordem: cargoIndex,
    }));
    const { error: cargosError } = await supabase
      .from("estrutura_cargos")
      .upsert(registrosCargos, { onConflict: "area_id,nome" });
    if (cargosError) throw cargosError;
  }
}

async function garantirContaBancaria(empresa: EmpresaSeed) {
  const empresaId = empresa.id;
  const perfil = tipoPerfil(empresa);
  const conta = perfil === "essencial"
    ? { nome: "Conta operacional", banco: "Banco do Brasil", saldo: 10000 }
    : perfil === "profissional"
      ? { nome: "Conta corrente principal", banco: "Sicredi", saldo: 28000 }
      : { nome: "Conta consolidada da rede", banco: "Itau", saldo: 65000 };
  const { error } = await supabase.from("contas_bancarias").upsert({
    id: uuid(`conta-bancaria:${empresaId}:principal`),
    empresa_id: empresaId,
    nome: conta.nome,
    banco: conta.banco,
    tipo: "corrente",
    saldo_inicial: conta.saldo,
    ativo: true,
  });

  if (error) throw error;
}

async function garantirLancamentos(empresa: EmpresaSeed, contas: { id: string; codigo: string }[]) {
  const empresaId = empresa.id;
  const conta = (codigo: string) => contas.find((item) => item.codigo === codigo)?.id ?? null;
  const registros = competencias.flatMap((competencia, index) => {
    const base = new Date(`${competencia}T12:00:00`);
    const dia = (n: number) => iso(new Date(base.getFullYear(), base.getMonth(), n));
    const perfil = perfilFinanceiro(empresa, base, index);
    return [
      ...lancamentosDistribuidos(empresaId, competencia, "vendas", [3, 5, 7, 10, 13, 16, 19, 22, 25], "entrada", perfil.vendas, perfil.descricoes[0], perfil.contrapartes[0], conta("3.1.01")),
      ...lancamentosDistribuidos(empresaId, competencia, "servicos", [2, 4, 8, 11, 14, 18, 21, 24, 27], "entrada", perfil.servicos, perfil.descricoes[1], perfil.contrapartes[1], conta("3.1.02")),
      lancamento(empresaId, competencia, "impostos", dia(16), "saida", perfil.impostos, "Impostos e taxas sobre faturamento", "Receita Federal", conta("4.1.01")),
      lancamento(empresaId, competencia, "insumos", dia(18), "saida", perfil.insumos, perfil.descricoes[2], perfil.contrapartes[2], conta("4.2.01")),
      lancamento(empresaId, competencia, "folha", dia(25), "saida", perfil.folha, "Folha de pagamento e encargos", "Equipe", conta("5.1.01")),
      lancamento(empresaId, competencia, "aluguel", dia(10), "saida", perfil.aluguel, perfil.descricoes[3], perfil.contrapartes[3], conta("5.2.01")),
      lancamento(empresaId, competencia, "energia", dia(14), "saida", perfil.energia, "Energia, internet e utilidades", "Concessionarias e operadoras", conta("5.2.02")),
      lancamento(empresaId, competencia, "marketing", dia(20), "saida", perfil.marketing, perfil.descricoes[4], perfil.contrapartes[4], conta("5.3.01")),
    ];
  });

  const { error } = await supabase.from("lancamentos").upsert(registros);
  if (error) throw error;
}

function perfilFinanceiro(empresa: EmpresaSeed, competencia: Date, index: number) {
  const perfil = tipoPerfil(empresa);
  if (perfil === "essencial") return perfilFinanceiroEssencial(competencia);

  if (perfil === "profissional") {
    const receita = 59000 + index * 1700;
    const despesas = 46500 + index * 850;
    return distribuirPerfilFinanceiro(
      receita,
      despesas,
      [0.42, 0.58],
      [0.09, 0.28, 0.34, 0.14, 0.05, 0.10],
      ["Receita de hospedagens", "Eventos e experiencias", "Enxoval e cafe da manha", "Arrendamento da pousada", "Comissoes de agencias"],
      ["Hospedes e agencias", "Eventos corporativos", "Fornecedores locais", "Administradora do imovel", "Canais de reserva"],
    );
  }

  const sazonalidade = [0, 2500, -1800, 3200, 6000, 8500, 12000, 14500, 9000, 7000, 10500, 16000][index] ?? 0;
  const receita = 118000 + index * 3200 + sazonalidade;
  const despesas = 79000 + index * 1900;
  return distribuirPerfilFinanceiro(
    receita,
    despesas,
    [0.36, 0.64],
    [0.11, 0.3, 0.31, 0.12, 0.05, 0.11],
    ["Receita consolidada de hospedagem", "Eventos, restaurante e experiencias", "Operacao de hospedagem e A&B", "Locacao das unidades", "Campanhas nacionais e OTAs"],
    ["Hospedes, agencias e operadoras", "Eventos e grupos", "Central de suprimentos", "Administradoras das unidades", "Agencias e plataformas"],
  );
}

function perfilFinanceiroEssencial(competencia: Date) {
  const mes = competencia.getMonth();
  const anoAtual = hoje.getFullYear();
  let receita: number;
  let despesas: number;

  if (competencia.getFullYear() < anoAtual) {
    receita = 62000 + Math.max(0, mes - 8) * 1000;
    despesas = 50000 + Math.max(0, mes - 8) * 500;
  } else if (mes === 0) {
    receita = 68000;
    despesas = 52000;
  } else if (mes === 1) {
    receita = 70000;
    despesas = 54000;
  } else {
    const mesesDesdeMarco = mes - 2;
    receita = 62000 - mesesDesdeMarco * 3500;
    despesas = 65000 + mesesDesdeMarco * 1800;
  }

  return distribuirPerfilFinanceiro(
    receita,
    despesas,
    [0.88, 0.12],
    [0.1, 0.35, 0.3, 0.11, 0.04, 0.10],
    ["Vendas da loja", "Encomendas e entregas", "Reposicao de mercadorias", "Aluguel do ponto comercial", "Divulgacao local"],
    ["Clientes do varejo", "Clientes de encomendas", "Distribuidora regional", "Imobiliaria Centro", "Midia local"],
  );
}

function distribuirPerfilFinanceiro(
  receita: number,
  despesas: number,
  pesosReceita: [number, number],
  pesosDespesa: [number, number, number, number, number, number],
  descricoes: [string, string, string, string, string],
  contrapartes: [string, string, string, string, string],
) {
  return {
    vendas: receita * pesosReceita[0],
    servicos: receita * pesosReceita[1],
    impostos: despesas * pesosDespesa[0],
    insumos: despesas * pesosDespesa[1],
    folha: despesas * pesosDespesa[2],
    aluguel: despesas * pesosDespesa[3],
    energia: despesas * pesosDespesa[4],
    marketing: despesas * pesosDespesa[5],
    descricoes,
    contrapartes,
  };
}

/** Movimentos menores tornam ticket, ritmo diário e drill-downs verossímeis. */
function lancamentosDistribuidos(
  empresaId: string,
  competencia: string,
  chave: string,
  dias: number[],
  tipo: "entrada" | "saida",
  total: number,
  descricao: string,
  contraparte: string,
  planoContaId: string | null,
) {
  const pesos = [0.08, 0.11, 0.09, 0.14, 0.1, 0.12, 0.13, 0.1, 0.13];
  const base = new Date(`${competencia}T12:00:00`);
  return dias.map((dia, index) => lancamento(
    empresaId,
    competencia,
    index === 0 ? chave : `${chave}-${index + 1}`,
    iso(new Date(base.getFullYear(), base.getMonth(), dia)),
    tipo,
    total * pesos[index],
    `${descricao} — ${index === 0 ? "recebimento inicial" : `movimento ${index + 1}`}`,
    contraparte,
    planoContaId,
  ));
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

async function garantirTitulos(empresa: EmpresaSeed, contas: { id: string; codigo: string }[]) {
  const empresaId = empresa.id;
  const conta = (codigo: string) => contas.find((item) => item.codigo === codigo)?.id ?? null;
  const perfil = tipoPerfil(empresa);
  const registros = perfil === "essencial"
    ? [
        titulo(empresaId, "receber-alpha", "receber", "Mercado Boa Compra", -18, 5800, 0, "aberto", conta("3.1.01")),
        titulo(empresaId, "receber-beta", "receber", "Condominio Primavera", 10, 3200, 0, "aberto", conta("3.1.02")),
        titulo(empresaId, "receber-gamma", "receber", "Cliente balcao", -30, 1850, 1850, "pago", conta("3.1.01")),
        titulo(empresaId, "pagar-fornecedor", "pagar", "Distribuidora Regional", -9, 12500, 0, "aberto", conta("4.2.01")),
        titulo(empresaId, "pagar-energia", "pagar", "Energia da loja", 4, 6400, 0, "aberto", conta("5.2.02")),
        titulo(empresaId, "pagar-marketing", "pagar", "Midia Local", -22, 2100, 2100, "pago", conta("5.3.01")),
      ]
    : perfil === "profissional"
      ? [
          titulo(empresaId, "receber-alpha", "receber", "Agencia Rota Sul", -6, 8900, 2500, "parcial", conta("3.1.02")),
          titulo(empresaId, "receber-beta", "receber", "Grupo Executivo Parana", 12, 12800, 0, "aberto", conta("3.1.02")),
          titulo(empresaId, "receber-gamma", "receber", "Hospedagens diretas", -24, 7350, 7350, "pago", conta("3.1.01")),
          titulo(empresaId, "pagar-fornecedor", "pagar", "Enxovais Cataratas", 7, 5200, 0, "aberto", conta("4.2.01")),
          titulo(empresaId, "pagar-energia", "pagar", "Copel", 15, 2380, 0, "aberto", conta("5.2.02")),
          titulo(empresaId, "pagar-marketing", "pagar", "Portal de Reservas", -16, 3150, 3150, "pago", conta("5.3.01")),
        ]
      : [
          titulo(empresaId, "receber-alpha", "receber", "Operadora Destinos Brasil", 5, 28600, 0, "aberto", conta("3.1.02")),
          titulo(empresaId, "receber-beta", "receber", "Congresso Mercosul", 18, 41700, 0, "aberto", conta("3.1.02")),
          titulo(empresaId, "receber-gamma", "receber", "Rede Global Travel", -14, 22400, 22400, "pago", conta("3.1.01")),
          titulo(empresaId, "pagar-fornecedor", "pagar", "Central de Suprimentos Hoteleiros", 9, 16400, 0, "aberto", conta("4.2.01")),
          titulo(empresaId, "pagar-energia", "pagar", "Energia das unidades", 14, 7850, 0, "aberto", conta("5.2.02")),
          titulo(empresaId, "pagar-marketing", "pagar", "Campanha Temporada Brasil", -12, 9800, 9800, "pago", conta("5.3.01")),
        ];

  const { error } = await supabase.from("titulos").upsert(registros);
  if (error) throw error;
}

function titulo(
  empresaId: string,
  chave: string,
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
    id: uuid(`demo:titulo:${empresaId}:${competenciaAtual}:${chave}`),
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

async function garantirOrcamento(empresa: EmpresaSeed, contas: { id: string; codigo: string; tipo: string }[]) {
  const empresaId = empresa.id;
  const registros = competencias.flatMap((competencia, index) =>
    contas.map((conta) => {
      const perfil = perfilFinanceiro(empresa, new Date(`${competencia}T12:00:00`), index);
      const realizadoPorCodigo: Record<string, number> = {
        "3.1.01": perfil.vendas, "3.1.02": perfil.servicos, "4.1.01": -perfil.impostos,
        "4.2.01": -perfil.insumos, "5.1.01": -perfil.folha, "5.2.01": -perfil.aluguel,
        "5.2.02": -perfil.energia, "5.3.01": -perfil.marketing,
      };
      const ajuste = 0.96 + ((index % 4) * 0.025);
      return {
        id: uuid(`orcamento:${empresaId}:${competencia}:${conta.id}`),
        empresa_id: empresaId,
        plano_conta_id: conta.id,
        competencia,
        valor_previsto: Math.round(((realizadoPorCodigo[conta.codigo] ?? 0) * ajuste) * 100) / 100,
      };
    }),
  );

  const { error } = await supabase
    .from("orcamentos")
    .upsert(registros, { onConflict: "empresa_id,plano_conta_id,competencia" });

  if (error) throw error;
}

async function garantirIndicadores(empresa: EmpresaSeed) {
  const empresaId = empresa.id;
  const personalizados = [
    indicador(empresaId, "margem_liquida", "Margem liquida", "Percentual de resultado sobre receita", "percentual", "maior_melhor"),
    indicador(empresaId, "ticket_medio", "Ticket medio", "Valor medio por venda", "moeda", "maior_melhor"),
    indicador(empresaId, "prazo_recebimento", "Prazo medio de recebimento", "Dias entre venda e recebimento", "dias", "menor_melhor"),
  ];

  const { error } = await supabase
    .from("indicadores")
    .upsert(personalizados, { onConflict: "empresa_id,codigo" });

  if (error) throw error;

  const segmentos = empresa.segmento === "geral" ? ["geral"] : ["geral", empresa.segmento];
  const { data: templates, error: templatesError } = await supabase
    .from("indicadores")
    .select("id, codigo")
    .is("empresa_id", null)
    .in("segmento", segmentos)
    .eq("ativo", true);
  if (templatesError) throw templatesError;

  const porCodigo = new Map((templates ?? []).map((item) => [item.codigo, item]));
  for (const personalizado of personalizados) {
    porCodigo.set(personalizado.codigo, personalizado);
  }

  const valores = [...porCodigo.values()].flatMap((indicadorAtual) =>
    competencias.map((competencia, index) => {
      const demonstrativo = valorIndicadorDemo(empresa, indicadorAtual.codigo, competencia, index);
      return {
        id: uuid(`indicador-valor:${empresaId}:${indicadorAtual.codigo}:${competencia}`),
        indicador_id: indicadorAtual.id,
        empresa_id: empresaId,
        competencia,
        valor: Math.round(demonstrativo.valor * 100) / 100,
        meta: demonstrativo.meta,
      };
    }),
  );

  const { error: valoresError } = await supabase
    .from("indicador_valores")
    .upsert(valores, { onConflict: "indicador_id,empresa_id,competencia" });

  if (valoresError) throw valoresError;
}

function valorIndicadorDemo(empresa: EmpresaSeed, codigo: string, competencia: string, index: number) {
  const perfil = tipoPerfil(empresa);
  const progresso = index / Math.max(1, competencias.length - 1);

  if (perfil === "essencial") {
    const data = new Date(`${competencia}T12:00:00`);
    const pressao = pressaoFinanceiraEssencial(data);
    return interpolarIndicador(codigo, pressao, {
      margem_lucro: [18, -35, 12], margem_liquida: [16, -40, 10], capital_giro: [42000, -18000, 30000],
      liquidez_corrente: [1.9, 0.62, 1.5], endividamento: [28, 78, 45], folha_faturamento: [22, 44, 30],
      ponto_equilibrio: [42000, 65000, 45000], prazo_recebimento: [22, 52, 30], inadimplencia: [2, 26, 5],
      giro_estoque: [7.5, 2.3, 6], ticket_medio: [240, 175, 230], margem_produto: [42, 18, 35],
      cobertura_estoque: [45, 18, 35],
    });
  }

  if (perfil === "profissional") {
    return interpolarIndicador(codigo, progresso, {
      margem_lucro: [14, 21, 18], margem_liquida: [12, 19, 16], capital_giro: [55000, 78000, 70000],
      liquidez_corrente: [1.5, 2.1, 1.8], endividamento: [45, 34, 38], folha_faturamento: [32, 27, 30],
      ponto_equilibrio: [51000, 47000, 48000], prazo_recebimento: [36, 27, 30], inadimplencia: [8, 4, 5],
      taxa_ocupacao: [62, 76, 72], diaria_media: [320, 385, 360], revpar: [198, 293, 260],
      cmv_hotelaria: [34, 27, 30], trevpar: [410, 545, 500], ticket_medio: [350, 430, 400],
    });
  }

  const sazonalidade = [0, 0.04, -0.02, 0.03, 0.06, 0.08, 0.12, 0.14, 0.09, 0.07, 0.1, 0.15][index] ?? 0;
  return interpolarIndicador(codigo, Math.min(1, progresso + sazonalidade), {
    margem_lucro: [23, 31, 28], margem_liquida: [21, 29, 26], capital_giro: [140000, 230000, 200000],
    liquidez_corrente: [2.1, 2.8, 2.5], endividamento: [38, 29, 32], folha_faturamento: [29, 24, 26],
    ponto_equilibrio: [105000, 98000, 100000], prazo_recebimento: [31, 23, 25], inadimplencia: [5, 2, 3],
    taxa_ocupacao: [68, 84, 80], diaria_media: [470, 620, 580], revpar: [319, 520, 470],
    cmv_hotelaria: [31, 24, 26], trevpar: [590, 810, 750], ticket_medio: [520, 690, 640],
  });
}

function pressaoFinanceiraEssencial(competencia: Date) {
  if (competencia.getFullYear() < hoje.getFullYear()) return 0.08;
  const mes = competencia.getMonth();
  if (mes <= 1) return 0;
  return Math.min(1, 0.15 + (mes - 2) * 0.17);
}

function interpolarIndicador(
  codigo: string,
  progresso: number,
  configuracao: Record<string, [inicio: number, fim: number, meta: number]>,
) {
  const valores = configuracao[codigo] ?? [50, 50, 50];
  return {
    valor: valores[0] + (valores[1] - valores[0]) * progresso,
    meta: valores[2],
  };
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

async function garantirAlertas(empresa: EmpresaSeed) {
  const empresaId = empresa.id;
  const perfil = tipoPerfil(empresa);
  const conteudo = perfil === "essencial"
    ? [
        ["critico", "Inadimplencia pressionando o caixa", "Recebimentos atrasados e contas vencidas exigem um plano imediato de regularizacao."],
        ["critico", "Caixa operacional negativo", "As saidas superam as entradas desde marco e o saldo projetado permanece negativo."],
      ]
    : perfil === "profissional"
      ? [
          ["atencao", "Recebimento parcial de agencia", "Uma agencia ainda possui saldo pendente; acompanhe a liquidacao nesta semana."],
          ["info", "Margem operacional estavel", "A operacao mantem resultado positivo, com oportunidade de revisar comissoes dos canais de reserva."],
        ]
      : [
          ["info", "Entradas relevantes previstas", "Eventos e operadoras concentram recebimentos importantes nas proximas semanas."],
          ["info", "Caixa projetado confortavel", "A rede possui cobertura para os compromissos mapeados no horizonte de 90 dias."],
        ];
  const registros = conteudo.map(([severidade, titulo, descricao], index) => ({
    id: uuid(`alerta:${empresaId}:${index === 0 ? "receber" : "caixa"}`),
    empresa_id: empresaId,
    tipo: "financeiro",
    severidade,
    titulo,
    descricao,
    resolvido: false,
  }));

  const { error } = await supabase.from("alertas").upsert(registros);
  if (error) throw error;
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

function tipoPerfil(empresa: EmpresaSeed): "essencial" | "profissional" | "enterprise" {
  const nome = (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase();
  if (nome.includes("ESSENCIAL")) return "essencial";
  if (nome.includes("PROFISSIONAL")) return "profissional";
  return "enterprise";
}

function indiceEmpresa(empresa: EmpresaSeed) {
  const nome = (empresa.nome_fantasia ?? empresa.razao_social).trim().toUpperCase();
  if (nome.includes("ENTERPRISE")) return 0;
  if (nome.includes("ESSENCIAL")) return 1;
  return 2;
}

function argumentoEmpresa() {
  const prefixo = "--empresa=";
  const argumento = process.argv.find((item) => item.startsWith(prefixo));
  if (!argumento) return null;

  const nome = argumento.slice(prefixo.length).trim().toUpperCase();
  if (!EMPRESAS_DEMO.has(nome)) {
    throw new Error(`Empresa demo invalida: ${nome}.`);
  }
  return nome;
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
