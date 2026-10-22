/**
 * Apuração analítica da folha: classifica cada rubrica numa coluna da tabela
 * horizontal, calcula encargos patronais, provisões e custo por funcionário,
 * agrega por unidade/setor e confere os dados antes do fechamento.
 *
 * Funções puras — rodam no servidor (fechamento, integração com o DRE) e no
 * navegador (os filtros recalculam tudo sem ir ao banco).
 *
 * Três naturezas de valor são mantidas separadas o tempo todo:
 *   - pago:      o que a folha do mês efetivamente pagou (proventos);
 *   - encargo:   o que o empregador recolhe (FGTS, INSS patronal, RAT, terceiros);
 *   - provisão:  13º, férias e 1/3 apropriados no mês, com seus encargos.
 * INSS e IRRF descontados do funcionário são retenções, nunca encargo da empresa.
 */
import { normalizar } from "@/lib/importacao/parsers";
import type { RubricaExtrato, TipoRubrica } from "@/lib/importacao/adaptadores/extrato-mensal";

// ---------------------------------------------------------------------------
// Colunas da tabela analítica

export type ColunaProvento =
  | "salario"
  | "he50"
  | "he100"
  | "adicional_noturno"
  | "gratificacoes"
  | "comissoes"
  | "insalubridade"
  | "periculosidade"
  | "dsr"
  | "ferias"
  | "terco_ferias"
  | "decimo_terceiro"
  | "rescisorias"
  | "outros_proventos"
  | "nao_remuneratorio";

export type ColunaDesconto =
  | "inss"
  | "irrf"
  | "faltas"
  | "atrasos"
  | "afastamentos"
  | "adiantamento"
  | "adiantamento_ferias_13"
  | "vale_transporte"
  | "emprestimo_consignado"
  | "outros_emprestimos"
  | "retornos"
  | "rescisao_paga"
  | "outros_descontos";

export type ColunaRubrica = ColunaProvento | ColunaDesconto;

export interface DefColuna<C extends ColunaRubrica = ColunaRubrica> {
  chave: C;
  rotulo: string;
  tipo: TipoRubrica;
  /** Provento que entra no custo da empresa (não entram estornos/reembolsos). */
  custo?: boolean;
  /** Variável habitual: compõe a base das provisões junto com o salário. */
  habitual?: boolean;
  /** Desconto que devolve custo à empresa (faltas, afastamentos, aviso reavido). */
  reduzCusto?: boolean;
  ajuda?: string;
}

export const COLUNAS_PROVENTOS: DefColuna<ColunaProvento>[] = [
  { chave: "salario", rotulo: "Salário do mês", tipo: "P", custo: true, ajuda: "Dias normais, saldo de salário, licenças e afastamentos pagos pela empresa." },
  { chave: "he50", rotulo: "HE 50%", tipo: "P", custo: true, habitual: true },
  { chave: "he100", rotulo: "HE 100%", tipo: "P", custo: true, habitual: true },
  { chave: "adicional_noturno", rotulo: "Adic. noturno", tipo: "P", custo: true, habitual: true },
  { chave: "gratificacoes", rotulo: "Gratificações", tipo: "P", custo: true, habitual: true },
  { chave: "comissoes", rotulo: "Comissões", tipo: "P", custo: true, habitual: true },
  { chave: "insalubridade", rotulo: "Insalubridade", tipo: "P", custo: true, habitual: true },
  { chave: "periculosidade", rotulo: "Periculosidade", tipo: "P", custo: true, habitual: true },
  { chave: "dsr", rotulo: "DSR e reflexos", tipo: "P", custo: true, habitual: true },
  { chave: "ferias", rotulo: "Férias pagas", tipo: "P", custo: true },
  { chave: "terco_ferias", rotulo: "1/3 férias pago", tipo: "P", custo: true },
  { chave: "decimo_terceiro", rotulo: "13º pago", tipo: "P", custo: true },
  { chave: "rescisorias", rotulo: "Verbas rescisórias", tipo: "P", custo: true, ajuda: "Aviso prévio, indenizações e multas pagas na rescisão." },
  { chave: "outros_proventos", rotulo: "Outras verbas", tipo: "P", custo: true },
  { chave: "nao_remuneratorio", rotulo: "Estornos e reembolsos", tipo: "P", ajuda: "Estornos de desconto, devoluções de INSS e reembolsos: não são custo." },
];

