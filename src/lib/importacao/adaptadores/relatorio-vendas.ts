/**
 * Adaptador do relatório de vendas do PDV ("Receita Ipê", "Rel. Hospedagem"):
 * seis resumos impressos lado a lado — categoria, departamento, data, usuário,
 * produto/serviço e família —, cada um fechando com uma linha "Total".
 *
 * Como os itens mudam a cada mês, nada aqui depende de nomes de produto: o
 * leitor só conhece os cabeçalhos das tabelas. Cada tabela ocupa uma faixa de
 * x na página; os nomes longos quebram em várias linhas e a linha com os
 * números fica centralizada na célula (mesmo número de linhas acima e abaixo).
 */
import type { LinhaPdf, PaginaPdf, TrechoPdf } from "@/lib/importacao/pdf";
import { parseValor } from "@/lib/importacao/parsers";

export type ResumoVendas = "categoria" | "departamento" | "data" | "usuario" | "produto" | "familia";

export const ROTULO_RESUMO: Record<ResumoVendas, string> = {
  categoria: "Categoria",
  departamento: "Departamento",
  data: "Dia",
  usuario: "Usuário",
  produto: "Produto / serviço",
  familia: "Família",
};

export interface ItemVendas {
  /** Nome como impresso; no resumo por data, a data em ISO (AAAA-MM-DD). */
  nome: string;
  quantidade: number;
  valor: number;
}

export interface RelatorioVendas {
  /** "AAAA-MM", deduzido das datas do resumo por dia. */
  competencia: string;
  periodo: { inicio: string; fim: string } | null;
  resumos: Record<ResumoVendas, ItemVendas[]>;
  /** Total impresso no fim de cada resumo. */
  totais: Partial<Record<ResumoVendas, { quantidade: number; valor: number }>>;
  avisos: string[];
}

/** Primeira palavra do cabeçalho de cada tabela → resumo. */
const CABECALHOS: Record<string, ResumoVendas> = {
  Categoria: "categoria",
  Departamento: "departamento",
  Data: "data",
  Usuário: "usuario",
  Descrição: "produto",
  Família: "familia",
};

/** "AGUA 500ML 2193,00 $19.709,55" · "-5,00 -$45,00" · "Silva, Alinny 0,00 -$1.038,06" */
const RE_LINHA_VALOR = /^(.*?)\s*(-?[\d.]+,\d{2})\s*(-?)\$\s*([\d.]+,\d{2})$/;

/** Folga em x para um trecho pertencer à faixa que começa logo à direita. */
const FOLGA_FAIXA = 4;

/**
 * Junta os trechos de um pedaço de linha. Trechos encostados (sem espaço entre
 * o fim de um e o início do outro) são colados: o PDF quebra números
 * ("1" "." "925" "," "00") e ligaduras ("Inde" "fi" "nido").
 */
function juntar(trechos: TrechoPdf[]): string {
  let texto = "";
  let fimAnterior: number | null = null;
  for (const t of trechos) {
    const encostado =
      fimAnterior !== null && t.largura !== undefined && t.x - fimAnterior < 1;
    texto += texto && !encostado ? ` ${t.texto}` : t.texto;
    fimAnterior = t.largura !== undefined ? t.x + t.largura : null;
  }
  return texto.replace(/\s+/g, " ").trim();
}

const numero = (bruto: string) => parseValor(bruto) ?? 0;

interface Linha {
  y: number;
  texto: string;
}

interface Celula {
  propria: string;
  acima: string[];
  abaixo: string[];
  quantidade: number;
  valor: number;
}

interface EstadoFaixa {
  resumo: ResumoVendas | null;
  pendentes: string[];
  /** Última célula lida nesta página (as quebras não atravessam página). */
  ultima: Celula | null;
}

export function ehRelatorioVendas(paginas: PaginaPdf[]): boolean {
  const texto = (paginas[0] ?? []).map((l) => l.trechos.map((t) => t.texto).join(" "));
  return texto.some((t) => /Resumo por produto e servi/.test(t)) &&
    texto.some((t) => /Resumo (da categoria|por departamento)/.test(t));
}

/** Início (x) de cada tabela, a partir das linhas de cabeçalho "… Qtde Total". */
function faixasDe(paginas: PaginaPdf[]): number[] {
  const inicios: number[] = [];
  for (const pagina of paginas) {
    for (const linha of pagina) {
      if (!linha.trechos.some((t) => t.texto === "Qtde")) continue;
      for (const t of linha.trechos) {
        if (t.texto in CABECALHOS && !inicios.some((x) => Math.abs(x - t.x) < 8)) inicios.push(t.x);
      }
    }
  }
  return inicios.sort((a, b) => a - b);
}

function faixaDoTrecho(faixas: number[], x: number): number {
  let indice = 0;
  for (let i = 0; i < faixas.length; i += 1) if (x + FOLGA_FAIXA >= faixas[i]) indice = i;
  return indice;
}

