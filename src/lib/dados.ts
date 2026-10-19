/**
 * Fronteira entre as telas e a fonte de dados.
 *
 * As telas consomem dados reais pelo Supabase.
 * Esta camada traduz tabelas/RPCs para os tipos de dominio usados pela UI.
 */
import { supabaseConfigurado } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getSessao } from "@/lib/sessao";
import {
  gerarCompetenciasRecentes,
  mesDe,
} from "@/lib/competencia";
import { getCompetenciaSelecionada } from "@/lib/competencia-servidor";
import { configModeloSchema, type ModeloImportacao } from "@/lib/importacao/modelos";
import type { ApuracaoFolha, ConfigRubrica, FuncionarioFolha } from "@/lib/folha";
import type { RelatorioVendasSalvo } from "@/lib/vendas";
import type {
  Alerta,
  AvaliacaoMaturidade,
  Colaborador,
  ConferenciaDre,
  ContaBancaria,
  DashboardKpis,
  Diagnostico,
  Documento,
  Empresa,
  ExtratoConta,
  HistoricoDiagnostico,
  HistoricoPlanoAcao,
  Indicador,
  ItemForaDre,
  Lancamento,
  LinhaDre,
  MovimentoDre,
  MovimentoExtrato,
  PlanoAcao,
  PlanoConta,
  PontoFluxo,
  PontoProjecao,
  Reuniao,
  Titulo,
} from "@/lib/types";

// Lógica pura de títulos vive em @/lib/titulos (sem Supabase), para poder ser
// usada em Client Components. Reexportada aqui pela compatibilidade com o código
// que já importa esses símbolos de @/lib/dados.
export {
  statusEfetivo,
  agruparContasFixas,
  type ContaFixaAgrupada,
} from "@/lib/titulos";

const hoje = () => new Date().toISOString().slice(0, 10);