export const COLUNAS_DESCONTOS: DefColuna<ColunaDesconto>[] = [
  { chave: "inss", rotulo: "INSS func.", tipo: "D", ajuda: "Retenção do funcionário. Não é encargo da empresa." },
  { chave: "irrf", rotulo: "IRRF", tipo: "D", ajuda: "Retenção do funcionário. Não é encargo da empresa." },
  { chave: "faltas", rotulo: "Faltas", tipo: "D", reduzCusto: true },
  { chave: "atrasos", rotulo: "Atrasos", tipo: "D", reduzCusto: true },
  { chave: "afastamentos", rotulo: "Afastamentos desc.", tipo: "D", reduzCusto: true, ajuda: "Dias afastados pagos pelo INSS e descontados da folha." },
  { chave: "adiantamento", rotulo: "Adiant. salarial", tipo: "D" },
  { chave: "adiantamento_ferias_13", rotulo: "Adiant. férias/13º", tipo: "D" },
  { chave: "vale_transporte", rotulo: "Vale-transporte", tipo: "D" },
  { chave: "emprestimo_consignado", rotulo: "Consignados", tipo: "D" },
  { chave: "outros_emprestimos", rotulo: "Outros emprést./autoriz.", tipo: "D" },
  { chave: "retornos", rotulo: "Retornos à empresa", tipo: "D", reduzCusto: true, ajuda: "Aviso prévio reavido e multas devidas pelo funcionário." },
  { chave: "rescisao_paga", rotulo: "Líquido rescisão", tipo: "D", ajuda: "Líquido da rescisão, pago fora da folha do mês." },
  { chave: "outros_descontos", rotulo: "Demais descontos", tipo: "D" },
];

export const COLUNAS: DefColuna[] = [...COLUNAS_PROVENTOS, ...COLUNAS_DESCONTOS];
export const DEF_COLUNA = new Map<ColunaRubrica, DefColuna>(COLUNAS.map((c) => [c.chave, c]));

export const ehColunaDoTipo = (coluna: ColunaRubrica, tipo: TipoRubrica) =>
  DEF_COLUNA.get(coluna)?.tipo === tipo;

/**
 * Classificação pela descrição impressa no relatório. Devolve null quando a
 * rubrica não bate com nenhum padrão conhecido: ela fica "não reconhecida" e
 * precisa ser classificada à mão antes do fechamento.
 */
export function colunaAutomatica(r: { descricao: string; tipo: TipoRubrica }): ColunaRubrica | null {
  const d = normalizar(r.descricao);
  if (r.tipo === "P") {
    if (/estorno|reembols|devolu|desc a maior|salario familia/.test(d)) return "nao_remuneratorio";
    if (/reflexo|\bdsr\b|repouso/.test(d)) return "dsr";
    if (/hora.*extra|\bh e\b|\bhe\b/.test(d)) return /100/.test(d) ? "he100" : "he50";
    if (/adic.*not|noturn/.test(d)) return "adicional_noturno";
    if (/insalub/.test(d)) return "insalubridade";
    if (/periculos/.test(d)) return "periculosidade";
    if (/comiss/.test(d)) return "comissoes";
    if (/gratific|quinquenio|anuenio|trienio|premio|produtiv/.test(d)) return "gratificacoes";
    // "1/3" vira "1 3" depois de normalizar; "13" é o 13º salário
    if (/\b1 3\b|terco/.test(d) && /feria|\bfer\b|abono/.test(d)) return "terco_ferias";
    if (/\b13|decimo/.test(d)) return "decimo_terceiro";
    if (/feria|\bfer\b|abono/.test(d)) return "ferias";
    if (/aviso previo|indeniz|multa|rescis/.test(d)) return "rescisorias";
    if (/dias normais|salario|ordenado|licenca|afast|diferenca de sal/.test(d)) return "salario";
    return null;
  }
  if (/liquido.*rescis/.test(d)) return "rescisao_paga";
  if (/\binss\b|i n s s/.test(d)) return "inss";
  if (/irrf|i r r f|imposto de renda/.test(d)) return "irrf";
  if (/falta/.test(d)) return "faltas";
  if (/atraso/.test(d)) return "atrasos";
  if (/afastad|dias afast/.test(d)) return "afastamentos";
  if (/adiant/.test(d)) return /feria|13|decimo/.test(d) ? "adiantamento_ferias_13" : "adiantamento";
  if (/vale transporte|\bvt\b/.test(d)) return "vale_transporte";
  if (/cred trab|consignad|emprestimo|\bemp\b/.test(d)) return "emprestimo_consignado";
  if (/farmacia|autorizad|consumo|convenio|emprest/.test(d)) return "outros_emprestimos";
  if (/reavido|multa/.test(d)) return "retornos";
  if (/plano|odonto|saude|aliment|refei|assistencial|sindical|contribui|pensao|seguro|mensalidade/.test(d)) {
    return "outros_descontos";
  }
  return null;
}

export type OrigemClassificacao = "manual" | "automatica" | "nao_reconhecida";

export interface ClassificacaoRubrica {
  coluna: ColunaRubrica;
  origem: OrigemClassificacao;
}

/** Coluna efetiva de uma rubrica: a escolhida pela empresa ou a automática. */
export function classificar(
  r: { codigo: string; descricao: string; tipo: TipoRubrica },
  colunas: Map<string, ColunaRubrica | null | undefined>,
): ClassificacaoRubrica {
  const manual = colunas.get(`${r.tipo}:${r.codigo}`);
  if (manual && ehColunaDoTipo(manual, r.tipo)) return { coluna: manual, origem: "manual" };
  const auto = colunaAutomatica(r);
  if (auto) return { coluna: auto, origem: "automatica" };
  return { coluna: r.tipo === "P" ? "outros_proventos" : "outros_descontos", origem: "nao_reconhecida" };
}

// ---------------------------------------------------------------------------
// Encargos por CNPJ