export function lerRelatorioVendas(paginas: PaginaPdf[]): RelatorioVendas {
  if (!ehRelatorioVendas(paginas)) {
    throw new Error("Este PDF não parece um relatório de vendas (resumos por produto, categoria e data).");
  }

  const faixas = faixasDe(paginas);
  if (faixas.length === 0) throw new Error("Não encontrei os cabeçalhos das tabelas (Qtde / Total).");

  const relatorio: RelatorioVendas = {
    competencia: "",
    periodo: null,
    resumos: { categoria: [], departamento: [], data: [], usuario: [], produto: [], familia: [] },
    totais: {},
    avisos: [],
  };
  const celulas: Record<ResumoVendas, Celula[]> = {
    categoria: [], departamento: [], data: [], usuario: [], produto: [], familia: [],
  };
  const estados: EstadoFaixa[] = faixas.map(() => ({ resumo: null, pendentes: [], ultima: null }));
  const naoReconhecidas: string[] = [];

  /** Sobras de texto ao fim de página/tabela pertencem à última célula. */
  const fecharPendentes = (estado: EstadoFaixa) => {
    if (estado.pendentes.length) {
      if (estado.ultima) estado.ultima.abaixo.push(...estado.pendentes);
      else naoReconhecidas.push(estado.pendentes.join(" "));
    }
    estado.pendentes = [];
  };

  for (const pagina of paginas) {
    // Separa cada linha da página nas faixas das tabelas
    const porFaixa: Linha[][] = faixas.map(() => []);
    for (const linha of pagina as LinhaPdf[]) {
      const grupos = new Map<number, TrechoPdf[]>();
      for (const t of linha.trechos) {
        const f = faixaDoTrecho(faixas, t.x);
        grupos.set(f, [...(grupos.get(f) ?? []), t]);
      }
      for (const [f, trechos] of grupos) porFaixa[f].push({ y: linha.y, texto: juntar(trechos) });
    }

    porFaixa.forEach((linhas, f) => {
      const estado = estados[f];
      estado.ultima = null;

      for (const { texto } of linhas) {
        const palavras = texto.split(" ");
        if (palavras[0] in CABECALHOS && palavras.includes("Qtde")) {
          fecharPendentes(estado);
          estado.resumo = CABECALHOS[palavras[0]];
          estado.ultima = null;
          continue;
        }
        if (texto.startsWith("Resumo ")) continue; // título da tabela
        if (!estado.resumo) continue;

        const m = texto.match(RE_LINHA_VALOR);
        if (m && m[1] === "Total") {
          fecharPendentes(estado);
          relatorio.totais[estado.resumo] = {
            quantidade: numero(m[2]),
            valor: (m[3] ? -1 : 1) * numero(m[4]),
          };
          estado.resumo = null;
          estado.ultima = null;
          continue;
        }
        if (!m) {
          estado.pendentes.push(texto);
          continue;
        }

        // Célula nova: a anterior leva abaixo tantas linhas quanto tem acima
        const celula: Celula = {
          propria: m[1],
          acima: [],
          abaixo: [],
          quantidade: numero(m[2]),
          valor: (m[3] ? -1 : 1) * numero(m[4]),
        };
        if (estado.ultima) {
          const faltam = Math.max(0, estado.ultima.acima.length - estado.ultima.abaixo.length);
          estado.ultima.abaixo.push(...estado.pendentes.splice(0, faltam));
        }
        celula.acima = estado.pendentes;
        estado.pendentes = [];
        estado.ultima = celula;
        celulas[estado.resumo].push(celula);
      }
      fecharPendentes(estado);
    });
  }

  for (const resumo of Object.keys(celulas) as ResumoVendas[]) {
    relatorio.resumos[resumo] = celulas[resumo].map((c) => ({
      nome: normalizarNome(resumo, [...c.acima, c.propria, ...c.abaixo].filter(Boolean).join(" ")),
      quantidade: c.quantidade,
      valor: c.valor,
    }));
  }

  const datas = relatorio.resumos.data.map((d) => d.nome).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (datas.length) {
    relatorio.periodo = { inicio: datas[0], fim: datas[datas.length - 1] };
    // Mês predominante (um relatório pode ter um dia de borda de outro mês)
    const contagem = new Map<string, number>();
    for (const d of datas) contagem.set(d.slice(0, 7), (contagem.get(d.slice(0, 7)) ?? 0) + 1);
    relatorio.competencia = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  validar(relatorio, naoReconhecidas);
  return relatorio;
}

function normalizarNome(resumo: ResumoVendas, nome: string): string {
  if (resumo === "data") {
    const m = nome.replace(/\s+/g, "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : nome;
  }
  return nome.replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim() || "(sem nome)";
}

const centavos = (v: number) => Math.round(v * 100);
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function validar(r: RelatorioVendas, naoReconhecidas: string[]) {
  if (!r.competencia) r.avisos.push("Não encontrei as datas do resumo por dia para saber o mês.");

  for (const resumo of Object.keys(r.resumos) as ResumoVendas[]) {
    const itens = r.resumos[resumo];
    const total = r.totais[resumo];
    if (!total) {
      r.avisos.push(`Resumo por ${ROTULO_RESUMO[resumo].toLowerCase()}: linha "Total" não encontrada.`);
      continue;
    }
    const soma = itens.reduce((s, i) => s + i.valor, 0);
    const qtd = itens.reduce((s, i) => s + i.quantidade, 0);
    if (centavos(soma) !== centavos(total.valor) || centavos(qtd) !== centavos(total.quantidade)) {
      r.avisos.push(
        `Resumo por ${ROTULO_RESUMO[resumo].toLowerCase()}: itens somam ${brl(soma)} (${brl(qtd)} un.), ` +
          `total impresso ${brl(total.valor)} (${brl(total.quantidade)} un.).`,
      );
    }
  }

  // Todos os resumos são cortes do mesmo faturamento
  const valores = [...new Set(Object.values(r.totais).map((t) => centavos(t.valor)))];
  if (valores.length > 1) {
    r.avisos.push("Os totais dos resumos não são iguais entre si; confira o relatório.");
  }

  if (naoReconhecidas.length) {
    r.avisos.push(
      `${naoReconhecidas.length} trecho(s) sem linha de valor, ex.: "${naoReconhecidas[0].slice(0, 60)}".`,
    );
  }
}
