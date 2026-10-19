/**
 * Adaptador do "EXTRATO MENSAL" (folha de pagamento em PDF, layout do sistema
 * de folha usado pela contabilidade). Transforma as linhas do PDF em dados
 * estruturados: funcionários com rubricas, resumo por rubrica, encargos e
 * situações.
 *
 * O relatório tem duas colunas de rubricas lado a lado — proventos (P) à
 * esquerda e descontos (D) à direita — e é a posição x de cada trecho que
 * separa uma da outra. Tudo o que não é reconhecido vira aviso: em dado
 * financeiro, perder uma linha em silêncio é pior do que falhar.
 */
import type { LinhaPdf, PaginaPdf } from "@/lib/importacao/pdf";
import { parseValor } from "@/lib/importacao/parsers";

export type TipoRubrica = "P" | "D";

export interface RubricaExtrato {
  codigo: string;
  descricao: string;
  tipo: TipoRubrica;
  /** Quantidade/percentual/horas como impresso ("30,00", "6:28"). */
  referencia: string;
  valor: number;
}

export interface FuncionarioExtrato {
  matricula: string;
  nome: string;
  situacao: string;
  cpf: string | null;
  admissao: string | null;
  vinculo: string | null;
  centroCusto: string | null;
  departamento: string | null;
  horasMes: number | null;
  cargoCodigo: string | null;
  cargo: string | null;
  cbo: string | null;
  filial: string | null;
  salario: number | null;
  rubricas: RubricaExtrato[];
  proventos: number;
  descontos: number;
  informativa: number;
  liquido: number;
  baseInss: number;
  excedenteInss: number;
  baseFgts: number;
  valorFgts: number;
  baseIrrf: number;
  /** Linhas livres do bloco: demissão, férias, afastamentos. */
  observacoes: string[];
}

export interface ExtratoMensal {
  empresa: { codigo: string | null; nome: string; cnpj: string | null };
  /** "AAAA-MM" */
  competencia: string;
  calculo: string | null;
  emissao: string | null;
  funcionarios: FuncionarioExtrato[];
  resumoRubricas: RubricaExtrato[];
  totais: { proventos: number; descontos: number; liquido: number };
  /** Quadro "INSS | FGTS, PIS e ISS" e IRRF, rótulo → valor. */
  encargos: Record<string, number>;
  /** Quadro "Situações", rótulo → quantidade. */
  situacoes: Record<string, number>;
  avisos: string[];
}

/** A coluna de descontos começa por volta de x=300; proventos terminam no "P" em x≈270. */
const CORTE_COLUNA_X = 285;

const RE_PROVENTO = /^(\d+)\s+(.+?)\s+(\S+)\s+(-?[\d.]*\d,\d{2})\s*P$/;
const RE_DESCONTO = /^(\d+)\s+(.+?)\s+(\S+)\s+(-?[\d.]*\d,\d{2})\s*D$/;

const CABECALHO_PAGINA = new Set(["CNPJ:", "Cálculo:", "Competência:"]);

const texto = (linha: LinhaPdf) => linha.trechos.map((t) => t.texto).join(" ");

/** Converte valor monetário/quantidade impresso; ausente ou ilegível vira 0. */
const numero = (bruto: string | undefined) => (bruto ? parseValor(bruto) ?? 0 : 0);