export type RegimeTributario = "simples" | "presumido" | "real";

export interface ConfigEncargos {
  regime: RegimeTributario | null;
  /** Percentuais (20 = 20%). */
  inssEmpresa: number;
  rat: number;
  terceiros: number;
  fgts: number;
  fgtsAprendiz: number;
  /** Apropria 13º, férias e 1/3 mês a mês; pagamentos viram baixa da provisão. */
  provisionar: boolean;
  /** "cadastro" quando a empresa salvou; "extrato" quando deduzido do relatório. */
  origem: "cadastro" | "extrato";
}

const pct = (parte: number, base: number) => (base > 0 ? Math.round((parte / base) * 10000) / 100 : 0);

/**
 * Alíquotas deduzidas do quadro de INSS do extrato (Empresa, RAT e Terceiros
 * sobre a base total). Uma empresa do Simples sai com INSS patronal zero.
 */
export function encargosDoExtrato(encargos: Record<string, number>): ConfigEncargos {
  const base = encargos["Base total"] ?? 0;
  const inssEmpresa = pct(encargos["Empresa"] ?? 0, base);
  return {
    regime: base > 0 && inssEmpresa === 0 ? "simples" : null,
    inssEmpresa,
    rat: pct(encargos["RAT"] ?? 0, base),
    terceiros: pct(encargos["Terceiros"] ?? 0, base),
    fgts: 8,
    fgtsAprendiz: 2,
    provisionar: true,
    origem: "extrato",
  };
}

export const aliquotaPatronal = (c: ConfigEncargos) => (c.inssEmpresa + c.rat + c.terceiros) / 100;

// ---------------------------------------------------------------------------
// Linha analítica por funcionário

export interface FuncionarioAnalitico {
  id: string;
  apuracaoId: string;
  unidadeId: string | null;
  matricula: string;
  nome: string;
  cpf: string | null;
  situacao: string;
  vinculo: string | null;
  admissao: string | null;
  centroCusto: string | null;
  departamento: string | null;
  cargo: string | null;
  horasMes: number | null;
  salario: number | null;
  proventos: number;
  descontos: number;
  liquido: number;
  baseInss: number;
  excedenteInss: number;
  baseFgts: number;
  valorFgts: number;
  rubricas: RubricaExtrato[];
  observacoes: string[];
}

export interface CadastroColaborador {
  escala: string | null;
  jornadaSemanal: number | null;
  /** Setor (código de departamento) escolhido à mão, quando o relatório não traz. */
  setor: string | null;
}

export interface LinhaAnalitica {
  f: FuncionarioAnalitico;
  setorCodigo: string | null;
  setorNome: string;
  escala: string | null;
  jornadaSemanal: number | null;
  valores: Record<ColunaRubrica, number>;
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
  /** Proventos que são custo, menos faltas/afastamentos/retornos. */
  remuneracao: number;
  fgts: number;
  inssEmpresa: number;
  rat: number;
  terceiros: number;
  encargos: number;
  baseProvisao: number;
  prov13: number;
  provFerias: number;
  provTerco: number;
  provisoes: number;
  encargosProvisoes: number;
  /** Férias, 1/3 e 13º pagos no mês que consomem provisão já constituída. */
  utilizacaoProvisao: number;
  utilizacaoEncargos: number;
  custoTotal: number;
}

const zeros = () =>
  Object.fromEntries(COLUNAS.map((c) => [c.chave, 0])) as Record<ColunaRubrica, number>;

const r2 = (v: number) => Math.round(v * 100) / 100;

export const ehDemitido = (situacao: string) => /demitid|rescind/i.test(situacao);
export const ehAprendiz = (vinculo: string | null) => /aprendiz/i.test(vinculo ?? "");

/** Jornada semanal a partir das horas mensais do contrato (220 h → 44 h). */
export const jornadaDeHorasMes = (horasMes: number | null) =>
  horasMes ? Math.round((horasMes / 5) * 10) / 10 : null;

export interface ContextoCalculo {
  colunas: Map<string, ColunaRubrica | null | undefined>;
  encargosPorUnidade: Map<string, ConfigEncargos>;
  /** Encargos usados quando a apuração não tem unidade (deduzidos do extrato). */
  encargosPorApuracao: Map<string, ConfigEncargos>;
  setores: Map<string, string>;
  cadastros: Map<string, CadastroColaborador>;
}

export const chaveSetor = (unidadeId: string | null, codigo: string) => `${unidadeId ?? "-"}:${codigo}`;
export const chaveColaborador = (unidadeId: string | null, matricula: string) =>
  `${unidadeId ?? "-"}:${matricula}`;

export function rotuloSetorPadrao(codigo: string | null) {
  return codigo ? `Depto ${codigo}` : "Sem setor";
}

