/**
 * Regras da Apuração da Folha: como cada rubrica entra no total da folha e no
 * custo. Funções puras — rodam no servidor e no navegador (filtros por setor e
 * funcionário recalculam tudo sem ir ao banco).
 */
import { normalizar } from "@/lib/importacao/parsers";
import type { RubricaExtrato, TipoRubrica } from "@/lib/importacao/adaptadores/extrato-mensal";

export type EfeitoRubrica = "soma" | "subtrai" | "ignora";

export type CategoriaCusto =
  | "proventos"
  | "comissao"
  | "produtividade"
  | "retornos"
  | "decimo_terceiro"
  | "ferias"
  | "terco_ferias"
  | "inss"
  | "inss_13"
  | "inss_ferias"
  | "ignorar";

export const ROTULO_CATEGORIA: Record<CategoriaCusto, string> = {
  proventos: "Proventos",
  comissao: "Comissão",
  produtividade: "Produtividade",
  retornos: "Retornos",
  decimo_terceiro: "13º",
  ferias: "Férias",
  terco_ferias: "1/3 Férias",
  inss: "INSS",
  inss_13: "INSS 13º",
  inss_ferias: "INSS Prov. Férias",
  ignorar: "Não entra no custo",
};

export interface ConfigRubrica {
  codigo: string;
  tipo: TipoRubrica;
  efeito: EfeitoRubrica;
  categoria: CategoriaCusto;
}

export interface ManuaisFolha {
  fgts?: number;
  fgtsProvFerias?: number;
  fgtsProv13?: number;
}

export interface FuncionarioFolha {
  id: string;
  matricula: string;
  nome: string;
  situacao: string;
  departamento: string | null;
  cargo: string | null;
  salario: number | null;
  proventos: number;
  descontos: number;
  liquido: number;
  baseInss: number;
  baseFgts: number;
  valorFgts: number;
  baseIrrf: number;
  rubricas: RubricaExtrato[];
  observacoes: string[];
}

export interface ApuracaoFolha {
  id: string;
  competencia: string;
  arquivoNome: string;
  empresaRelatorio: { codigo: string | null; nome: string; cnpj: string | null };
  totais: { proventos: number; descontos: number; liquido: number };
  encargos: Record<string, number>;
  situacoes: Record<string, number>;
  resumoRubricas: RubricaExtrato[];
  manuais: ManuaisFolha;
  atualizadoEm: string;
}

export const chaveRubrica = (r: { codigo: string; tipo: TipoRubrica }) => `${r.tipo}:${r.codigo}`;

/** Classificação inicial, pela descrição, enquanto a empresa não configura a rubrica. */
export function categoriaPadrao(r: { descricao: string; tipo: TipoRubrica }): CategoriaCusto {
  const d = normalizar(r.descricao);
  if (r.tipo === "D") {
    if (/\binss\b|i n s s/.test(d)) {
      if (/\b13|decimo/.test(d)) return "inss_13";
      if (/feria/.test(d)) return "inss_ferias";
      return "inss";
    }
    return "retornos";
  }
  if (/comiss/.test(d)) return "comissao";
  if (/produtiv/.test(d)) return "produtividade";
  if (/(1 3|terco)/.test(d) && /feria|abono/.test(d)) return "terco_ferias";
  if (/\b13|decimo/.test(d)) return "decimo_terceiro";
  if (/feria|abono/.test(d)) return "ferias";
  return "proventos";
}

export function configDe(
  r: { codigo: string; descricao: string; tipo: TipoRubrica },
  configs: Map<string, ConfigRubrica>,
): ConfigRubrica {
  return (
    configs.get(chaveRubrica(r)) ?? {
      codigo: r.codigo,
      tipo: r.tipo,
      efeito: r.tipo === "P" ? "soma" : "subtrai",
      categoria: categoriaPadrao(r),
    }
  );
}

