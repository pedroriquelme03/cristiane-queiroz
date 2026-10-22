/**
 * Colunas da tabela analítica da folha — a mesma definição monta a tela e as
 * exportações (Excel/PDF), para as duas nunca divergirem.
 */
import type { NivelAcessoFolha, UnidadeFolha } from "@/lib/dados-folha";
import {
  COLUNAS_DESCONTOS,
  COLUNAS_PROVENTOS,
  type CampoTotal,
  type ColunaRubrica,
  type LinhaAnalitica,
  type Totais,
} from "@/lib/folha-analitica";
import { cnpj as formatarCnpj, cpf as formatarCpf, data as formatarData } from "@/lib/format";

export type GrupoColuna = "identificacao" | "proventos" | "descontos" | "totalizacao";

export const ROTULO_GRUPO: Record<GrupoColuna, string> = {
  identificacao: "Identificação",
  proventos: "Proventos",
  descontos: "Descontos",
  totalizacao: "Totalização (custo para a empresa)",
};

export interface ColunaTabela {
  chave: string;
  rotulo: string;
  grupo: GrupoColuna;
  tipo: "texto" | "moeda" | "numero";
  ajuda?: string;
  /** Valor na linha do funcionário. */
  valor: (l: LinhaAnalitica) => string | number | null;
  /** Valor no subtotal/total (só colunas numéricas). */
  total?: (t: Totais) => number;
  /** Coluna de rubrica: some com "ocultar colunas zeradas" quando o total é zero. */
  rubrica?: ColunaRubrica;
  destaque?: boolean;
}

const campo = (c: CampoTotal) => (t: Totais) => t.campos[c];

export function colunasTabela(nivel: NivelAcessoFolha, unidades: UnidadeFolha[]): ColunaTabela[] {
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const identificacao: ColunaTabela[] = [
    {
      chave: "unidade",
      rotulo: "Unidade",
      grupo: "identificacao",
      tipo: "texto",
      valor: (l) => (l.f.unidadeId ? unidadePorId.get(l.f.unidadeId)?.nome ?? "—" : "Sem unidade"),
    },
    {
      chave: "cnpj",
      rotulo: "CNPJ",
      grupo: "identificacao",
      tipo: "texto",
      valor: (l) => {
        const c = l.f.unidadeId ? unidadePorId.get(l.f.unidadeId)?.cnpj : null;
        return c ? formatarCnpj(c) : "—";
      },
    },
    { chave: "setor", rotulo: "Setor", grupo: "identificacao", tipo: "texto", valor: (l) => l.setorNome },
    { chave: "matricula", rotulo: "Matrícula", grupo: "identificacao", tipo: "texto", valor: (l) => l.f.matricula },
    { chave: "nome", rotulo: "Nome completo", grupo: "identificacao", tipo: "texto", valor: (l) => l.f.nome },
    ...(nivel === "completo"
      ? [
          {
            chave: "cpf",
            rotulo: "CPF",
            grupo: "identificacao",
            tipo: "texto",
            valor: (l: LinhaAnalitica) => (l.f.cpf ? formatarCpf(l.f.cpf) : "—"),
          } satisfies ColunaTabela,
        ]
      : []),
    { chave: "cargo", rotulo: "Cargo/função", grupo: "identificacao", tipo: "texto", valor: (l) => l.f.cargo ?? "—" },
    {
      chave: "admissao",
      rotulo: "Admissão",
      grupo: "identificacao",
      tipo: "texto",
      valor: (l) => (l.f.admissao ? formatarData(l.f.admissao) : "—"),
    },
    { chave: "situacao", rotulo: "Situação", grupo: "identificacao", tipo: "texto", valor: (l) => l.f.situacao || "—" },
    { chave: "escala", rotulo: "Escala", grupo: "identificacao", tipo: "texto", valor: (l) => l.escala ?? "—" },
    {
      chave: "jornada",
      rotulo: "Jornada sem. (h)",
      grupo: "identificacao",
      tipo: "numero",
      valor: (l) => l.jornadaSemanal,
    },
    {
      chave: "salarioBase",
      rotulo: "Salário-base",
      grupo: "identificacao",
      tipo: "moeda",
      valor: (l) => l.f.salario,
    },
  ];

  const proventos: ColunaTabela[] = [
    ...COLUNAS_PROVENTOS.map(
      (c): ColunaTabela => ({
        chave: c.chave,
        rotulo: c.rotulo,
        grupo: "proventos",
        tipo: "moeda",
        ajuda: c.ajuda,
        rubrica: c.chave,
        valor: (l) => l.valores[c.chave],
        total: (t) => t.valores[c.chave],
      }),
    ),
    {
      chave: "totalProventos",
      rotulo: "Total proventos",
      grupo: "proventos",
      tipo: "moeda",
      destaque: true,
      valor: (l) => l.totalProventos,
      total: campo("totalProventos"),
    },
  ];

  const descontos: ColunaTabela[] = [
    ...COLUNAS_DESCONTOS.map(
      (c): ColunaTabela => ({
        chave: c.chave,
        rotulo: c.rotulo,
        grupo: "descontos",
        tipo: "moeda",
        ajuda: c.ajuda,
        rubrica: c.chave,
        valor: (l) => l.valores[c.chave],
        total: (t) => t.valores[c.chave],
      }),
    ),
    {
      chave: "totalDescontos",
      rotulo: "Total descontos",
      grupo: "descontos",
      tipo: "moeda",
      destaque: true,
      valor: (l) => l.totalDescontos,
      total: campo("totalDescontos"),
    },
  ];

  const total = (
    chave: CampoTotal,
    rotulo: string,
    ajuda?: string,
    destaque?: boolean,
  ): ColunaTabela => ({
    chave,
    rotulo,
    grupo: "totalizacao",
    tipo: "moeda",
    ajuda,
    destaque,
    valor: (l) => l[chave],
    total: campo(chave),
  });

  const totalizacao: ColunaTabela[] = [
    total("liquido", "Salário líquido", undefined, true),
    total("remuneracao", "Remuneração (custo)", "Proventos que são custo, menos faltas, afastamentos e retornos."),
    total("fgts", "FGTS patronal", "FGTS do mês como calculado no relatório (inclui rescisório)."),
    total("inssEmpresa", "INSS patronal", "Base de INSS × alíquota patronal cadastrada para o CNPJ."),
    total("rat", "RAT"),
    total("terceiros", "Terceiros"),
    total("prov13", "Prov. 13º", "1/12 da base de provisão (salário + variáveis habituais)."),
    total("provFerias", "Prov. férias", "1/12 da base de provisão."),
    total("provTerco", "Prov. 1/3 férias", "1/36 da base de provisão."),
    total("encargosProvisoes", "Encargos s/ provisões", "FGTS + INSS patronal, RAT e terceiros sobre as provisões."),
    total(
      "utilizacaoProvisao",
      "(−) Utiliz. provisões",
      "Férias, 1/3 e 13º pagos no mês baixam a provisão já constituída — não viram custo duas vezes.",
    ),
    total("utilizacaoEncargos", "(−) Encargos utiliz."),
    total("custoTotal", "Custo total mensal", undefined, true),
  ];

  return [...identificacao, ...proventos, ...descontos, ...totalizacao];
}

/** Colunas de rubrica com total zero no recorte atual (para "ocultar zeradas"). */
export function colunasZeradas(colunas: ColunaTabela[], totais: Totais): Set<string> {
  return new Set(colunas.filter((c) => c.rubrica && Math.abs(c.total?.(totais) ?? 0) < 0.005).map((c) => c.chave));
}