export function calcularLinha(f: FuncionarioAnalitico, ctx: ContextoCalculo): LinhaAnalitica {
  const valores = zeros();
  for (const r of f.rubricas) {
    valores[classificar(r, ctx.colunas).coluna] += r.valor;
  }
  for (const k of Object.keys(valores) as ColunaRubrica[]) valores[k] = r2(valores[k]);

  const config =
    (f.unidadeId ? ctx.encargosPorUnidade.get(f.unidadeId) : undefined) ??
    ctx.encargosPorApuracao.get(f.apuracaoId) ??
    encargosDoExtrato({});

  const cadastro = ctx.cadastros.get(chaveColaborador(f.unidadeId, f.matricula));
  const setorCodigo = cadastro?.setor || f.departamento || null;
  const setorNome = setorCodigo
    ? ctx.setores.get(chaveSetor(f.unidadeId, setorCodigo)) ?? rotuloSetorPadrao(setorCodigo)
    : rotuloSetorPadrao(null);

  const somaColunas = (filtro: (c: DefColuna) => boolean | undefined) =>
    COLUNAS.filter(filtro).reduce((s, c) => s + valores[c.chave], 0);

  const totalProventos = r2(somaColunas((c) => c.tipo === "P"));
  const totalDescontos = r2(somaColunas((c) => c.tipo === "D"));
  const remuneracao = r2(somaColunas((c) => c.custo) - somaColunas((c) => c.reduzCusto));

  // Encargos patronais: FGTS como o relatório calculou (inclui rescisório);
  // INSS empresa, RAT e terceiros sobre a base de INSS (com o excedente do teto)
  const baseEncargos = f.baseInss + f.excedenteInss;
  const fgts = r2(f.valorFgts);
  const inssEmpresa = r2((baseEncargos * config.inssEmpresa) / 100);
  const rat = r2((baseEncargos * config.rat) / 100);
  const terceiros = r2((baseEncargos * config.terceiros) / 100);
  const encargos = r2(fgts + inssEmpresa + rat + terceiros);

  // Provisões do mês: salário contratual + variáveis habituais, para quem segue
  // no quadro. Demitido no mês não provisiona (a rescisão já paga o devido).
  const habituais = somaColunas((c) => c.habitual);
  const ativo = !ehDemitido(f.situacao) && remuneracao > 0;
  const baseProvisao = config.provisionar && ativo ? r2((f.salario ?? 0) + habituais) : 0;
  const prov13 = r2(baseProvisao / 12);
  const provFerias = r2(baseProvisao / 12);
  const provTerco = r2(baseProvisao / 36);
  const provisoes = r2(prov13 + provFerias + provTerco);
  const aliqFgts = (ehAprendiz(f.vinculo) ? config.fgtsAprendiz : config.fgts) / 100;
  const aliqEncargosProv = aliqFgts + aliquotaPatronal(config);
  const encargosProvisoes = r2(provisoes * aliqEncargosProv);

  // Sem duplicidade: com provisão ativa, férias/1/3/13º pagos no mês baixam a
  // provisão constituída nos meses anteriores (e os encargos dela) em vez de
  // virar custo de novo.
  const utilizacaoProvisao = config.provisionar
    ? r2(valores.ferias + valores.terco_ferias + valores.decimo_terceiro)
    : 0;
  const utilizacaoEncargos = r2(Math.min(utilizacaoProvisao * aliqEncargosProv, encargos));

  const custoTotal = r2(
    remuneracao + encargos + provisoes + encargosProvisoes - utilizacaoProvisao - utilizacaoEncargos,
  );

  return {
    f,
    setorCodigo,
    setorNome,
    escala: cadastro?.escala ?? null,
    jornadaSemanal: cadastro?.jornadaSemanal ?? jornadaDeHorasMes(f.horasMes),
    valores,
    totalProventos,
    totalDescontos,
    liquido: r2(f.liquido),
    remuneracao,
    fgts,
    inssEmpresa,
    rat,
    terceiros,
    encargos,
    baseProvisao,
    prov13,
    provFerias,
    provTerco,
    provisoes,
    encargosProvisoes,
    utilizacaoProvisao,
    utilizacaoEncargos,
    custoTotal,
  };
}

// ---------------------------------------------------------------------------
// Totalizações

export const CAMPOS_TOTAIS = [
  "totalProventos",
  "totalDescontos",
  "liquido",
  "remuneracao",
  "fgts",
  "inssEmpresa",
  "rat",
  "terceiros",
  "encargos",
  "baseProvisao",
  "prov13",
  "provFerias",
  "provTerco",
  "provisoes",
  "encargosProvisoes",
  "utilizacaoProvisao",
  "utilizacaoEncargos",
  "custoTotal",
] as const;

export type CampoTotal = (typeof CAMPOS_TOTAIS)[number];

export interface Totais {
  funcionarios: number;
  valores: Record<ColunaRubrica, number>;
  campos: Record<CampoTotal, number>;
}

export function totalizar(linhas: LinhaAnalitica[]): Totais {
  const valores = zeros();
  const campos = Object.fromEntries(CAMPOS_TOTAIS.map((c) => [c, 0])) as Record<CampoTotal, number>;
  for (const l of linhas) {
    for (const c of COLUNAS) valores[c.chave] += l.valores[c.chave];
    for (const c of CAMPOS_TOTAIS) campos[c] += l[c];
  }
  for (const c of COLUNAS) valores[c.chave] = r2(valores[c.chave]);
  for (const c of CAMPOS_TOTAIS) campos[c] = r2(campos[c]);
  return { funcionarios: linhas.length, valores, campos };
}