const dataIso = (bruto: string | undefined) => {
  const m = bruto?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/**
 * Lê pares "Rótulo:" → valor de uma linha. Aceita o valor no trecho seguinte
 * ("Salário:", "2.949,45") ou no mesmo trecho ("Filial: 1").
 */
function pares(linha: LinhaPdf): [string, string][] {
  const resultado: [string, string][] = [];
  const { trechos } = linha;
  for (let i = 0; i < trechos.length; i += 1) {
    const t = trechos[i].texto;
    const mesmo = t.match(/^([^:]+:)\s+(.+)$/);
    if (mesmo) {
      resultado.push([mesmo[1].trim(), mesmo[2].trim()]);
    } else if (t.endsWith(":")) {
      const proximo = trechos[i + 1]?.texto;
      if (proximo !== undefined && !proximo.endsWith(":")) {
        resultado.push([t, proximo]);
        i += 1;
      } else {
        resultado.push([t, ""]);
      }
    }
  }
  return resultado;
}

const mapaDe = (linha: LinhaPdf) => new Map(pares(linha));

/** "26 MANUTENCIONISTA" → ["26", "MANUTENCIONISTA"] */
function codigoENome(bruto: string | undefined): [string | null, string] {
  const m = bruto?.match(/^(\d+)\s+(.+)$/);
  return m ? [m[1], m[2].trim()] : [null, (bruto ?? "").trim()];
}

/**
 * Tenta ler uma linha de rubricas. Devolve as rubricas encontradas (0, 1 ou 2)
 * ou null se a linha não tem cara de rubrica.
 */
function lerRubricas(linha: LinhaPdf): RubricaExtrato[] | null {
  const esquerda = linha.trechos.filter((t) => t.x < CORTE_COLUNA_X);
  const direita = linha.trechos.filter((t) => t.x >= CORTE_COLUNA_X);
  const partes: [string, RegExp, TipoRubrica][] = [];
  if (esquerda.length) partes.push([esquerda.map((t) => t.texto).join(" "), RE_PROVENTO, "P"]);
  if (direita.length) partes.push([direita.map((t) => t.texto).join(" "), RE_DESCONTO, "D"]);
  if (partes.length === 0) return null;

  const rubricas: RubricaExtrato[] = [];
  for (const [conteudo, regex, tipo] of partes) {
    const m = conteudo.match(regex);
    if (!m) return null;
    rubricas.push({
      codigo: m[1],
      descricao: m[2].replace(/\s+/g, " ").trim(),
      tipo,
      referencia: m[3],
      valor: numero(m[4]),
    });
  }
  return rubricas;
}

const novoFuncionario = (mapa: Map<string, string>): FuncionarioExtrato => {
  const [matricula, nome] = codigoENome(mapa.get("Empr.:"));
  return {
    matricula: matricula ?? "",
    nome,
    situacao: mapa.get("Situação:") ?? "",
    cpf: mapa.get("CPF:") || null,
    admissao: dataIso(mapa.get("Adm:")),
    vinculo: null,
    centroCusto: null,
    departamento: null,
    horasMes: null,
    cargoCodigo: null,
    cargo: null,
    cbo: null,
    filial: null,
    salario: null,
    rubricas: [],
    proventos: 0,
    descontos: 0,
    informativa: 0,
    liquido: 0,
    baseInss: 0,
    excedenteInss: 0,
    baseFgts: 0,
    valorFgts: 0,
    baseIrrf: 0,
    observacoes: [],
  };
};

type Secao = "funcionarios" | "resumo" | "encargos" | "irrf" | "situacoes";

const centavos = (v: number) => Math.round(v * 100);
const moedaAviso = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ehExtratoMensal(paginas: PaginaPdf[]): boolean {
  return (paginas[0] ?? []).slice(0, 12).some((l) => texto(l) === "EXTRATO MENSAL");
}

export function lerExtratoMensal(paginas: PaginaPdf[]): ExtratoMensal {
  if (!ehExtratoMensal(paginas)) {
    throw new Error("Este PDF não é um Extrato Mensal da folha.");
  }

  const extrato: ExtratoMensal = {
    empresa: { codigo: null, nome: "", cnpj: null },
    competencia: "",
    calculo: null,
    emissao: null,
    funcionarios: [],
    resumoRubricas: [],
    totais: { proventos: 0, descontos: 0, liquido: 0 },
    encargos: {},
    situacoes: {},
    avisos: [],
  };

  let secao: Secao = "funcionarios";
  let atual: FuncionarioExtrato | null = null;
  const naoReconhecidas: string[] = [];

  paginas.forEach((pagina, indicePagina) => {
    for (const linha of pagina) {
      const conteudo = texto(linha);
      const primeiro = linha.trechos[0]?.texto ?? "";
      const mapa = mapaDe(linha);

      // Cabeçalho repetido em toda página
      if (primeiro === "Empresa:" && mapa.has("Página:")) {
        if (indicePagina === 0) {
          const [codigo, nome] = (mapa.get("Empresa:") ?? "").split(/\s+-\s+/, 2);
          extrato.empresa.codigo = nome ? codigo.trim() : null;
          extrato.empresa.nome = (nome ?? codigo).trim();
        }
        continue;
      }
      if (CABECALHO_PAGINA.has(primeiro)) {
        if (indicePagina === 0) {
          extrato.empresa.cnpj ??= mapa.get("CNPJ:") ?? null;
          extrato.emissao ??= dataIso(mapa.get("Emissão:"));
          extrato.calculo ??= mapa.get("Cálculo:") ?? null;
          const comp = mapa.get("Competência:")?.match(/^(\d{2})\/(\d{4})$/);
          if (comp) extrato.competencia = `${comp[2]}-${comp[1]}`;
        }
        continue;
      }
      if (conteudo === "EXTRATO MENSAL" || conteudo.startsWith("Sistema licenciado")) continue;

      // Mudança de seção
      if (conteudo === "Resumo por Rubrica") {
        secao = "resumo";
        atual = null;
        continue;
      }
      if (conteudo === "INSS FGTS, PIS e ISS") {
        secao = "encargos";
        continue;
      }
      if (conteudo.startsWith("IRRF conforme competência")) {
        secao = "irrf";
        continue;
      }
      if (conteudo === "Situações") {
        secao = "situacoes";
        continue;
      }

      if (primeiro === "Total Geral Proventos:") {
        extrato.totais.proventos = numero(mapa.get("Total Geral Proventos:"));
        extrato.totais.descontos = numero(mapa.get("Total Geral Descontos:"));
        atual = null;
        continue;
      }
      if (primeiro === "Líquido Geral:") {
        extrato.totais.liquido = numero(mapa.get("Líquido Geral:"));
        continue;
      }

      if (secao === "encargos" || secao === "irrf") {
        // No quadro de IRRF a coluna da direita repete os rótulos (competência do pagamento)
        pares(linha).forEach(([rotulo, valor], i) => {
          const chave = rotulo.replace(/:$/, "") + (secao === "irrf" && i === 1 ? " (pagamento)" : "");
          extrato.encargos[chave] = numero(valor);
        });
        continue;
      }
      if (secao === "situacoes") {
        for (const [rotulo, valor] of pares(linha)) {
          extrato.situacoes[rotulo.replace(/:$/, "")] = Math.round(numero(valor));
        }
        continue;
      }

      if (secao === "resumo") {
        const rubricas = lerRubricas(linha);
        if (rubricas) extrato.resumoRubricas.push(...rubricas);
        else naoReconhecidas.push(conteudo);
        continue;
      }

      // Seção de funcionários
      if (primeiro === "Empr.:") {
        atual = novoFuncionario(mapa);
        extrato.funcionarios.push(atual);
        continue;
      }
      if (!atual) {
        naoReconhecidas.push(conteudo);
        continue;
      }
      if (primeiro === "Vínculo:") {
        atual.vinculo = mapa.get("Vínculo:") || null;
        atual.centroCusto = mapa.get("CC:") || null;
        atual.departamento = mapa.get("Depto:") || null;
        atual.horasMes = parseValor(mapa.get("Horas Mês:") ?? "");
        continue;
      }
      if (primeiro === "Cargo:") {
        const [codigo, nome] = codigoENome(mapa.get("Cargo:"));
        atual.cargoCodigo = codigo;
        atual.cargo = nome || null;
        atual.cbo = mapa.get("C.B.O:") || null;
        atual.filial = mapa.get("Filial:") || null;
        atual.salario = parseValor(mapa.get("Salário:") ?? "");
        continue;
      }
      if (primeiro === "ND:") {
        atual.proventos = numero(mapa.get("Proventos:"));
        atual.descontos = numero(mapa.get("Descontos:"));
        atual.informativa = numero(mapa.get("Informativa:"));
        atual.liquido = numero(mapa.get("Líquido:"));
        continue;
      }
      if (primeiro === "NF:") {
        atual.baseInss = numero(mapa.get("Base INSS:"));
        atual.excedenteInss = numero(mapa.get("Excedente INSS:"));
        atual.baseFgts = numero(mapa.get("Base FGTS:"));
        atual.valorFgts = numero(mapa.get("Valor FGTS:"));
        atual.baseIrrf = numero(mapa.get("Base IRRF:"));
        continue;
      }
      const rubricas = lerRubricas(linha);
      if (rubricas) {
        atual.rubricas.push(...rubricas);
        continue;
      }
      // Demissão, férias, afastamentos: texto livre do bloco do funcionário
      atual.observacoes.push(conteudo);
    }
  });

  validar(extrato, naoReconhecidas);
  return extrato;
}

/** Confere os totais impressos contra a soma das linhas lidas. */
function validar(extrato: ExtratoMensal, naoReconhecidas: string[]) {
  const { avisos } = extrato;
  if (!extrato.competencia) avisos.push("Competência não encontrada no cabeçalho.");
  if (extrato.funcionarios.length === 0) avisos.push("Nenhum funcionário encontrado.");

  for (const f of extrato.funcionarios) {
    const p = f.rubricas.filter((r) => r.tipo === "P").reduce((s, r) => s + r.valor, 0);
    const d = f.rubricas.filter((r) => r.tipo === "D").reduce((s, r) => s + r.valor, 0);
    if (centavos(p) !== centavos(f.proventos) || centavos(d) !== centavos(f.descontos)) {
      avisos.push(
        `${f.matricula} ${f.nome}: rubricas somam ${moedaAviso(p)} / ${moedaAviso(d)}, ` +
          `extrato informa ${moedaAviso(f.proventos)} / ${moedaAviso(f.descontos)}.`,
      );
    }
  }

  const soma = (lista: { valor: number }[]) => lista.reduce((s, r) => s + r.valor, 0);
  const proventosFunc = extrato.funcionarios.reduce((s, f) => s + f.proventos, 0);
  const descontosFunc = extrato.funcionarios.reduce((s, f) => s + f.descontos, 0);
  if (extrato.totais.proventos && centavos(proventosFunc) !== centavos(extrato.totais.proventos)) {
    avisos.push(
      `Proventos dos funcionários (${moedaAviso(proventosFunc)}) diferem do Total Geral (${moedaAviso(extrato.totais.proventos)}).`,
    );
  }
  if (extrato.totais.descontos && centavos(descontosFunc) !== centavos(extrato.totais.descontos)) {
    avisos.push(
      `Descontos dos funcionários (${moedaAviso(descontosFunc)}) diferem do Total Geral (${moedaAviso(extrato.totais.descontos)}).`,
    );
  }

  const resumoP = soma(extrato.resumoRubricas.filter((r) => r.tipo === "P"));
  const resumoD = soma(extrato.resumoRubricas.filter((r) => r.tipo === "D"));
  if (extrato.resumoRubricas.length === 0) {
    avisos.push("Página \"Resumo por Rubrica\" não encontrada.");
  } else if (
    centavos(resumoP) !== centavos(extrato.totais.proventos) ||
    centavos(resumoD) !== centavos(extrato.totais.descontos)
  ) {
    avisos.push(
      `Resumo por Rubrica soma ${moedaAviso(resumoP)} / ${moedaAviso(resumoD)}, ` +
        `totais gerais ${moedaAviso(extrato.totais.proventos)} / ${moedaAviso(extrato.totais.descontos)}.`,
    );
  }

  if (naoReconhecidas.length) {
    avisos.push(
      `${naoReconhecidas.length} linha(s) não reconhecida(s), ex.: "${naoReconhecidas[0].slice(0, 80)}".`,
    );
  }
}