/** Soma referências impressas: horas ("124:46") somam em minutos, o resto como número. */
function somarReferencias(refs: string[]): string {
  if (refs.length && refs.every((r) => /^\d+:\d{2}$/.test(r))) {
    const minutos = refs.reduce((s, r) => {
      const [h, m] = r.split(":").map(Number);
      return s + h * 60 + m;
    }, 0);
    return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;
  }
  const total = refs.reduce((s, r) => s + (Number(r.replace(/\./g, "").replace(",", ".")) || 0), 0);
  return total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Agrega as rubricas dos funcionários (usado quando há filtro de setor/funcionário). */
export function resumirRubricas(funcionarios: FuncionarioFolha[]): RubricaExtrato[] {
  const grupos = new Map<string, { base: RubricaExtrato; refs: string[]; valor: number }>();
  for (const f of funcionarios) {
    for (const r of f.rubricas) {
      const chave = chaveRubrica(r);
      const g = grupos.get(chave) ?? { base: r, refs: [], valor: 0 };
      g.refs.push(r.referencia);
      g.valor += r.valor;
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g.base,
      referencia: somarReferencias(g.refs),
      valor: Math.round(g.valor * 100) / 100,
    }))
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

/** Total da folha pelo efeito de cada rubrica: soma − subtrai. */
export function totalFolha(resumo: RubricaExtrato[], configs: Map<string, ConfigRubrica>): number {
  return resumo.reduce((s, r) => {
    const { efeito } = configDe(r, configs);
    return efeito === "soma" ? s + r.valor : efeito === "subtrai" ? s - r.valor : s;
  }, 0);
}

export interface LinhaCusto {
  categoria: CategoriaCusto;
  rubricas: RubricaExtrato[];
  valor: number;
}

export interface CustoFolha {
  linhas: Record<Exclude<CategoriaCusto, "ignorar">, LinhaCusto>;
  ignoradas: RubricaExtrato[];
  totalSalario: number;
  totalCusto: number;
}

/**
 * Custo da folha. TOTAL CUSTO = salário (proventos + comissão + produtividade)
 * − retornos + 13º + férias + 1/3 + FGTS (manuais) + INSS.
 */
export function calcularCusto(
  resumo: RubricaExtrato[],
  configs: Map<string, ConfigRubrica>,
  manuais: ManuaisFolha,
): CustoFolha {
  const vazia = (categoria: CategoriaCusto): LinhaCusto => ({ categoria, rubricas: [], valor: 0 });
  const linhas = {
    proventos: vazia("proventos"),
    comissao: vazia("comissao"),
    produtividade: vazia("produtividade"),
    retornos: vazia("retornos"),
    decimo_terceiro: vazia("decimo_terceiro"),
    ferias: vazia("ferias"),
    terco_ferias: vazia("terco_ferias"),
    inss: vazia("inss"),
    inss_13: vazia("inss_13"),
    inss_ferias: vazia("inss_ferias"),
  };
  const ignoradas: RubricaExtrato[] = [];

  for (const r of resumo) {
    const { categoria } = configDe(r, configs);
    if (categoria === "ignorar") {
      ignoradas.push(r);
      continue;
    }
    linhas[categoria].rubricas.push(r);
    linhas[categoria].valor += r.valor;
  }

  const totalSalario = linhas.proventos.valor + linhas.comissao.valor + linhas.produtividade.valor;
  const fgts = (manuais.fgts ?? 0) + (manuais.fgtsProvFerias ?? 0) + (manuais.fgtsProv13 ?? 0);
  const totalCusto =
    totalSalario -
    linhas.retornos.valor +
    linhas.decimo_terceiro.valor +
    linhas.ferias.valor +
    linhas.terco_ferias.valor +
    fgts +
    linhas.inss.valor +
    linhas.inss_13.valor +
    linhas.inss_ferias.valor;

  return { linhas, ignoradas, totalSalario, totalCusto };
}

/** "Depto 3" quando o extrato só traz o código do departamento. */
export const rotuloSetor = (departamento: string | null) =>
  departamento ? `Depto ${departamento}` : "Sem setor";