export interface GrupoSetor {
  codigo: string | null;
  nome: string;
  linhas: LinhaAnalitica[];
  totais: Totais;
}

export interface GrupoUnidade {
  unidadeId: string | null;
  setores: GrupoSetor[];
  totais: Totais;
}

/** Unidade → setor, com subtotais; a ordem das unidades segue `ordemUnidades`. */
export function agrupar(linhas: LinhaAnalitica[], ordemUnidades: (string | null)[]): GrupoUnidade[] {
  const porUnidade = new Map<string | null, LinhaAnalitica[]>();
  for (const l of linhas) {
    const lista = porUnidade.get(l.f.unidadeId) ?? [];
    lista.push(l);
    porUnidade.set(l.f.unidadeId, lista);
  }
  const ordem = [...ordemUnidades, ...[...porUnidade.keys()].filter((u) => !ordemUnidades.includes(u))];
  return ordem
    .filter((u) => porUnidade.has(u))
    .map((unidadeId) => {
      const daUnidade = porUnidade.get(unidadeId)!;
      const porSetor = new Map<string, LinhaAnalitica[]>();
      for (const l of daUnidade) {
        const lista = porSetor.get(l.setorNome) ?? [];
        lista.push(l);
        porSetor.set(l.setorNome, lista);
      }
      const setores = [...porSetor.entries()]
        .map(([nome, ls]) => ({
          codigo: ls[0].setorCodigo,
          nome,
          linhas: ls.sort((a, b) => a.f.nome.localeCompare(b.f.nome, "pt-BR")),
          totais: totalizar(ls),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
      return { unidadeId, setores, totais: totalizar(daUnidade) };
    });
}

// ---------------------------------------------------------------------------
// Empréstimos e adiantamentos

export interface ItemEmprestimo {
  funcionarioId: string;
  unidadeId: string | null;
  matricula: string;
  nome: string;
  tipo: string;
  rubrica: string;
  descricao: string;
  contrato: string | null;
  /** Positivo = descontado do funcionário; negativo = estorno de provisão de desconto. */
  valor: number;
}

const COLUNAS_EMPRESTIMO = new Set<ColunaRubrica>([
  "emprestimo_consignado",
  "outros_emprestimos",
  "adiantamento",
  "adiantamento_ferias_13",
]);

export function contratoDe(descricao: string): string | null {
  const m = descricao.match(/N[º°o]\.?\s*([A-Z0-9./-]*\d[A-Z0-9./-]*)/i);
  return m ? m[1] : null;
}

function tipoEmprestimo(descricao: string, coluna: ColunaRubrica): string {
  const d = normalizar(descricao);
  if (/provisao/.test(d)) return "Provisão de desconto (férias)";
  if (/estorno/.test(d)) return "Estorno de provisão";
  if (/cred trab/.test(d)) return /\bfe\b|feria/.test(d) ? "Crédito do Trabalhador (férias)" : "Crédito do Trabalhador";
  if (coluna === "emprestimo_consignado") return "Empréstimo consignado";
  if (coluna === "adiantamento") return "Adiantamento salarial";
  if (coluna === "adiantamento_ferias_13") return /13|decimo/.test(d) ? "Adiantamento de 13º" : "Adiantamento de férias";
  if (/farmacia/.test(d)) return "Convênio farmácia";
  return "Desconto autorizado";
}

/**
 * Empréstimos, descontos autorizados e adiantamentos, rubrica a rubrica.
 * Estornos de provisão de empréstimo entram negativos para o total refletir o
 * valor realmente descontado no mês — sem somar a provisão e o desconto.
 */
export function emprestimos(linhas: LinhaAnalitica[], ctx: Pick<ContextoCalculo, "colunas">): ItemEmprestimo[] {
  const itens: ItemEmprestimo[] = [];
  for (const { f } of linhas) {
    for (const r of f.rubricas) {
      const { coluna } = classificar(r, ctx.colunas);
      const estorno = r.tipo === "P" && coluna === "nao_remuneratorio" && /emprest/.test(normalizar(r.descricao));
      if (!COLUNAS_EMPRESTIMO.has(coluna) && !estorno) continue;
      itens.push({
        funcionarioId: f.id,
        unidadeId: f.unidadeId,
        matricula: f.matricula,
        nome: f.nome,
        tipo: tipoEmprestimo(r.descricao, coluna),
        rubrica: `${r.tipo} ${r.codigo}`,
        descricao: r.descricao,
        contrato: contratoDe(r.descricao),
        valor: estorno ? -r.valor : r.valor,
      });
    }
  }
  return itens;
}

// ---------------------------------------------------------------------------
// Integração com o DRE

export type TipoCustoDre = "folha" | "encargos" | "provisoes" | "beneficios";

export type NaturezaDre =
  | "salarios"
  | "horas_extras"
  | "adicionais"
  | "gratificacoes_comissoes"
  | "ferias"
  | "decimo_terceiro"
  | "rescisorias"
  | "outras_verbas"
  | "deducoes"
  | "fgts"
  | "inss_patronal"
  | "rat_terceiros"
  | "provisao_13"
  | "provisao_ferias"
  | "encargos_provisoes"
  | "utilizacao_provisoes";

export const NATUREZAS_DRE: { chave: NaturezaDre; rotulo: string; tipo: TipoCustoDre }[] = [
  { chave: "salarios", rotulo: "Salários e DSR", tipo: "folha" },
  { chave: "horas_extras", rotulo: "Horas extras", tipo: "folha" },
  { chave: "adicionais", rotulo: "Adicionais (noturno, insalub., pericul.)", tipo: "folha" },
  { chave: "gratificacoes_comissoes", rotulo: "Gratificações e comissões", tipo: "folha" },
  { chave: "ferias", rotulo: "Férias e 1/3 pagos", tipo: "folha" },
  { chave: "decimo_terceiro", rotulo: "13º pago", tipo: "folha" },
  { chave: "rescisorias", rotulo: "Verbas rescisórias", tipo: "folha" },
  { chave: "outras_verbas", rotulo: "Outras verbas", tipo: "folha" },
  { chave: "deducoes", rotulo: "(−) Faltas, afastamentos e retornos", tipo: "folha" },
  { chave: "fgts", rotulo: "FGTS", tipo: "encargos" },
  { chave: "inss_patronal", rotulo: "INSS patronal", tipo: "encargos" },
  { chave: "rat_terceiros", rotulo: "RAT e terceiros", tipo: "encargos" },
  { chave: "provisao_13", rotulo: "Provisão de 13º", tipo: "provisoes" },
  { chave: "provisao_ferias", rotulo: "Provisão de férias e 1/3", tipo: "provisoes" },
  { chave: "encargos_provisoes", rotulo: "Encargos sobre provisões", tipo: "provisoes" },
  { chave: "utilizacao_provisoes", rotulo: "(−) Utilização de provisões", tipo: "provisoes" },
];

export const ROTULO_TIPO_CUSTO: Record<TipoCustoDre, string> = {
  folha: "Folha",
  encargos: "Encargos",
  provisoes: "Provisões",
  beneficios: "Benefícios",
};

export interface LancamentoDreFolha {
  unidadeId: string | null;
  setor: string;
  centroCusto: string | null;
  natureza: NaturezaDre;
  tipo: TipoCustoDre;
  valor: number;
}

/** Custo apurado agregado por unidade × setor × centro de custo × natureza. Soma = custo total. */
export function lancamentosDre(linhas: LinhaAnalitica[]): LancamentoDreFolha[] {
  const tipoDe = new Map(NATUREZAS_DRE.map((n) => [n.chave, n.tipo]));
  const acumulado = new Map<string, LancamentoDreFolha>();
  const somar = (l: LinhaAnalitica, natureza: NaturezaDre, valor: number) => {
    if (Math.abs(valor) < 0.005) return;
    const chave = [l.f.unidadeId, l.setorNome, l.f.centroCusto, natureza].join("|");
    const atual = acumulado.get(chave) ?? {
      unidadeId: l.f.unidadeId,
      setor: l.setorNome,
      centroCusto: l.f.centroCusto,
      natureza,
      tipo: tipoDe.get(natureza)!,
      valor: 0,
    };
    atual.valor = r2(atual.valor + valor);
    acumulado.set(chave, atual);
  };

  for (const l of linhas) {
    const v = l.valores;
    somar(l, "salarios", v.salario + v.dsr);
    somar(l, "horas_extras", v.he50 + v.he100);
    somar(l, "adicionais", v.adicional_noturno + v.insalubridade + v.periculosidade);
    somar(l, "gratificacoes_comissoes", v.gratificacoes + v.comissoes);
    somar(l, "ferias", v.ferias + v.terco_ferias);
    somar(l, "decimo_terceiro", v.decimo_terceiro);
    somar(l, "rescisorias", v.rescisorias);
    somar(l, "outras_verbas", v.outros_proventos);
    somar(l, "deducoes", -(v.faltas + v.atrasos + v.afastamentos + v.retornos));
    somar(l, "fgts", l.fgts);
    somar(l, "inss_patronal", l.inssEmpresa);
    somar(l, "rat_terceiros", l.rat + l.terceiros);
    somar(l, "provisao_13", l.prov13);
    somar(l, "provisao_ferias", l.provFerias + l.provTerco);
    somar(l, "encargos_provisoes", l.encargosProvisoes);
    somar(l, "utilizacao_provisoes", -(l.utilizacaoProvisao + l.utilizacaoEncargos));
  }
  return [...acumulado.values()];
}

// ---------------------------------------------------------------------------
// Conferência antes do fechamento

export type GravidadePendencia = "bloqueia" | "alerta";

export type TipoPendencia =
  | "sem_unidade"
  | "sem_setor"
  | "setor_sem_nome"
  | "rubrica_nao_classificada"
  | "cnpj"
  | "inconsistencia"
  | "duplicado"
  | "diferenca_total"
  | "sem_base";

export const ROTULO_PENDENCIA: Record<TipoPendencia, string> = {
  sem_unidade: "Relatório sem unidade",
  sem_setor: "Funcionário sem setor",
  setor_sem_nome: "Setor sem nome cadastrado",
  rubrica_nao_classificada: "Rubrica não classificada",
  cnpj: "CNPJ divergente ou ausente",
  inconsistencia: "Valor inconsistente no relatório",
  duplicado: "Funcionário duplicado",
  diferenca_total: "Diferença entre importado e calculado",
  sem_base: "Encargo ou provisão sem base definida",
};

export interface Pendencia {
  /** Estável entre recargas: é a chave da justificativa gravada. */
  chave: string;
  tipo: TipoPendencia;
  gravidade: GravidadePendencia;
  descricao: string;
  unidadeId: string | null;
}

export interface ApuracaoConferencia {
  id: string;
  unidadeId: string | null;
  arquivoNome: string;
  cnpjRelatorio: string | null;
  totais: { proventos: number; descontos: number; liquido: number };
  encargos: Record<string, number>;
  avisos: string[];
}

export interface UnidadeConferencia {
  id: string;
  nome: string;
  cnpj: string | null;
  temConfigEncargos: boolean;
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Tolerância de arredondamento nas comparações de totais. */
const TOLERANCIA = 0.05;

export function conferir({
  apuracoes,
  unidades,
  linhas,
  ctx,
}: {
  apuracoes: ApuracaoConferencia[];
  unidades: UnidadeConferencia[];
  linhas: LinhaAnalitica[];
  ctx: ContextoCalculo;
}): Pendencia[] {
  const pendencias: Pendencia[] = [];
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const nomeUnidade = (id: string | null) => (id ? unidadePorId.get(id)?.nome ?? "Unidade" : "Sem unidade");
  const add = (p: Pendencia) => pendencias.push(p);

  for (const a of apuracoes) {
    const u = a.unidadeId ? unidadePorId.get(a.unidadeId) : undefined;
    const rotulo = u?.nome ?? a.arquivoNome;
    if (!u) {
      add({
        chave: `sem_unidade:${a.id}`,
        tipo: "sem_unidade",
        gravidade: "bloqueia",
        descricao: `${a.arquivoNome}: vincule o relatório a uma unidade.`,
        unidadeId: null,
      });
    }

    // CNPJ
    const cnpjRel = digitos(a.cnpjRelatorio);
    const cnpjUni = digitos(u?.cnpj);
    if (!cnpjRel) {
      add({ chave: `cnpj_relatorio:${a.id}`, tipo: "cnpj", gravidade: "alerta", descricao: `${rotulo}: o relatório não informa CNPJ.`, unidadeId: a.unidadeId });
    } else if (u && !cnpjUni) {
      add({ chave: `cnpj_unidade:${u.id}`, tipo: "cnpj", gravidade: "alerta", descricao: `${u.nome}: unidade sem CNPJ cadastrado (relatório: ${a.cnpjRelatorio}).`, unidadeId: u.id });
    } else if (u && cnpjRel !== cnpjUni) {
      add({ chave: `cnpj_divergente:${a.id}`, tipo: "cnpj", gravidade: "bloqueia", descricao: `${u.nome}: CNPJ do relatório (${a.cnpjRelatorio}) difere do cadastro da unidade (${u.cnpj}).`, unidadeId: u.id });
    }

    // Avisos da leitura do PDF (totais impressos que não batem com as linhas)
    a.avisos.forEach((aviso, i) =>
      add({ chave: `aviso:${a.id}:${i}`, tipo: "inconsistencia", gravidade: "alerta", descricao: `${rotulo}: ${aviso}`, unidadeId: a.unidadeId }),
    );

    // Importado × calculado
    const daApuracao = linhas.filter((l) => l.f.apuracaoId === a.id);
    const t = totalizar(daApuracao);
    const comparar = (rotuloValor: string, calculado: number, importado: number | undefined, chave: string) => {
      if (importado === undefined || importado === 0) return;
      if (Math.abs(calculado - importado) > TOLERANCIA) {
        add({
          chave: `diferenca:${a.id}:${chave}`,
          tipo: "diferenca_total",
          gravidade: "alerta",
          descricao: `${rotulo}: ${rotuloValor} calculado ${brl(calculado)} × relatório ${brl(importado)} (diferença ${brl(calculado - importado)}).`,
          unidadeId: a.unidadeId,
        });
      }
    };
    comparar("proventos", t.campos.totalProventos, a.totais.proventos, "proventos");
    comparar("descontos", t.campos.totalDescontos, a.totais.descontos, "descontos");
    comparar("líquido", t.campos.liquido, a.totais.liquido, "liquido");
    const config = (a.unidadeId ? ctx.encargosPorUnidade.get(a.unidadeId) : undefined) ?? ctx.encargosPorApuracao.get(a.id);
    if (config?.origem === "cadastro") {
      const patronalRelatorio = (a.encargos["Empresa"] ?? 0) + (a.encargos["RAT"] ?? 0) + (a.encargos["Terceiros"] ?? 0);
      comparar("INSS patronal + RAT + terceiros", t.campos.inssEmpresa + t.campos.rat + t.campos.terceiros, patronalRelatorio, "patronal");
    }

    for (const l of daApuracao) {
      if (Math.abs(l.totalProventos - l.totalDescontos - l.liquido) > TOLERANCIA) {
        add({
          chave: `liquido:${l.f.id}`,
          tipo: "inconsistencia",
          gravidade: "alerta",
          descricao: `${rotulo} · ${l.f.matricula} ${l.f.nome}: proventos − descontos (${brl(l.totalProventos - l.totalDescontos)}) ≠ líquido (${brl(l.liquido)}).`,
          unidadeId: a.unidadeId,
        });
      }
    }
  }

  // Encargos sem alíquota cadastrada para a unidade
  for (const u of unidades) {
    if (!apuracoes.some((a) => a.unidadeId === u.id)) continue;
    if (!u.temConfigEncargos) {
      add({
        chave: `sem_base_encargos:${u.id}`,
        tipo: "sem_base",
        gravidade: "alerta",
        descricao: `${u.nome}: alíquotas de encargos não cadastradas — usando as deduzidas do relatório.`,
        unidadeId: u.id,
      });
    }
  }

  // Funcionários: setor, base de provisão, duplicidade
  const setoresSemNome = new Map<string, { unidadeId: string | null; codigo: string; qtd: number }>();
  const porMatricula = new Map<string, LinhaAnalitica[]>();
  const porPessoa = new Map<string, LinhaAnalitica[]>();
  for (const l of linhas) {
    const { f } = l;
    if (!l.setorCodigo) {
      add({
        chave: `sem_setor:${chaveColaborador(f.unidadeId, f.matricula)}`,
        tipo: "sem_setor",
        gravidade: "bloqueia",
        descricao: `${nomeUnidade(f.unidadeId)} · ${f.matricula} ${f.nome}: sem setor no relatório.`,
        unidadeId: f.unidadeId,
      });
    } else if (!ctx.setores.has(chaveSetor(f.unidadeId, l.setorCodigo))) {
      const k = chaveSetor(f.unidadeId, l.setorCodigo);
      const s = setoresSemNome.get(k) ?? { unidadeId: f.unidadeId, codigo: l.setorCodigo, qtd: 0 };
      s.qtd += 1;
      setoresSemNome.set(k, s);
    }
    if (!ehDemitido(f.situacao) && l.remuneracao > 0 && !f.salario) {
      add({
        chave: `sem_base_provisao:${chaveColaborador(f.unidadeId, f.matricula)}`,
        tipo: "sem_base",
        gravidade: "alerta",
        descricao: `${nomeUnidade(f.unidadeId)} · ${f.matricula} ${f.nome}: sem salário contratual — provisões calculadas só sobre as variáveis.`,
        unidadeId: f.unidadeId,
      });
    }
    const km = chaveColaborador(f.unidadeId, f.matricula);
    porMatricula.set(km, [...(porMatricula.get(km) ?? []), l]);
    const kp = digitos(f.cpf) || normalizar(f.nome);
    porPessoa.set(kp, [...(porPessoa.get(kp) ?? []), l]);
  }
  for (const s of setoresSemNome.values()) {
    add({
      chave: `setor_sem_nome:${chaveSetor(s.unidadeId, s.codigo)}`,
      tipo: "setor_sem_nome",
      gravidade: "alerta",
      descricao: `${nomeUnidade(s.unidadeId)}: departamento ${s.codigo} sem nome de setor (${s.qtd} funcionário${s.qtd === 1 ? "" : "s"}).`,
      unidadeId: s.unidadeId,
    });
  }
  for (const [k, ls] of porMatricula) {
    if (ls.length < 2) continue;
    add({
      chave: `duplicado_matricula:${k}`,
      tipo: "duplicado",
      gravidade: "bloqueia",
      descricao: `${nomeUnidade(ls[0].f.unidadeId)}: matrícula ${ls[0].f.matricula} aparece ${ls.length} vezes (${ls.map((l) => l.f.nome).join(", ")}).`,
      unidadeId: ls[0].f.unidadeId,
    });
  }
  for (const [k, ls] of porPessoa) {
    const unidadesDistintas = new Set(ls.map((l) => l.f.unidadeId));
    if (unidadesDistintas.size < 2) continue;
    add({
      chave: `duplicado_pessoa:${k}`,
      tipo: "duplicado",
      gravidade: "alerta",
      descricao: `${ls[0].f.nome} aparece em ${unidadesDistintas.size} unidades (${[...unidadesDistintas].map(nomeUnidade).join(", ")}). Confirme se não é lançamento em duplicidade.`,
      unidadeId: null,
    });
  }

  // Rubricas sem classificação reconhecida
  const vistas = new Set<string>();
  for (const { f } of linhas) {
    for (const r of f.rubricas) {
      const k = `${r.tipo}:${r.codigo}`;
      if (vistas.has(k)) continue;
      vistas.add(k);
      if (classificar(r, ctx.colunas).origem === "nao_reconhecida") {
        add({
          chave: `rubrica:${k}`,
          tipo: "rubrica_nao_classificada",
          gravidade: "bloqueia",
          descricao: `${r.tipo === "P" ? "Provento" : "Desconto"} ${r.codigo} — ${r.descricao}: escolha a coluna da rubrica.`,
          unidadeId: null,
        });
      }
    }
  }

  return pendencias;
}