/** Primeiro e ultimo dia do mes da competencia (aaaa-mm-01), sem fuso. */
function intervaloDoMes(competencia: string) {
  const [anoTexto, mesTexto] = competencia.slice(0, 7).split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesPad = String(mes).padStart(2, "0");
  return {
    inicio: `${anoTexto}-${mesPad}-01`,
    fim: `${anoTexto}-${mesPad}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

// ---------------------------------------------------------------------------
// Empresa e cadastros
// ---------------------------------------------------------------------------

export async function getEmpresa(_empresaId?: string): Promise<Empresa> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) throw new Error("Nenhuma empresa selecionada.");

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", empresaId)
    .single();

  if (error || !data) throw new Error("Nao foi possivel carregar a empresa.");
  return mapEmpresa(data);
}

/** Cidade/UF da unidade matriz (ou da primeira unidade cadastrada). */
export async function getCidadeEmpresa(
  empresaIdParam?: string,
): Promise<{ cidade: string; uf: string } | null> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return null;

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("unidades")
    .select("cidade, uf, tipo")
    .eq("empresa_id", empresaId)
    .order("tipo");

  if (error || !data?.length) return null;
  const matriz = data.find((u) => u.tipo === "matriz") ?? data[0];
  const cidade = String(matriz.cidade ?? "").trim();
  const uf = String(matriz.uf ?? "").trim();
  if (!cidade) return null;
  return { cidade, uf };
}

/** Colaboradores ativos que fazem aniversário hoje (fuso America/Sao_Paulo). */
export async function getAniversariantesHoje(
  empresaIdParam?: string,
): Promise<Colaborador[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome, data_nascimento, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error) {
    if (/colaboradores/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar colaboradores.");
  }

  const hojeBr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [, mesHoje, diaHoje] = hojeBr.split("-");

  return (data ?? [])
    .filter((row) => {
      const iso = String(row.data_nascimento ?? "").slice(0, 10);
      const partes = iso.split("-");
      return partes[1] === mesHoje && partes[2] === diaHoje;
    })
    .map((row) => ({
      id: row.id,
      nome: row.nome,
      dataNascimento: String(row.data_nascimento).slice(0, 10),
      ativo: Boolean(row.ativo),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function getColaboradores(empresaIdParam?: string): Promise<Colaborador[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id, nome, data_nascimento, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error) {
    if (/colaboradores/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar colaboradores.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    nome: row.nome,
    dataNascimento: String(row.data_nascimento).slice(0, 10),
    ativo: Boolean(row.ativo),
  }));
}

export async function getPlanoContas(empresaIdParam?: string): Promise<PlanoConta[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("plano_contas")
    .select("id, codigo, nome, tipo, grupo_dre")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("codigo");

  if (error) throw new Error("Nao foi possivel carregar o plano de contas.");
  return (data ?? []).map(mapPlanoConta);
}

export type OrcamentoLinha = {
  id: string;
  planoContaId: string;
  codigo: string;
  conta: string;
  tipo: PlanoConta["tipo"];
  competencia: string;
  valorPrevisto: number;
};

/** Orçamentos (previstos) da competência, com dados da conta. */
export async function getOrcamentos(
  competencia: string,
  empresaIdParam?: string,
): Promise<OrcamentoLinha[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const mes = competencia.slice(0, 7) + "-01";
  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("id, plano_conta_id, competencia, valor_previsto, plano_contas(codigo, nome, tipo)")
    .eq("empresa_id", empresaId)
    .eq("competencia", mes)
    .order("competencia");

  if (error) throw new Error("Nao foi possivel carregar os previstos do orçamento.");

  return (data ?? [])
    .map((row) => {
      const conta = Array.isArray(row.plano_contas) ? row.plano_contas[0] : row.plano_contas;
      if (!conta) return null;
      return {
        id: row.id,
        planoContaId: row.plano_conta_id,
        codigo: conta.codigo,
        conta: conta.nome,
        tipo: conta.tipo as PlanoConta["tipo"],
        competencia: dataIso(row.competencia),
        valorPrevisto: numero(row.valor_previsto),
      } satisfies OrcamentoLinha;
    })
    .filter((item): item is OrcamentoLinha => item !== null)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
}

export async function getContasBancarias(empresaIdParam?: string): Promise<ContaBancaria[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  let { data, error } = await supabase
    .from("contas_bancarias")
    .select("id, nome, banco, tipo, saldo_inicial, data_saldo_inicial, ativo")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error && /data_saldo_inicial/i.test(error.message)) {
    const fallback = await supabase
      .from("contas_bancarias")
      .select("id, nome, banco, tipo, saldo_inicial, ativo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome");
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      data_saldo_inicial: hoje(),
    }));
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar as contas bancarias.");

  const contas = data ?? [];
  if (contas.length === 0) return [];

  let movimentosQuery = await supabase
    .from("lancamentos")
    .select("conta_bancaria_id, tipo, valor, data, impacta_fluxo")
    .eq("empresa_id", empresaId)
    .not("conta_bancaria_id", "is", null);
  if (movimentosQuery.error && /impacta_fluxo/i.test(movimentosQuery.error.message)) {
    movimentosQuery = await supabase
      .from("lancamentos")
      .select("conta_bancaria_id, tipo, valor, data")
      .eq("empresa_id", empresaId)
      .not("conta_bancaria_id", "is", null);
  }

  const movimentoPorConta = new Map<string, number>();
  for (const mov of movimentosQuery.data ?? []) {
    if (!mov.conta_bancaria_id) continue;
    if ("impacta_fluxo" in mov && mov.impacta_fluxo === false) continue;
    const conta = contas.find((c) => c.id === mov.conta_bancaria_id);
    const dataRef = conta?.data_saldo_inicial
      ? dataIso(conta.data_saldo_inicial)
      : "0000-01-01";
    if (dataIso(mov.data) < dataRef) continue;
    const sinal = mov.tipo === "entrada" ? 1 : -1;
    movimentoPorConta.set(
      mov.conta_bancaria_id,
      (movimentoPorConta.get(mov.conta_bancaria_id) ?? 0) + sinal * numero(mov.valor),
    );
  }

  return contas.map((row) => {
    const saldoInicial = Number(row.saldo_inicial);
    return {
      id: row.id,
      nome: row.nome,
      banco: row.banco,
      tipo: row.tipo as ContaBancaria["tipo"],
      saldoInicial,
      dataSaldoInicial: dataIso(row.data_saldo_inicial) || hoje(),
      saldoAtual: saldoInicial + (movimentoPorConta.get(row.id) ?? 0),
      ativo: Boolean(row.ativo),
    };
  });
}

/**
 * Extrato de uma conta financeira no período.
 * Usa a mesma regra de saldo de `getContasBancarias` (saldo_inicial + movimentos
 * com impacta_fluxo, a partir de data_saldo_inicial, na conta).
 */
export async function getExtratoConta(
  contaId: string,
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<ExtratoConta | null> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId || !contaId) return null;

  const contas = await getContasBancarias(empresaId);
  const conta = contas.find((item) => item.id === contaId);
  if (!conta) return null;

  const supabase = await criarSupabaseObrigatorio();
  const selecao =
    "id, data, tipo, valor, descricao, contraparte, documento, plano_conta_id, conta_bancaria_id, origem, impacta_dre, impacta_fluxo";
  let { data, error } = await supabase
    .from("lancamentos")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .eq("conta_bancaria_id", contaId)
    .gte("data", conta.dataSaldoInicial)
    .lte("data", fim)
    .order("data", { ascending: true })
    .order("id", { ascending: true });

  if (error && /impacta_/i.test(error.message)) {
    const fallback = await supabase
      .from("lancamentos")
      .select(
        "id, data, tipo, valor, descricao, contraparte, documento, plano_conta_id, conta_bancaria_id, origem",
      )
      .eq("empresa_id", empresaId)
      .eq("conta_bancaria_id", contaId)
      .gte("data", conta.dataSaldoInicial)
      .lte("data", fim)
      .order("data", { ascending: true })
      .order("id", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar o extrato da conta.");

  const todos = (data ?? [])
    .map((row) => mapLancamento({ ...row, conta_bancaria_id: row.conta_bancaria_id ?? contaId }))
    .filter((item) => item.impactaFluxo);

  let saldoAnterior = conta.saldoInicial;
  const noPeriodo: Lancamento[] = [];
  for (const mov of todos) {
    if (mov.data < inicio) {
      saldoAnterior += mov.tipo === "entrada" ? mov.valor : -mov.valor;
      continue;
    }
    if (mov.data > fim) continue;
    noPeriodo.push(mov);
  }

  const entradas = noPeriodo
    .filter((item) => item.tipo === "entrada")
    .reduce((soma, item) => soma + item.valor, 0);
  const saidas = noPeriodo
    .filter((item) => item.tipo === "saida")
    .reduce((soma, item) => soma + item.valor, 0);
  const saldoFinal = saldoAnterior + entradas - saidas;

  // Saldo independente até o fim do período (mesma fonte dos saldos financeiros).
  const saldoAteFim = todos
    .filter((item) => item.data <= fim)
    .reduce(
      (saldo, item) => saldo + (item.tipo === "entrada" ? item.valor : -item.valor),
      conta.saldoInicial,
    );
  const conferido =
    Math.abs(saldoFinal - (saldoAnterior + entradas - saidas)) < 0.005 &&
    Math.abs(saldoFinal - saldoAteFim) < 0.005;

  const ids = noPeriodo.map((item) => item.id);
  const origemPorLancamento = new Map<string, { tituloId: string; tituloTipo: Titulo["tipo"] }>();
  if (ids.length > 0) {
    const { data: baixas, error: erroBaixas } = await supabase
      .from("titulos_baixas")
      .select("lancamento_id, titulo_id")
      .eq("empresa_id", empresaId)
      .in("lancamento_id", ids)
      .not("lancamento_id", "is", null);

    if (!erroBaixas && baixas?.length) {
      const tituloIds = [...new Set(baixas.map((b) => b.titulo_id).filter(Boolean))] as string[];
      const tipoPorTitulo = new Map<string, Titulo["tipo"]>();
      if (tituloIds.length) {
        const { data: titulos } = await supabase
          .from("titulos")
          .select("id, tipo")
          .eq("empresa_id", empresaId)
          .in("id", tituloIds);
        for (const titulo of titulos ?? []) {
          tipoPorTitulo.set(titulo.id, titulo.tipo === "receber" ? "receber" : "pagar");
        }
      }
      for (const baixa of baixas) {
        if (!baixa.lancamento_id || !baixa.titulo_id) continue;
        origemPorLancamento.set(baixa.lancamento_id, {
          tituloId: baixa.titulo_id,
          tituloTipo: tipoPorTitulo.get(baixa.titulo_id) ?? "pagar",
        });
      }
    }
  }

  const movimentos: MovimentoExtrato[] = [...noPeriodo]
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
    .map((item) => {
      const origem = origemPorLancamento.get(item.id);
      return {
        ...item,
        tituloId: origem?.tituloId ?? null,
        tituloTipo: origem?.tituloTipo ?? null,
      };
    });

  return {
    conta,
    inicio,
    fim,
    saldoAnterior,
    entradas,
    saidas,
    saldoFinal,
    conferido,
    movimentos,
  };
}

/** Modelos de importação da empresa e os globais (empresa_id nulo). */
export async function getModelosImportacao(
  empresaIdParam?: string,
): Promise<ModeloImportacao[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  // O id entra num filtro .or() em texto: só aceita UUID para não abrir injeção
  if (empresaId && !/^[0-9a-f-]{36}$/i.test(empresaId)) return [];

  const supabase = await criarSupabaseObrigatorio();
  let consulta = supabase
    .from("modelos_importacao")
    .select("id, empresa_id, tipo, nome, config, assinatura")
    .order("nome");
  consulta = empresaId
    ? consulta.or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
    : consulta.is("empresa_id", null);

  const { data, error } = await consulta;
  if (error) {
    // Migration 0022 ainda não aplicada: o assistente segue funcionando sem modelos
    if (/modelos_importacao/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar os modelos de importacao.");
  }

  return (data ?? []).flatMap((row) => {
    const config = configModeloSchema.safeParse(row.config ?? {});
    if (!config.success) return [];
    return [
      {
        id: row.id,
        empresaId: row.empresa_id,
        tipo: row.tipo as ModeloImportacao["tipo"],
        nome: row.nome,
        config: config.data,
        assinatura: (row.assinatura as string[] | null) ?? [],
      },
    ];
  });
}

/** Relatórios de vendas do PDV importados no ano, de todas as origens. */
export async function getRelatoriosVendas(
  ano: number,
  empresaIdParam?: string,
): Promise<RelatorioVendasSalvo[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("vendas_relatorios")
    .select(
      "id, competencia, origem, arquivo_nome, periodo_inicio, periodo_fim, total_valor, total_quantidade, resumos, updated_at",
    )
    .eq("empresa_id", empresaId)
    .gte("competencia", `${ano}-01-01`)
    .lte("competencia", `${ano}-12-01`)
    .order("competencia")
    .order("origem");

  if (error) {
    // Migration 0024 ainda não aplicada
    if (/vendas_relatorios/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar os relatorios de vendas.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    competencia: String(row.competencia).slice(0, 10),
    origem: row.origem,
    arquivoNome: row.arquivo_nome,
    periodoInicio: row.periodo_inicio,
    periodoFim: row.periodo_fim,
    totalValor: Number(row.total_valor),
    totalQuantidade: Number(row.total_quantidade),
    resumos: row.resumos ?? {},
    atualizadoEm: row.updated_at,
  }));
}

/** Anos com algum relatório de vendas (para o seletor de ano). */
export async function getAnosVendas(empresaIdParam?: string): Promise<number[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("vendas_relatorios")
    .select("competencia")
    .eq("empresa_id", empresaId);
  if (error) return [];
  return [...new Set((data ?? []).map((r) => Number(String(r.competencia).slice(0, 4))))].sort();
}

/** Meses ("AAAA-MM-01") com Extrato Mensal importado. */
export async function getCompetenciasFolha(empresaIdParam?: string): Promise<string[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("folha_apuracoes")
    .select("competencia")
    .eq("empresa_id", empresaId)
    .order("competencia");

  if (error) {
    // Migration 0023 ainda não aplicada
    if (/folha_apuracoes/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar as competencias da folha.");
  }
  return (data ?? []).map((row) => String(row.competencia).slice(0, 10));
}

export async function getApuracaoFolha(
  competencia: string,
  empresaIdParam?: string,
): Promise<{ apuracao: ApuracaoFolha; funcionarios: FuncionarioFolha[] } | null> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return null;

  const supabase = await criarSupabaseObrigatorio();
  const { data: row, error } = await supabase
    .from("folha_apuracoes")
    .select(
      "id, competencia, arquivo_nome, empresa_relatorio, totais, encargos, situacoes, resumo_rubricas, manuais, updated_at",
    )
    .eq("empresa_id", empresaId)
    .eq("competencia", competencia)
    .maybeSingle();

  if (error) {
    if (/folha_apuracoes/i.test(error.message)) return null;
    throw new Error("Nao foi possivel carregar a apuracao da folha.");
  }
  if (!row) return null;

  const { data: linhas, error: erroFunc } = await supabase
    .from("folha_funcionarios")
    .select(
      "id, matricula, nome, situacao, departamento, cargo, salario, proventos, descontos, liquido, base_inss, base_fgts, valor_fgts, base_irrf, rubricas, observacoes",
    )
    .eq("apuracao_id", row.id)
    .order("nome");
  if (erroFunc) throw new Error("Nao foi possivel carregar os funcionarios da folha.");

  return {
    apuracao: {
      id: row.id,
      competencia: String(row.competencia).slice(0, 10),
      arquivoNome: row.arquivo_nome,
      empresaRelatorio: row.empresa_relatorio ?? { codigo: null, nome: "", cnpj: null },
      totais: row.totais ?? { proventos: 0, descontos: 0, liquido: 0 },
      encargos: row.encargos ?? {},
      situacoes: row.situacoes ?? {},
      resumoRubricas: row.resumo_rubricas ?? [],
      manuais: row.manuais ?? {},
      atualizadoEm: row.updated_at,
    },
    funcionarios: (linhas ?? []).map((f) => ({
      id: f.id,
      matricula: f.matricula,
      nome: f.nome,
      situacao: f.situacao,
      departamento: f.departamento,
      cargo: f.cargo,
      salario: f.salario === null ? null : Number(f.salario),
      proventos: Number(f.proventos),
      descontos: Number(f.descontos),
      liquido: Number(f.liquido),
      baseInss: Number(f.base_inss),
      baseFgts: Number(f.base_fgts),
      valorFgts: Number(f.valor_fgts),
      baseIrrf: Number(f.base_irrf),
      rubricas: f.rubricas ?? [],
      observacoes: f.observacoes ?? [],
    })),
  };
}

/** Configuração (efeito e categoria) das rubricas da folha da empresa. */
export async function getConfigRubricasFolha(empresaIdParam?: string): Promise<ConfigRubrica[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("folha_rubricas")
    .select("codigo, tipo, efeito, categoria")
    .eq("empresa_id", empresaId);

  if (error) {
    if (/folha_rubricas/i.test(error.message)) return [];
    throw new Error("Nao foi possivel carregar as rubricas da folha.");
  }
  return (data ?? []) as ConfigRubrica[];
}

export async function getCompetencias(empresaIdParam?: string): Promise<string[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [mesDe(hoje())];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("data")
    .eq("empresa_id", empresaId)
    .order("data");

  if (error) throw new Error("Nao foi possivel carregar as competencias.");
  const competencias = [...new Set((data ?? []).map((row) => mesDe(row.data)))];
  return competencias.length ? competencias : [mesDe(hoje())];
}

/** Meses disponíveis no seletor: recentes + meses com lançamentos. */
export async function listarCompetenciasOpcoes(empresaIdParam?: string): Promise<string[]> {
  const selecionada = await getCompetenciaSelecionada();
  const [doBanco, recentes] = await Promise.all([
    getCompetencias(empresaIdParam).catch(() => [selecionada]),
    Promise.resolve(gerarCompetenciasRecentes(36, selecionada)),
  ]);
  const conjunto = new Set([selecionada, mesDe(hoje()), ...doBanco, ...recentes]);
  return [...conjunto].sort((a, b) => b.localeCompare(a));
}

/** Competência ativa na plataforma (escolhida pelo usuário ou mês corrente). */
export async function getCompetenciaAtual(): Promise<string> {
  return getCompetenciaSelecionada();
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

/** Espelha saldo_em_caixa(): saldo inicial + entradas - saidas ate a data. */
export async function saldoEmCaixa(empresaIdParam?: string, ate = hoje()) {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return 0;

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("saldo_em_caixa", {
    p_empresa_id: empresaId,
    p_data: ate,
  });

  if (error) throw new Error("Nao foi possivel carregar o saldo em caixa.");
  return numero(data);
}

export async function getKpis(competencia: string, empresaIdParam?: string): Promise<DashboardKpis> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return kpisVazios(competencia);

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("dashboard_kpis", {
    p_empresa_id: empresaId,
    p_competencia: competencia,
  });

  if (error || !data) throw new Error("Nao foi possivel carregar os KPIs.");
  return mapDashboardKpis(data as DashboardKpisSupabase);
}

/** Espelha fluxo_caixa_diario(). */
export async function getFluxoDiario(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<PontoFluxo[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("fluxo_caixa_diario", {
    p_empresa_id: empresaId,
    p_inicio: inicio,
    p_fim: fim,
  });

  if (error) throw new Error("Nao foi possivel carregar o fluxo de caixa.");
  return ((data ?? []) as FluxoDiarioSupabase[]).map((row) => ({
    data: dataIso(row.data),
    entradas: numero(row.entradas),
    saidas: numero(row.saidas),
    saldoAcumulado: numero(row.saldo_acumulado),
  }));
}

/** Espelha fluxo_caixa_projetado(): saldo atual + titulos em aberto por vencimento. */
export async function getFluxoProjetado(dias = 90, empresaIdParam?: string): Promise<PontoProjecao[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase.rpc("fluxo_caixa_projetado", {
    p_empresa_id: empresaId,
    p_dias: dias,
  });

  if (error) throw new Error("Nao foi possivel carregar a projecao de caixa.");
  return ((data ?? []) as FluxoProjetadoSupabase[]).map((row) => ({
    data: dataIso(row.data),
    aReceber: numero(row.a_receber),
    aPagar: numero(row.a_pagar),
    saldoProjetado: numero(row.saldo_projetado),
  }));
}

/** Títulos em aberto com vencimento no mês (contas fixas e avulsas). */
export async function getPrevistoPeriodo(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<{
  aReceber: number;
  aPagar: number;
  aReceberNoMes: number;
  aPagarNoMes: number;
  aReceberAtrasado: number;
  aPagarAtrasado: number;
  titulosNoMes: Array<{
    id: string;
    tipo: "pagar" | "receber";
    vencimento: string;
    valor: number;
    valorPago: number;
    saldo: number;
    contraparte: string;
    fixa: boolean;
    descricao: string;
  }>;
}> {
  const vazio = {
    aReceber: 0,
    aPagar: 0,
    aReceberNoMes: 0,
    aPagarNoMes: 0,
    aReceberAtrasado: 0,
    aPagarAtrasado: 0,
    titulosNoMes: [] as Array<{
      id: string;
      tipo: "pagar" | "receber";
      vencimento: string;
      valor: number;
      valorPago: number;
      saldo: number;
      contraparte: string;
      fixa: boolean;
      descricao: string;
    }>,
  };
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return vazio;

  const supabase = await criarSupabaseObrigatorio();
  let { data, error } = await supabase
    .from("titulos")
    .select("id, tipo, valor, valor_pago, vencimento, contraparte, fixa, documento, impacta_fluxo")
    .eq("empresa_id", empresaId)
    .in("status", ["aberto", "parcial"])
    .lte("vencimento", fim)
    .order("vencimento");

  if (error && /impacta_/i.test(error.message)) {
    const fallback = await supabase
      .from("titulos")
      .select("id, tipo, valor, valor_pago, vencimento, contraparte, fixa, documento")
      .eq("empresa_id", empresaId)
      .in("status", ["aberto", "parcial"])
      .lte("vencimento", fim)
      .order("vencimento");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar titulos previstos.");

  const total = { ...vazio, titulosNoMes: [] as typeof vazio.titulosNoMes };
  for (const row of data ?? []) {
    if (row.impacta_fluxo === false) continue;
    const saldo = numero(row.valor) - numero(row.valor_pago);
    if (saldo <= 0) continue;
    const vencimento = dataIso(row.vencimento);
    const noMes = vencimento >= inicio && vencimento <= fim;
    const tipo = row.tipo === "receber" ? "receber" : "pagar";

    if (tipo === "receber") {
      if (noMes) total.aReceberNoMes += saldo;
      else total.aReceberAtrasado += saldo;
    } else if (noMes) {
      total.aPagarNoMes += saldo;
    } else {
      total.aPagarAtrasado += saldo;
    }

    if (!noMes) continue;

    total.titulosNoMes.push({
      id: row.id,
      tipo,
      vencimento,
      valor: numero(row.valor),
      valorPago: numero(row.valor_pago),
      saldo,
      contraparte: row.contraparte ?? "—",
      fixa: Boolean(row.fixa),
      descricao: row.documento
        ? `${row.contraparte ?? "Título"} (${row.documento})`
        : (row.contraparte ?? "Título"),
    });
  }

  // Totais do mês respeitam o vencimento (sem misturar atrasados de outros meses).
  total.aReceber = total.aReceberNoMes;
  total.aPagar = total.aPagarNoMes;
  return total;
}

/**
 * Soma títulos com vencimento no dia ao fluxo realizado e recalcula o saldo.
 * Assim parcelas de contas fixas aparecem no gráfico no dia do vencimento.
 */
export function mesclarTitulosNoFluxo(
  fluxo: PontoFluxo[],
  titulos: Array<{ vencimento: string; tipo: "pagar" | "receber"; saldo: number }>,
  saldoInicial: number,
): PontoFluxo[] {
  if (!fluxo.length) return fluxo;

  const porData = new Map(
    fluxo.map((ponto) => [
      ponto.data,
      { data: ponto.data, entradas: ponto.entradas, saidas: ponto.saidas, saldoAcumulado: 0 },
    ]),
  );

  for (const titulo of titulos) {
    const ponto = porData.get(titulo.vencimento);
    if (!ponto) continue;
    if (titulo.tipo === "receber") ponto.entradas += titulo.saldo;
    else ponto.saidas += titulo.saldo;
  }

  let saldo = saldoInicial;
  return [...porData.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((ponto) => {
      saldo += ponto.entradas - ponto.saidas;
      return { ...ponto, saldoAcumulado: saldo };
    });
}

export async function getLancamentos(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<Lancamento[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const selecao =
    "id, data, tipo, valor, descricao, contraparte, documento, plano_conta_id, origem, impacta_dre, impacta_fluxo";
  let { data, error } = await supabase
    .from("lancamentos")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });

  // Compatível enquanto a migration 0025 não foi aplicada.
  if (error && /impacta_/i.test(error.message)) {
    const fallback = await supabase
      .from("lancamentos")
      .select("id, data, tipo, valor, descricao, contraparte, documento, plano_conta_id, origem")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar lancamentos.");
  return (data ?? []).map(mapLancamento);
}

export async function getTitulos(tipo: Titulo["tipo"], empresaIdParam?: string): Promise<Titulo[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const selecao =
    "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem, fixa, grupo_fixa_id, impacta_dre, impacta_fluxo";
  // `data` pode vir do select completo ou dos fallbacks sem colunas novas
  // (enquanto migrations nao foram aplicadas). mapTitulo trata colunas ausentes.
  type TituloRow = Parameters<typeof mapTitulo>[0];
  let data: TituloRow[] | null;
  let error: { message: string } | null;
  ({ data, error } = await supabase
    .from("titulos")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .order("vencimento"));

  // Compatível enquanto a migration 0025 não foi aplicada.
  if (error && /impacta_/i.test(error.message)) {
    const semImpacto = await supabase
      .from("titulos")
      .select(
        "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem, fixa, grupo_fixa_id",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("vencimento");
    data = semImpacto.data;
    error = semImpacto.error;
  }
  // Compatível enquanto as migrations 0014/0015 não foram aplicadas.
  if (error && /grupo_fixa/i.test(error.message)) {
    const comFixa = await supabase
      .from("titulos")
      .select(
        "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem, fixa",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("vencimento");
    data = comFixa.data;
    error = comFixa.error;
  }
  if (error && /fixa/i.test(error.message)) {
    const fallback = await supabase
      .from("titulos")
      .select(
        "id, tipo, contraparte, documento, emissao, vencimento, valor, valor_pago, data_pagamento, status, plano_conta_id, origem",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("vencimento");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar titulos.");
  return (data ?? []).map(mapTitulo);
}

/** DRE gerencial: realizado por competência (emissão do título) + lançamentos manuais. */
export async function getDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<LinhaDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const [
    { data: contas, error: erroContas },
    { data: orcamentos, error: erroOrcamentos },
    { data: titulos, error: erroTitulos },
    { data: lancamentos, error: erroLancamentos },
  ] = await Promise.all([
    supabase
      .from("plano_contas")
      .select("id, codigo, nome, tipo, grupo_dre")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("codigo"),
    // Coluna "Orçado" da DRE: somente valores persistidos em `orcamentos`
    // (mesmo cadastro de Financeiro → Orçamento). Não usa títulos em aberto.
    supabase
      .from("orcamentos")
      .select("plano_conta_id, valor_previsto, competencia")
      .eq("empresa_id", empresaId)
      .gte("competencia", inicio.slice(0, 7) + "-01")
      .lte("competencia", fim),
    supabase
      .from("titulos")
      .select("id, tipo, valor, emissao, vencimento, plano_conta_id, status, impacta_dre")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelado")
      .not("plano_conta_id", "is", null),
    supabase
      .from("lancamentos")
      .select("id, tipo, valor, data, plano_conta_id, origem, impacta_dre")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .neq("origem", "integracao")
      .not("plano_conta_id", "is", null),
  ]);

  if (erroContas) throw new Error("Nao foi possivel carregar o plano de contas da DRE.");
  if (erroOrcamentos) throw new Error("Nao foi possivel carregar o orçamento da DRE.");
  // Compatível se a migration 0025 ainda não existir: refaz sem impacta_dre.
  let titulosDre = titulos;
  let lancamentosDre = lancamentos;
  if (erroTitulos && /impacta_/i.test(erroTitulos.message)) {
    const retry = await supabase
      .from("titulos")
      .select("id, tipo, valor, emissao, vencimento, plano_conta_id, status")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelado")
      .not("plano_conta_id", "is", null);
    if (retry.error) throw new Error("Nao foi possivel carregar os títulos da DRE.");
    titulosDre = retry.data;
  } else if (erroTitulos) {
    throw new Error("Nao foi possivel carregar os títulos da DRE.");
  }
  if (erroLancamentos && /impacta_/i.test(erroLancamentos.message)) {
    const retry = await supabase
      .from("lancamentos")
      .select("id, tipo, valor, data, plano_conta_id, origem")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .neq("origem", "integracao")
      .not("plano_conta_id", "is", null);
    if (retry.error) throw new Error("Nao foi possivel carregar os lançamentos da DRE.");
    lancamentosDre = retry.data;
  } else if (erroLancamentos) {
    throw new Error("Nao foi possivel carregar os lançamentos da DRE.");
  }

  const realizadoPorConta = new Map<string, number>();
  const previstoPorConta = new Map<string, number>();

  for (const titulo of titulosDre ?? []) {
    if ("impacta_dre" in titulo && titulo.impacta_dre === false) continue;
    const competencia = dataIso(titulo.emissao) || dataIso(titulo.vencimento);
    if (!competencia || competencia < inicio || competencia > fim) continue;
    if (!titulo.plano_conta_id) continue;
    const sinal = titulo.tipo === "receber" ? 1 : -1;
    realizadoPorConta.set(
      titulo.plano_conta_id,
      (realizadoPorConta.get(titulo.plano_conta_id) ?? 0) + sinal * numero(titulo.valor),
    );
  }

  for (const lancamento of lancamentosDre ?? []) {
    if ("impacta_dre" in lancamento && lancamento.impacta_dre === false) continue;
    if (!lancamento.plano_conta_id) continue;
    const sinal = lancamento.tipo === "entrada" ? 1 : -1;
    realizadoPorConta.set(
      lancamento.plano_conta_id,
      (realizadoPorConta.get(lancamento.plano_conta_id) ?? 0) + sinal * numero(lancamento.valor),
    );
  }

  for (const orcamento of orcamentos ?? []) {
    if (!orcamento.plano_conta_id) continue;
    previstoPorConta.set(
      orcamento.plano_conta_id,
      (previstoPorConta.get(orcamento.plano_conta_id) ?? 0) + numero(orcamento.valor_previsto),
    );
  }

  const linhas: LinhaDre[] = (contas ?? []).map((conta) => ({
    planoContaId: conta.id,
    codigo: conta.codigo,
    conta: conta.nome,
    grupoDre: conta.grupo_dre as LinhaDre["grupoDre"],
    tipo: conta.tipo as LinhaDre["tipo"],
    realizado: realizadoPorConta.get(conta.id) ?? 0,
    previsto: previstoPorConta.get(conta.id) ?? 0,
  }));

  // Classificações inativas com realizado no período: mantêm o total (não somem da DRE).
  const idsAtivos = new Set(linhas.map((linha) => linha.planoContaId));
  const orfaos = [...realizadoPorConta.entries()].filter(
    ([id, valor]) => !idsAtivos.has(id) && Math.abs(valor) >= 0.005,
  );
  if (orfaos.length > 0) {
    const { data: inativas } = await supabase
      .from("plano_contas")
      .select("id, codigo, nome, tipo, grupo_dre")
      .eq("empresa_id", empresaId)
      .in(
        "id",
        orfaos.map(([id]) => id),
      );
    for (const conta of inativas ?? []) {
      linhas.push({
        planoContaId: conta.id,
        codigo: conta.codigo,
        conta: `${conta.nome} (inativa)`,
        grupoDre: (conta.grupo_dre as LinhaDre["grupoDre"]) || "outros",
        tipo: conta.tipo as LinhaDre["tipo"],
        realizado: realizadoPorConta.get(conta.id) ?? 0,
        previsto: previstoPorConta.get(conta.id) ?? 0,
        inativa: true,
      });
      idsAtivos.add(conta.id);
    }
    for (const [id, valor] of orfaos) {
      if (idsAtivos.has(id)) continue;
      linhas.push({
        planoContaId: id,
        codigo: "—",
        conta: "Classificação removida",
        grupoDre: "outros",
        tipo: "despesa",
        realizado: valor,
        previsto: previstoPorConta.get(id) ?? 0,
        inativa: true,
      });
    }
  }

  return linhas.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
}

/**
 * Confere se o Realizado das linhas bate com a soma assinada dos movimentos de origem.
 * Regra: entrada soma, saída subtrai (igual a getDre).
 */
export function conferirRealizadoDre(
  linhas: LinhaDre[],
  movimentos: MovimentoDre[],
): ConferenciaDre {
  const realizadoLinhas = linhas.reduce((soma, linha) => soma + linha.realizado, 0);
  const porContaLinha = new Map(linhas.map((linha) => [linha.planoContaId, linha.realizado]));
  const porContaMov = new Map<string, number>();
  let realizadoMovimentos = 0;
  for (const movimento of movimentos) {
    const sinal = movimento.tipo === "entrada" ? 1 : -1;
    const valor = sinal * movimento.valor;
    realizadoMovimentos += valor;
    if (!movimento.planoContaId) continue;
    porContaMov.set(
      movimento.planoContaId,
      (porContaMov.get(movimento.planoContaId) ?? 0) + valor,
    );
  }

  const divergenciasPorConta: ConferenciaDre["divergenciasPorConta"] = [];
  const ids = new Set([...porContaLinha.keys(), ...porContaMov.keys()]);
  for (const id of ids) {
    const linha = porContaLinha.get(id) ?? 0;
    const movs = porContaMov.get(id) ?? 0;
    if (Math.abs(linha - movs) >= 0.005) {
      divergenciasPorConta.push({ planoContaId: id, linha, movimentos: movs });
    }
  }

  return {
    realizadoLinhas,
    realizadoMovimentos,
    conferido:
      Math.abs(realizadoLinhas - realizadoMovimentos) < 0.005 && divergenciasPorConta.length === 0,
    divergenciasPorConta,
  };
}

/**
 * Lançamentos que aparecem no fluxo de caixa do período e não entram na DRE —
 * por regra (baixa / só caixa / sem classificação), não por inclusão automática.
 */
export async function getLancamentosForaDaDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<ItemForaDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const selecao =
    "id, data, tipo, valor, descricao, plano_conta_id, origem, impacta_dre, impacta_fluxo";
  let { data, error } = await supabase
    .from("lancamentos")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });

  if (error && /impacta_/i.test(error.message)) {
    const fallback = await supabase
      .from("lancamentos")
      .select("id, data, tipo, valor, descricao, plano_conta_id, origem")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  if (error) throw new Error("Nao foi possivel diagnosticar lançamentos fora da DRE.");

  const fora: ItemForaDre[] = [];
  for (const row of data ?? []) {
    if ("impacta_fluxo" in row && row.impacta_fluxo === false) continue;

    let motivo: ItemForaDre["motivo"] | null = null;
    if (row.origem === "integracao") motivo = "baixa_titulo";
    else if ("impacta_dre" in row && row.impacta_dre === false) motivo = "marcado_sem_dre";
    else if (!row.plano_conta_id) motivo = "sem_classificacao";

    if (!motivo) continue;
    fora.push({
      id: row.id,
      data: dataIso(row.data),
      descricao: row.descricao ?? "Lançamento",
      valor: numero(row.valor),
      tipo: row.tipo === "entrada" ? "entrada" : "saida",
      motivo,
    });
  }
  return fora;
}

/**
 * Movimentos que formam o Realizado da DRE no período:
 * - Títulos: competência = emissão (fallback vencimento), se impacta_dre e tem classificação.
 * - Lançamentos manuais/importados: data do lançamento, se impacta_dre e tem classificação.
 * Baixas de títulos (origem integração) ficam de fora de propósito — o título já entra na DRE
 * na competência; o pagamento entra só no fluxo de caixa.
 */
export async function getMovimentosDre(
  inicio: string,
  fim: string,
  empresaIdParam?: string,
): Promise<MovimentoDre[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const [{ data: titulos, error: erroTitulos }, { data: lancamentos, error: erroLancamentos }] =
    await Promise.all([
      supabase
        .from("titulos")
        .select(
          "id, tipo, valor, emissao, vencimento, plano_conta_id, status, contraparte, documento, fixa, impacta_dre",
        )
        .eq("empresa_id", empresaId)
        .neq("status", "cancelado")
        .not("plano_conta_id", "is", null),
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, data, plano_conta_id, origem, descricao, contraparte, impacta_dre")
        .eq("empresa_id", empresaId)
        .gte("data", inicio)
        .lte("data", fim)
        .neq("origem", "integracao")
        .not("plano_conta_id", "is", null),
    ]);

  let titulosMov = titulos;
  let lancamentosMov = lancamentos;
  if (erroTitulos && /impacta_/i.test(erroTitulos.message)) {
    const retry = await supabase
      .from("titulos")
      .select(
        "id, tipo, valor, emissao, vencimento, plano_conta_id, status, contraparte, documento, fixa",
      )
      .eq("empresa_id", empresaId)
      .neq("status", "cancelado")
      .not("plano_conta_id", "is", null);
    if (retry.error) throw new Error("Nao foi possivel carregar os títulos da DRE.");
    titulosMov = retry.data;
  } else if (erroTitulos) {
    throw new Error("Nao foi possivel carregar os títulos da DRE.");
  }
  if (erroLancamentos && /impacta_/i.test(erroLancamentos.message)) {
    const retry = await supabase
      .from("lancamentos")
      .select("id, tipo, valor, data, plano_conta_id, origem, descricao, contraparte")
      .eq("empresa_id", empresaId)
      .gte("data", inicio)
      .lte("data", fim)
      .neq("origem", "integracao")
      .not("plano_conta_id", "is", null);
    if (retry.error) throw new Error("Nao foi possivel carregar os lançamentos da DRE.");
    lancamentosMov = retry.data;
  } else if (erroLancamentos) {
    throw new Error("Nao foi possivel carregar os lançamentos da DRE.");
  }

  const movimentos: MovimentoDre[] = [];

  for (const titulo of titulosMov ?? []) {
    if ("impacta_dre" in titulo && titulo.impacta_dre === false) continue;
    const data = dataIso(titulo.emissao) || dataIso(titulo.vencimento);
    if (!data || data < inicio || data > fim) continue;
    const tipo = titulo.tipo === "receber" ? "entrada" : "saida";
    const rotulo = titulo.fixa
      ? titulo.tipo === "receber"
        ? "Recebimento fixo"
        : "Conta fixa"
      : titulo.tipo === "receber"
        ? "Contas a receber"
        : "Contas a pagar";
    movimentos.push({
      id: `titulo:${titulo.id}`,
      data,
      tipo,
      valor: numero(titulo.valor),
      descricao: titulo.documento ? `${rotulo}: ${titulo.documento}` : rotulo,
      contraparte: titulo.contraparte ?? null,
      origem: "titulo",
      planoContaId: titulo.plano_conta_id,
    });
  }

  for (const lancamento of lancamentosMov ?? []) {
    if ("impacta_dre" in lancamento && lancamento.impacta_dre === false) continue;
    movimentos.push({
      id: lancamento.id,
      data: dataIso(lancamento.data),
      tipo: lancamento.tipo === "entrada" ? "entrada" : "saida",
      valor: numero(lancamento.valor),
      descricao: lancamento.descricao ?? "Lançamento",
      contraparte: lancamento.contraparte ?? null,
      origem: lancamento.origem ?? "manual",
      planoContaId: lancamento.plano_conta_id,
    });
  }

  return movimentos.sort((a, b) => b.data.localeCompare(a.data) || a.descricao.localeCompare(b.descricao));
}

// ---------------------------------------------------------------------------
// Indicadores e consultoria
// ---------------------------------------------------------------------------

export async function getIndicadores(_empresaId?: string): Promise<Indicador[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data: empresa, error: empresaError } = await supabase
    .from("empresas")
    .select("segmento")
    .eq("id", empresaId)
    .single();
  if (empresaError || !empresa) throw new Error("Nao foi possivel identificar o segmento da empresa.");

  const segmentos = empresa.segmento === "geral" ? ["geral"] : ["geral", empresa.segmento];
  const campos = "id, empresa_id, codigo, nome, descricao, segmento, unidade, direcao_meta";
  const [templatesResultado, personalizadosResultado] = await Promise.all([
    supabase
      .from("indicadores")
      .select(campos)
      .is("empresa_id", null)
      .in("segmento", segmentos)
      .eq("ativo", true),
    supabase
      .from("indicadores")
      .select(campos)
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
  ]);

  if (templatesResultado.error || personalizadosResultado.error) {
    throw new Error("Nao foi possivel carregar indicadores.");
  }

  // Um indicador personalizado com o mesmo código substitui o template.
  const porCodigo = new Map<string, (typeof templatesResultado.data)[number]>();
  for (const indicador of templatesResultado.data ?? []) porCodigo.set(indicador.codigo, indicador);
  for (const indicador of personalizadosResultado.data ?? []) porCodigo.set(indicador.codigo, indicador);
  const definicoes = [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (!definicoes.length) return [];

  const { data: valores, error: valoresError } = await supabase
    .from("indicador_valores")
    .select("indicador_id, competencia, valor, meta")
    .eq("empresa_id", empresaId)
    .in("indicador_id", definicoes.map((indicador) => indicador.id))
    .order("competencia");

  if (valoresError) throw new Error("Nao foi possivel carregar os valores dos indicadores.");
  const valoresPorIndicador = new Map<string, NonNullable<typeof valores>>();
  for (const valor of valores ?? []) {
    const serie = valoresPorIndicador.get(valor.indicador_id) ?? [];
    serie.push(valor);
    valoresPorIndicador.set(valor.indicador_id, serie);
  }

  return definicoes.map((indicador) => mapIndicador({
    ...indicador,
    indicador_valores: valoresPorIndicador.get(indicador.id) ?? [],
  }));
}

export async function getPlanosAcao(_empresaId?: string): Promise<PlanoAcao[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const selecao =
    "id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado, data_inicio_efetiva, data_conclusao_efetiva";
  let { data, error } = await supabase
    .from("planos_acao")
    .select(selecao)
    .eq("empresa_id", empresaId)
    .order("prazo");

  // Compatível enquanto a migration 0028 não foi aplicada.
  if (error && /data_inicio_efetiva|data_conclusao_efetiva/i.test(error.message)) {
    const fallback = await supabase
      .from("planos_acao")
      .select(
        "id, problema, acao, area, responsavel, prazo, prioridade, status, percentual, impacto_estimado",
      )
      .eq("empresa_id", empresaId)
      .order("prazo");
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      data_inicio_efetiva: null,
      data_conclusao_efetiva: null,
    })) as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error("Nao foi possivel carregar planos de acao.");
  return (data ?? []).map(mapPlanoAcao);
}

export async function getHistoricoPlanosAcao(
  _empresaId?: string,
): Promise<HistoricoPlanoAcao[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("plano_acao_historico")
    .select("id, plano_acao_id, tipo, descricao, autor_nome, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(100);

  // A tela principal continua operacional antes da migration 0011 ser aplicada.
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    planoAcaoId: row.plano_acao_id,
    tipo: row.tipo as HistoricoPlanoAcao["tipo"],
    descricao: row.descricao,
    autorNome: row.autor_nome,
    criadoEm: row.created_at,
  }));
}

export async function getDiagnosticos(_empresaId?: string): Promise<Diagnostico[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const selecaoCompleta =
    "id, competencia, observacoes, created_at, updated_at, diagnostico_itens(id, categoria, nota, observacao, realizado, data_realizacao, progresso, updated_at)";
  let { data, error } = await supabase
    .from("diagnosticos")
    .select(selecaoCompleta)
    .eq("empresa_id", empresaId)
    .order("competencia");

  // Compatível enquanto a migration 0029 não foi aplicada.
  if (error && /realizado|progresso|data_realizacao|updated_at/i.test(error.message)) {
    const fallback = await supabase
      .from("diagnosticos")
      .select("id, competencia, observacoes, created_at, diagnostico_itens(id, categoria, nota, observacao)")
      .eq("empresa_id", empresaId)
      .order("competencia");
    if (fallback.error && /id|created_at/i.test(fallback.error.message)) {
      const legado = await supabase
        .from("diagnosticos")
        .select("competencia, observacoes, diagnostico_itens(categoria, nota, observacao)")
        .eq("empresa_id", empresaId)
        .order("competencia");
      data = (legado.data ?? []).map((row, indice) => ({
        id: `legado-${indice}`,
        competencia: row.competencia,
        observacoes: row.observacoes,
        created_at: null,
        updated_at: null,
        diagnostico_itens: (row.diagnostico_itens ?? []).map((item, i) => ({
          id: `legado-item-${indice}-${i}`,
          categoria: item.categoria,
          nota: item.nota,
          observacao: item.observacao,
          realizado: null,
          data_realizacao: null,
          progresso: 0,
          updated_at: null,
        })),
      })) as typeof data;
      error = legado.error;
    } else {
      data = (fallback.data ?? []).map((row) => ({
        ...row,
        updated_at: row.created_at ?? null,
        diagnostico_itens: (row.diagnostico_itens ?? []).map((item) => ({
          ...item,
          id: item.id ?? `${row.id}-${item.categoria}`,
          realizado: null,
          data_realizacao: null,
          progresso: 0,
          updated_at: null,
        })),
      })) as typeof data;
      error = fallback.error;
    }
  }

  if (error) throw new Error("Nao foi possivel carregar diagnosticos.");
  return (data ?? []).map(mapDiagnostico);
}

export async function getHistoricoDiagnostico(
  _empresaId?: string,
): Promise<HistoricoDiagnostico[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("diagnostico_historico")
    .select("id, diagnostico_id, diagnostico_item_id, tipo, descricao, autor_nome, created_at")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    diagnosticoId: row.diagnostico_id,
    diagnosticoItemId: row.diagnostico_item_id,
    tipo: row.tipo as HistoricoDiagnostico["tipo"],
    descricao: row.descricao,
    autorNome: row.autor_nome,
    criadoEm: row.created_at,
  }));
}

export async function getMaturidade(_empresaId?: string): Promise<AvaliacaoMaturidade[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("maturidade_avaliacoes")
    .select("competencia, pontuacao_geral, maturidade_itens(categoria, pontuacao)")
    .eq("empresa_id", empresaId)
    .order("competencia");

  if (error) throw new Error("Nao foi possivel carregar maturidade.");
  return (data ?? []).map(mapMaturidade);
}

export async function getDocumentos(_empresaId?: string): Promise<Documento[]> {
  const empresaId = await resolverEmpresaId(_empresaId);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const { data, error } = await supabase
    .from("documentos")
    .select("id, nome, categoria, tamanho_bytes, created_at, profiles(nome, email)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nao foi possivel carregar documentos.");
  return (data ?? []).map(mapDocumento);
}

export async function getReunioes(_empresaId?: string): Promise<Reuniao[]> {
  const supabase = await criarSupabaseObrigatorio();
  let query = supabase
    .from("reunioes")
    .select(`
      id,
      empresa_id,
      tipo,
      titulo,
      data,
      participantes,
      ata,
      gravacao_url,
      empresa:empresas(nome_fantasia, razao_social)
    `)
    .order("data", { ascending: false });

  if (_empresaId) query = query.eq("empresa_id", _empresaId);

  const { data, error } = await query;
  if (error) throw new Error("Nao foi possivel carregar reunioes.");
  return (data ?? []).map(mapReuniao);
}

export async function getAlertas(empresaIdParam?: string): Promise<Alerta[]> {
  const empresaId = await resolverEmpresaId(empresaIdParam);
  if (!empresaId) return [];

  const supabase = await criarSupabaseObrigatorio();
  const hojeIso = new Date().toISOString();
  const [{ data, error }, { data: reunioes, error: reunioesError }] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, severidade, titulo, descricao")
      .eq("empresa_id", empresaId)
      .eq("resolvido", false)
      .neq("tipo", "solicitacao_reuniao")
      .order("created_at", { ascending: false }),
    supabase
      .from("reunioes")
      .select("id, tipo, titulo, data")
      .eq("empresa_id", empresaId)
      .gt("data", hojeIso)
      .order("data")
      .limit(3),
  ]);

  if (error) throw new Error("Nao foi possivel carregar alertas.");
  if (reunioesError) throw new Error("Nao foi possivel carregar reunioes agendadas.");

  const alertasReunioes: Alerta[] = (reunioes ?? []).map((reuniao) => ({
    id: `reuniao-${reuniao.id}`,
    severidade: "info",
    titulo: reuniao.tipo === "treinamento" ? "Treinamento agendado" : "Reunião agendada",
    descricao: `${reuniao.titulo} em ${formatarDataHoraAlerta(reuniao.data)}.`,
  }));

  return [
    ...alertasReunioes,
    ...(data ?? []).map((row) => ({
    id: row.id,
    severidade: row.severidade as Alerta["severidade"],
    titulo: row.titulo,
    descricao: row.descricao ?? "",
    })),
  ];
}

// ---------------------------------------------------------------------------
// Helpers de data
// ---------------------------------------------------------------------------

export { intervaloDoMes };

type EmpresaSupabase = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: Empresa["segmento"] | null;
  regime_tributario: Empresa["regimeTributario"] | null;
  data_abertura: string | null;
  qtd_funcionarios: number | null;
};

type DashboardKpisSupabase = {
  competencia: string;
  saldo_caixa: number | string;
  faturamento_mes: number | string;
  despesas_mes: number | string;
  resultado_mes: number | string;
  margem_mes: number | string | null;
  contas_pagar: number | string;
  contas_pagar_vencidas: number | string;
  contas_receber: number | string;
  inadimplencia: number | string;
};

type FluxoDiarioSupabase = {
  data: string;
  entradas: number | string;
  saidas: number | string;
  saldo_acumulado: number | string;
};

type FluxoProjetadoSupabase = {
  data: string;
  a_receber: number | string;
  a_pagar: number | string;
  saldo_projetado: number | string;
};

type EmpresaJoin = {
  nome_fantasia: string | null;
  razao_social: string | null;
} | {
  nome_fantasia: string | null;
  razao_social: string | null;
}[] | null;

type ReuniaoSupabase = {
  id: string;
  empresa_id: string;
  tipo: Reuniao["tipo"];
  titulo: string;
  data: string;
  participantes: string | null;
  ata: string | null;
  gravacao_url: string | null;
  empresa: EmpresaJoin;
};

async function criarSupabaseObrigatorio() {
  if (!supabaseConfigurado) {
    throw new Error("Supabase nao configurado. Configure as chaves para carregar dados reais.");
  }
  return createClient();
}

async function resolverEmpresaId(empresaId?: string) {
  if (empresaId) return empresaId;
  const sessao = await getSessao();
  return sessao.role === "admin" ? "" : sessao.empresaId;
}

function numero(valor: number | string | null) {
  return typeof valor === "string" ? Number(valor) : valor ?? 0;
}

function dataIso(valor: string | null) {
  return valor ? valor.slice(0, 10) : "";
}

function formatarDataHoraAlerta(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function mapEmpresa(row: EmpresaSupabase): Empresa {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia ?? row.razao_social,
    cnpj: row.cnpj ?? "",
    segmento: row.segmento ?? "geral",
    regimeTributario: row.regime_tributario ?? "simples",
    dataAbertura: row.data_abertura ?? "",
    qtdFuncionarios: row.qtd_funcionarios ?? 0,
    unidades: [],
  };
}

function mapPlanoConta(row: {
  id: string;
  codigo: string;
  nome: string;
  tipo: PlanoConta["tipo"];
  grupo_dre: PlanoConta["grupoDre"];
}): PlanoConta {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    tipo: row.tipo,
    grupoDre: row.grupo_dre,
  };
}

function kpisVazios(competencia: string): DashboardKpis {
  return {
    competencia,
    saldoCaixa: 0,
    faturamentoMes: 0,
    despesasMes: 0,
    resultadoMes: 0,
    margemMes: null,
    contasPagar: 0,
    contasPagarVencidas: 0,
    contasReceber: 0,
    inadimplencia: 0,
  };
}

function mapDashboardKpis(row: DashboardKpisSupabase): DashboardKpis {
  return {
    competencia: dataIso(row.competencia),
    saldoCaixa: numero(row.saldo_caixa),
    faturamentoMes: numero(row.faturamento_mes),
    despesasMes: numero(row.despesas_mes),
    resultadoMes: numero(row.resultado_mes),
    margemMes: row.margem_mes === null ? null : numero(row.margem_mes),
    contasPagar: numero(row.contas_pagar),
    contasPagarVencidas: numero(row.contas_pagar_vencidas),
    contasReceber: numero(row.contas_receber),
    inadimplencia: numero(row.inadimplencia),
  };
}

function mapLancamento(row: {
  id: string;
  data: string;
  tipo: Lancamento["tipo"];
  valor: number | string;
  descricao: string;
  contraparte: string | null;
  documento: string | null;
  plano_conta_id: string | null;
  conta_bancaria_id?: string | null;
  origem: Lancamento["origem"];
  impacta_dre?: boolean | null;
  impacta_fluxo?: boolean | null;
}): Lancamento {
  return {
    id: row.id,
    data: dataIso(row.data),
    tipo: row.tipo,
    valor: numero(row.valor),
    descricao: row.descricao,
    contraparte: row.contraparte,
    documento: row.documento,
    planoContaId: row.plano_conta_id,
    contaBancariaId: row.conta_bancaria_id ?? null,
    origem: row.origem,
    impactaDre: row.impacta_dre !== false,
    impactaFluxo: row.impacta_fluxo !== false,
  };
}

function mapTitulo(row: {
  id: string;
  tipo: Titulo["tipo"];
  contraparte: string;
  documento: string | null;
  emissao: string | null;
  vencimento: string;
  valor: number | string;
  valor_pago: number | string;
  data_pagamento: string | null;
  status: Titulo["status"];
  plano_conta_id: string | null;
  origem: Titulo["origem"];
  fixa?: boolean | null;
  grupo_fixa_id?: string | null;
  impacta_dre?: boolean | null;
  impacta_fluxo?: boolean | null;
}): Titulo {
  return {
    id: row.id,
    tipo: row.tipo,
    contraparte: row.contraparte,
    documento: row.documento,
    emissao: dataIso(row.emissao),
    vencimento: dataIso(row.vencimento),
    valor: numero(row.valor),
    valorPago: numero(row.valor_pago),
    dataPagamento: row.data_pagamento ? dataIso(row.data_pagamento) : null,
    status: row.status,
    planoContaId: row.plano_conta_id,
    origem: row.origem,
    fixa: Boolean(row.fixa),
    grupoFixaId: row.grupo_fixa_id ?? null,
    impactaDre: row.impacta_dre !== false,
    impactaFluxo: row.impacta_fluxo !== false,
  };
}

function mapLinhaDre(row: {
  plano_conta_id: string;
  codigo: string;
  conta: string;
  grupo_dre: LinhaDre["grupoDre"];
  tipo: LinhaDre["tipo"];
  realizado: number | string;
  previsto: number | string;
}): LinhaDre {
  return {
    planoContaId: row.plano_conta_id,
    codigo: row.codigo,
    conta: row.conta,
    grupoDre: row.grupo_dre,
    tipo: row.tipo,
    realizado: numero(row.realizado),
    previsto: numero(row.previsto),
  };
}

function mapIndicador(row: {
  id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: Indicador["unidade"];
  direcao_meta: Indicador["direcaoMeta"];
  segmento: Indicador["segmento"];
  indicador_valores?: {
    competencia: string;
    valor: number | string;
    meta: number | string | null;
  }[];
}): Indicador {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao ?? "",
    unidade: row.unidade,
    direcaoMeta: row.direcao_meta,
    segmento: row.segmento,
    personalizado: row.empresa_id !== null,
    valores: (row.indicador_valores ?? [])
      .map((valor) => ({
        competencia: dataIso(valor.competencia),
        valor: numero(valor.valor),
        meta: valor.meta === null ? null : numero(valor.meta),
      }))
      .sort((a, b) => a.competencia.localeCompare(b.competencia)),
  };
}

function mapPlanoAcao(row: {
  id: string;
  problema: string;
  acao: string;
  area: PlanoAcao["area"];
  responsavel: string | null;
  prazo: string | null;
  prioridade: PlanoAcao["prioridade"];
  status: PlanoAcao["status"];
  percentual: number;
  impacto_estimado: number | string | null;
  data_inicio_efetiva?: string | null;
  data_conclusao_efetiva?: string | null;
}): PlanoAcao {
  return {
    id: row.id,
    problema: row.problema,
    acao: row.acao,
    area: row.area,
    responsavel: row.responsavel ?? "Nao informado",
    prazo: dataIso(row.prazo),
    prioridade: row.prioridade,
    status: row.status,
    percentual: row.percentual,
    impactoEstimado: row.impacto_estimado === null ? null : numero(row.impacto_estimado),
    dataInicioEfetiva: row.data_inicio_efetiva ? dataIso(row.data_inicio_efetiva) : null,
    dataConclusaoEfetiva: row.data_conclusao_efetiva
      ? dataIso(row.data_conclusao_efetiva)
      : null,
  };
}

function mapProgressoDiagnostico(valor: number | null | undefined): Diagnostico["itens"][number]["progresso"] {
  if (valor === 30 || valor === 50 || valor === 100) return valor;
  return 0;
}

function mapDiagnostico(row: {
  id?: string;
  competencia: string;
  observacoes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  diagnostico_itens?: {
    id?: string;
    categoria: Diagnostico["itens"][number]["categoria"];
    nota: number;
    observacao: string | null;
    realizado?: string | null;
    data_realizacao?: string | null;
    progresso?: number | null;
    updated_at?: string | null;
  }[];
}): Diagnostico {
  return {
    id: row.id ?? "",
    competencia: dataIso(row.competencia),
    observacoes: row.observacoes ?? "",
    criadoEm: row.created_at ?? null,
    atualizadoEm: row.updated_at ?? row.created_at ?? null,
    itens: (row.diagnostico_itens ?? []).map((item) => ({
      id: item.id ?? "",
      categoria: item.categoria,
      nota: item.nota,
      observacao: item.observacao ?? "",
      realizado: item.realizado ?? "",
      dataRealizacao: item.data_realizacao ? dataIso(item.data_realizacao) : null,
      progresso: mapProgressoDiagnostico(item.progresso),
      atualizadoEm: item.updated_at ?? null,
    })),
  };
}

function mapMaturidade(row: {
  competencia: string;
  pontuacao_geral: number | null;
  maturidade_itens?: {
    categoria: AvaliacaoMaturidade["itens"][number]["categoria"];
    pontuacao: number;
  }[];
}): AvaliacaoMaturidade {
  return {
    competencia: dataIso(row.competencia),
    pontuacaoGeral: row.pontuacao_geral ?? 0,
    itens: (row.maturidade_itens ?? []).map((item) => ({
      categoria: item.categoria,
      pontuacao: item.pontuacao,
    })),
  };
}

function mapDocumento(row: {
  id: string;
  nome: string;
  categoria: Documento["categoria"];
  tamanho_bytes: number | string | null;
  created_at: string;
  profiles: {
    nome: string | null;
    email: string | null;
  } | {
    nome: string | null;
    email: string | null;
  }[] | null;
}): Documento {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    tamanhoBytes: numero(row.tamanho_bytes),
    criadoEm: dataIso(row.created_at),
    enviadoPor: profile?.nome || profile?.email || "Nao informado",
  };
}

function mapReuniao(row: ReuniaoSupabase): Reuniao {
  const empresa = Array.isArray(row.empresa) ? row.empresa[0] : row.empresa;

  return {
    id: row.id,
    empresaId: row.empresa_id,
    tipo: row.tipo,
    titulo: row.titulo,
    data: row.data,
    participantes: row.participantes ?? "Participantes nao informados",
    ata: row.ata ?? "",
    gravacaoUrl: row.gravacao_url,
    empresaNome: empresa?.nome_fantasia ?? empresa?.razao_social ?? "Empresa nao informada",
  };
}
