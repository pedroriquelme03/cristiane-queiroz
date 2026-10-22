"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Lock,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { salvarConfigRubricaFolha, salvarManuaisFolha, registrarExportacaoFolha } from "@/app/(app)/financeiro/folha/acoes";
import { colunasTabela, colunasZeradas } from "@/components/folha/colunas-tabela";
import { ConferenciaFolha } from "@/components/folha/conferencia-folha";
import { ConfiguracaoFolha } from "@/components/folha/configuracao-folha";
import { EmprestimosFolha } from "@/components/folha/emprestimos-folha";
import { exportarExcel, exportarPdf } from "@/components/folha/exportar-folha";
import { HistoricoFolha } from "@/components/folha/historico-folha";
import { ImportarRelatorios } from "@/components/folha/importar-relatorios";
import { CustoDaFolha, ResumoPorRubrica } from "@/components/folha/secoes-folha";
import { TabelaAnalitica } from "@/components/folha/tabela-analitica";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import type {
  ConfigFolha,
  ContaPlano,
  ContratoEmprestimo,
  EventoFolha,
  MembroFolha,
  MesFolha,
  UnidadeFolha,
  VersaoImportada,
} from "@/lib/dados-folha";
import { chaveRubrica, configDe, resumirRubricas, type ConfigRubrica, type ManuaisFolha } from "@/lib/folha";
import type { NivelAcessoFolha } from "@/lib/folha-acesso";
import {
  agrupar,
  calcularLinha,
  conferir,
  emprestimos,
  encargosDoExtrato,
  rotuloSetorPadrao,
  totalizar,
  type CampoTotal,
  type LinhaAnalitica,
  type NaturezaDre,
  type Totais,
} from "@/lib/folha-analitica";
import { montarContexto } from "@/lib/folha-contexto";
import type { RubricaExtrato } from "@/lib/importacao/adaptadores/extrato-mensal";
import { normalizar } from "@/lib/importacao/parsers";
import { competenciaExtenso, dataHora, moeda, mesCurto, percentual } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SEM_ESCALA = "__sem__";

type Aba = "analitico" | "rubricas" | "emprestimos" | "conferencia" | "historico" | "configuracao";

/** Indicadores do topo e do comparativo de períodos. */
const INDICADORES: { campo: CampoTotal; rotulo: string; tom?: "positivo" | "negativo" }[] = [
  { campo: "remuneracao", rotulo: "Salários e remunerações" },
  { campo: "totalProventos", rotulo: "Total de proventos", tom: "positivo" },
  { campo: "totalDescontos", rotulo: "Total de descontos", tom: "negativo" },
  { campo: "liquido", rotulo: "Líquido da folha" },
  { campo: "encargos", rotulo: "Encargos patronais" },
  { campo: "provisoes", rotulo: "Provisões (13º, férias, 1/3)" },
  { campo: "encargosProvisoes", rotulo: "Encargos s/ provisões" },
  { campo: "custoTotal", rotulo: "Custo total da folha" },
];

export interface PropsPainelFolha {
  empresaId: string;
  competencia: string;
  competenciasImportadas: string[];
  nivel: NivelAcessoFolha;
  ehAdmin: boolean;
  /** Perfil pode editar (admin/cliente); a competência fechada bloqueia por cima. */
  perfilEdita: boolean;
  unidades: UnidadeFolha[];
  config: ConfigFolha;
  meses: MesFolha[];
  contratos: ContratoEmprestimo[];
  versoes: VersaoImportada[];
  eventos: EventoFolha[];
  contasDre: Partial<Record<NaturezaDre, string>>;
  planoContas: ContaPlano[];
  membros: MembroFolha[];
}

export function PainelFolha(props: PropsPainelFolha) {
  const { empresaId, competencia, competenciasImportadas, nivel, ehAdmin, perfilEdita, unidades, config, meses } = props;
  const [mes, ...comparados] = meses;
  const fechada = mes.status.status === "fechada";
  const podeEditar = perfilEdita && !fechada;
  const semIndividuais = nivel === "agregado";

  const [aba, setAba] = useState<Aba>("analitico");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [busca, setBusca] = useState("");
  const [escala, setEscala] = useState("");
  const [ocultarZeradas, setOcultarZeradas] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [configs, setConfigs] = useState(() => new Map(config.rubricas.map((c) => [chaveRubrica(c), c])));
  const [manuais, setManuais] = useState(() => new Map(mes.apuracoes.map((a) => [a.id, a.manuais])));

  // Competência fechada usa a configuração congelada no fechamento
  const configEfetiva: ConfigFolha = useMemo(
    () => mes.status.snapshot ?? { ...config, rubricas: [...configs.values()] },
    [mes.status.snapshot, config, configs],
  );
  const configsRubricas = useMemo(
    () => new Map(configEfetiva.rubricas.map((c) => [chaveRubrica(c), c])),
    [configEfetiva],
  );
  const ctx = useMemo(() => montarContexto(configEfetiva, mes.apuracoes), [configEfetiva, mes.apuracoes]);
  const linhas = useMemo(() => mes.funcionarios.map((f) => calcularLinha(f, ctx)), [mes.funcionarios, ctx]);

  const passaFiltro = useMemo(() => {
    const termo = normalizar(busca);
    return (l: LinhaAnalitica) =>
      (!unidade || (l.f.unidadeId ?? "") === unidade) &&
      (!setor || l.setorNome === setor) &&
      (!escala || (escala === SEM_ESCALA ? !l.escala : l.escala === escala)) &&
      (!termo || normalizar(l.f.nome).includes(termo) || l.f.matricula === busca.trim());
  }, [unidade, setor, escala, busca]);

  const filtradas = useMemo(() => linhas.filter(passaFiltro), [linhas, passaFiltro]);
  const totais = useMemo(() => totalizar(filtradas), [filtradas]);
  const ordemUnidades = useMemo(() => unidades.map((u) => u.id as string | null), [unidades]);
  const grupos = useMemo(() => agrupar(filtradas, ordemUnidades), [filtradas, ordemUnidades]);
  const comFiltro = Boolean(unidade || setor || busca || escala);

  const pendencias = useMemo(
    () =>
      conferir({
        apuracoes: mes.apuracoes.map((a) => ({
          id: a.id,
          unidadeId: a.unidadeId,
          arquivoNome: a.arquivoNome,
          cnpjRelatorio: a.empresaRelatorio.cnpj,
          totais: a.totais,
          encargos: a.encargos,
          avisos: a.avisos,
        })),
        unidades: unidades.map((u) => ({ ...u, temConfigEncargos: Boolean(configEfetiva.encargos[u.id]) })),
        linhas,
        ctx,
      }),
    [mes.apuracoes, unidades, configEfetiva, linhas, ctx],
  );
  const bloqueiosAbertos = pendencias.filter((p) => p.gravidade === "bloqueia" && !mes.status.justificativas[p.chave]);

  // Opções dos filtros (setor depende da unidade escolhida)
  const setores = useMemo(
    () =>
      [...new Set(linhas.filter((l) => !unidade || (l.f.unidadeId ?? "") === unidade).map((l) => l.setorNome))].sort(
        (a, b) => a.localeCompare(b, "pt-BR", { numeric: true }),
      ),
    [linhas, unidade],
  );
  const escalas = useMemo(
    () => [...new Set(linhas.map((l) => l.escala).filter((e): e is string => Boolean(e)))].sort(),
    [linhas],
  );
  const setoresPorUnidade = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    const nomeDe = (u: string, codigo: string) =>
      ctx.setores.get(`${u}:${codigo}`) ?? rotuloSetorPadrao(codigo);
    for (const l of linhas) {
      if (!l.f.unidadeId || !l.f.departamento) continue;
      const mm = m.get(l.f.unidadeId) ?? new Map();
      mm.set(l.f.departamento, nomeDe(l.f.unidadeId, l.f.departamento));
      m.set(l.f.unidadeId, mm);
    }
    for (const s of configEfetiva.setores) {
      const mm = m.get(s.unidadeId) ?? new Map();
      mm.set(s.codigo, s.nome);
      m.set(s.unidadeId, mm);
    }
    return new Map(
      [...m.entries()].map(([u, mm]) => [
        u,
        [...mm.entries()].map(([codigo, nome]) => ({ codigo, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      ]),
    );
  }, [linhas, configEfetiva.setores, ctx.setores]);

  // Comparativo: mesmos filtros aplicados aos outros meses
  const comparativo = useMemo(
    () =>
      comparados.map((m) => {
        const c = montarContexto(m.status.snapshot ?? configEfetiva, m.apuracoes);
        return { competencia: m.competencia, totais: totalizar(m.funcionarios.map((f) => calcularLinha(f, c)).filter(passaFiltro)) };
      }),
    [comparados, configEfetiva, passaFiltro],
  );

  const colunas = useMemo(() => colunasTabela(nivel, unidades), [nivel, unidades]);
  const visiveis = useMemo(() => {
    const zeradas = ocultarZeradas ? colunasZeradas(colunas, totais) : new Set<string>();
    return colunas.filter((c) => !zeradas.has(c.chave));
  }, [colunas, totais, ocultarZeradas]);

  // "Rubricas e custo": sem recorte e com um relatório só, vale o resumo impresso no relatório
  const apuracoesNaVisao = useMemo(
    () => mes.apuracoes.filter((a) => !unidade || (a.unidadeId ?? "") === unidade),
    [mes.apuracoes, unidade],
  );
  const apuracaoUnica = apuracoesNaVisao.length === 1 ? apuracoesNaVisao[0] : null;
  const recorteFino = Boolean(setor || busca || escala);
  const resumo = useMemo(
    () => (apuracaoUnica && !recorteFino ? apuracaoUnica.resumoRubricas : resumirRubricas(filtradas.map((l) => l.f))),
    [apuracaoUnica, recorteFino, filtradas],
  );
  const manuaisNaVisao: ManuaisFolha = recorteFino
    ? {}
    : apuracoesNaVisao.reduce<ManuaisFolha>(
        (s, a) => {
          const m = manuais.get(a.id) ?? {};
          return {
            fgts: (s.fgts ?? 0) + (m.fgts ?? 0),
            fgtsProvFerias: (s.fgtsProvFerias ?? 0) + (m.fgtsProvFerias ?? 0),
            fgtsProv13: (s.fgtsProv13 ?? 0) + (m.fgtsProv13 ?? 0),
          };
        },
        {},
      );

  const situacoes = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of filtradas) contagem.set(l.f.situacao || "—", (contagem.get(l.f.situacao || "—") ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtradas]);

  async function alterarConfig(r: RubricaExtrato, mudanca: Partial<ConfigRubrica>) {
    const chave = chaveRubrica(r);
    const anterior = configs.get(chave);
    const nova = { ...configDe(r, configs), ...mudanca };
    setConfigs((m) => new Map(m).set(chave, nova));
    const resultado = await salvarConfigRubricaFolha(empresaId, { ...nova, descricao: r.descricao });
    if (!resultado.ok) {
      setConfigs((m) => {
        const copia = new Map(m);
        if (anterior) copia.set(chave, anterior);
        else copia.delete(chave);
        return copia;
      });
      setAviso(resultado.erro);
    }
  }

  async function alterarManual(campo: keyof ManuaisFolha, valor: number) {
    if (!apuracaoUnica) return;
    const anteriores = manuais.get(apuracaoUnica.id) ?? {};
    const novos = { ...anteriores, [campo]: valor };
    setManuais((m) => new Map(m).set(apuracaoUnica.id, novos));
    const resultado = await salvarManuaisFolha(empresaId, { apuracaoId: apuracaoUnica.id, manuais: novos });
    if (!resultado.ok) {
      setManuais((m) => new Map(m).set(apuracaoUnica.id, anteriores));
      setAviso(resultado.erro);
    }
  }

  const descricaoFiltros = [
    competenciaExtenso(competencia),
    unidade ? unidades.find((u) => u.id === unidade)?.nome : "Consolidado das unidades",
    setor && `Setor: ${setor}`,
    escala && `Escala: ${escala === SEM_ESCALA ? "sem escala" : escala}`,
    busca && `Funcionário: ${busca}`,
  ]
    .filter(Boolean)
    .join(" · ");

  function exportar(formato: "excel" | "pdf") {
    const meta = {
      titulo: `Apuração da Folha — ${competenciaExtenso(competencia)}`,
      filtros: descricaoFiltros,
      nomeArquivo: `apuracao-folha-${competencia.slice(0, 7)}`,
      unidades,
      semIndividuais,
    };
    if (formato === "excel") exportarExcel(grupos, visiveis, meta, totais);
    else exportarPdf(grupos, visiveis, meta, totais);
    void registrarExportacaoFolha(empresaId, {
      competencia,
      formato,
      filtros: descricaoFiltros.slice(0, 500),
      linhas: filtradas.length,
    });
  }

  const encargosSugeridos = Object.fromEntries(
    mes.apuracoes.filter((a) => a.unidadeId).map((a) => [a.unidadeId!, encargosDoExtrato(a.encargos)]),
  );
  const setoresConfig = [...setoresPorUnidade.entries()].flatMap(([unidadeId, lista]) =>
    lista.map((s) => ({
      unidadeId,
      codigo: s.codigo,
      nome: ctx.setores.get(`${unidadeId}:${s.codigo}`) ?? null,
      funcionarios: linhas.filter((l) => l.f.unidadeId === unidadeId && l.setorCodigo === s.codigo).length,
    })),
  );

  const temDados = mes.apuracoes.length > 0;
  const abas: { chave: Aba; rotulo: string; contagem?: number; oculta?: boolean }[] = [
    { chave: "analitico", rotulo: "Analítico" },
    { chave: "rubricas", rotulo: "Rubricas e custo" },
    { chave: "emprestimos", rotulo: "Empréstimos" },
    { chave: "conferencia", rotulo: "Conferência e fechamento", contagem: bloqueiosAbertos.length },
    { chave: "historico", rotulo: "Histórico" },
    { chave: "configuracao", rotulo: "Configurações" },
  ];

  return (
    <>
      <Card>
        <CardHeader
          titulo={`Apuração da Folha — ${competenciaExtenso(competencia)}`}
          descricao="Relatórios de todas as unidades da competência, com custo por funcionário, setor e unidade: pagos, encargos patronais e provisões."
          acao={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {fechada ? (
                <Badge tom="positivo">
                  <Lock className="size-3" aria-hidden /> Competência fechada
                </Badge>
              ) : null}
              <SeletorAno competencia={competencia} importadas={competenciasImportadas} />
              <BotaoAtualizar />
              {podeEditar ? (
                <ImportarRelatorios
                  empresaId={empresaId}
                  competencia={competencia}
                  unidades={unidades}
                  temApuracao={(id) => mes.apuracoes.some((a) => a.unidadeId === id)}
                />
              ) : null}
            </div>
          }
        />
        {temDados ? (
          <CardBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Filtro rotulo="Unidade">
                <select
                  value={unidade}
                  onChange={(e) => {
                    setUnidade(e.target.value);
                    setSetor("");
                  }}
                  className={CLASSE_FILTRO}
                >
                  <option value="">Consolidado ({mes.apuracoes.length} unidade{mes.apuracoes.length === 1 ? "" : "s"})</option>
                  {unidades
                    .filter((u) => mes.apuracoes.some((a) => a.unidadeId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                </select>
              </Filtro>
              <Filtro rotulo="Setor">
                <select value={setor} onChange={(e) => setSetor(e.target.value)} className={CLASSE_FILTRO}>
                  <option value="">Todos os setores</option>
                  {setores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Filtro>
              <Filtro rotulo="Funcionário">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2 left-2 size-3.5 text-muted-foreground" aria-hidden />
                  <input
                    value={busca}
                    disabled={semIndividuais}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={semIndividuais ? "Sem acesso individual" : "Nome ou matrícula"}
                    className={cn(CLASSE_FILTRO, "pl-7")}
                  />
                </div>
              </Filtro>
              <Filtro rotulo="Escala de trabalho">
                <select value={escala} onChange={(e) => setEscala(e.target.value)} className={CLASSE_FILTRO}>
                  <option value="">Todas as escalas</option>
                  {[...new Set(["6x1", "5x2", "12x36", ...escalas])].map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                  <option value={SEM_ESCALA}>Sem escala cadastrada</option>
                </select>
              </Filtro>
              <Filtro rotulo="Comparar com">
                <SeletorComparativo competencia={competencia} importadas={competenciasImportadas} />
              </Filtro>
            </div>
            {comFiltro ? (
              <button
                type="button"
                onClick={() => {
                  setUnidade("");
                  setSetor("");
                  setBusca("");
                  setEscala("");
                }}
                className="text-xs font-medium text-brand"
              >
                Limpar filtros
              </button>
            ) : null}
          </CardBody>
        ) : null}
      </Card>

      {aviso ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-negative/20 bg-negative-soft px-4 py-3">
          <p className="text-sm text-negative">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} className="text-xs font-medium text-negative">
            Fechar
          </button>
        </div>
      ) : null}

      {!temDados ? (
        <>
          <Card>
            <CardBody className="py-12 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">Nenhum relatório importado para {competenciaExtenso(competencia)}.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {podeEditar
                  ? "Use “Importar relatórios” e escolha os Extratos Mensais das unidades (pode selecionar vários PDFs)."
                  : "Peça para a consultoria importar os relatórios deste mês."}
              </p>
            </CardBody>
          </Card>
          {podeEditar || ehAdmin ? (
            <ConfiguracaoFolha
              empresaId={empresaId}
              unidades={unidades}
              encargosSalvos={configEfetiva.encargos}
              encargosSugeridos={{}}
              setores={[]}
              contasDre={props.contasDre}
              planoContas={props.planoContas}
              membros={props.membros}
              podeEditar={perfilEdita}
              ehAdmin={ehAdmin}
            />
          ) : null}
        </>
      ) : (
        <>
          <UnidadesImportadas mes={mes} unidades={unidades} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {INDICADORES.map((i) => (
              <Kpi
                key={i.campo}
                rotulo={i.rotulo}
                valor={moeda(totais.campos[i.campo])}
                tom={i.campo === "custoTotal" ? "neutro" : i.tom}
                nota={
                  i.campo === "custoTotal"
                    ? `${totais.funcionarios} funcionários · ${comFiltro ? "recorte filtrado" : "todas as unidades"}`
                    : i.campo === "liquido" && !comFiltro
                      ? `Relatórios: ${moeda(mes.apuracoes.reduce((s, a) => s + a.totais.liquido, 0))}`
                      : undefined
                }
              />
            ))}
          </div>

          {comparativo.length ? (
            <ComparativoPeriodos atual={{ competencia, totais }} outros={comparativo} />
          ) : null}

          <div className="border-b border-border">
            <nav aria-label="Seções da apuração" className="-mb-px flex gap-1 overflow-x-auto">
              {abas.map((a) => (
                <button
                  key={a.chave}
                  type="button"
                  onClick={() => setAba(a.chave)}
                  aria-current={aba === a.chave ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                    aba === a.chave ? "border-brand font-medium text-brand" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.rotulo}
                  {a.contagem ? (
                    <span className="rounded-full bg-negative px-1.5 text-[10px] font-semibold text-white">{a.contagem}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>

          {aba === "analitico" ? (
            <Card>
              <CardHeader
                titulo="Tabela analítica por funcionário"
                descricao={
                  semIndividuais
                    ? "Seu acesso mostra apenas os totais por setor e unidade."
                    : "Role para os lados para ver todas as verbas. Clique no colaborador para ver as rubricas e ajustar escala, jornada e setor."
                }
                acao={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={ocultarZeradas} onChange={(e) => setOcultarZeradas(e.target.checked)} />
                      Ocultar colunas zeradas
                    </label>
                    <button
                      type="button"
                      onClick={() => exportar("pdf")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-brand/50"
                    >
                      <FileDown className="size-3.5" aria-hidden />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportar("excel")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90"
                    >
                      <FileSpreadsheet className="size-3.5" aria-hidden />
                      Excel
                    </button>
                  </div>
                }
              />
              <TabelaAnalitica
                grupos={grupos}
                colunas={visiveis}
                geral={totais}
                unidades={unidades}
                nivel={nivel}
                ctx={ctx}
                podeEditar={podeEditar}
                empresaId={empresaId}
                competencia={competencia}
                escalasConhecidas={escalas}
                setoresPorUnidade={setoresPorUnidade}
              />
            </Card>
          ) : null}

          {aba === "rubricas" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <Users className="size-3.5" aria-hidden />
                  Situações
                </span>
                {situacoes.map(([nome, qtd]) => (
                  <span key={nome} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs">
                    {nome}: <strong className="tabular">{qtd}</strong>
                  </span>
                ))}
              </div>
              <ResumoPorRubrica
                resumo={resumo}
                configs={configsRubricas}
                competencia={competencia}
                podeEditar={podeEditar}
                onAlterar={alterarConfig}
              />
              <CustoDaFolha
                resumo={resumo}
                configs={configsRubricas}
                manuais={manuaisNaVisao}
                competencia={competencia}
                comFiltro={recorteFino || !apuracaoUnica}
                encargos={apuracaoUnica?.encargos ?? {}}
                podeEditar={podeEditar}
                onAlterarConfig={alterarConfig}
                onAlterarManual={alterarManual}
              />
            </>
          ) : null}

          {aba === "emprestimos" ? (
            <EmprestimosFolha
              itens={emprestimos(filtradas, ctx)}
              contratos={props.contratos}
              unidades={unidades}
              competencia={competencia}
              empresaId={empresaId}
              podeEditar={podeEditar}
              semIndividuais={semIndividuais}
            />
          ) : null}

          {aba === "conferencia" ? (
            <ConferenciaFolha
              empresaId={empresaId}
              competencia={competencia}
              pendencias={pendencias}
              status={mes.status}
              apuracoes={mes.apuracoes}
              unidades={unidades}
              podeEditar={podeEditar}
              ehAdmin={ehAdmin}
              onIrPara={(destino) => setAba(destino)}
            />
          ) : null}

          {aba === "historico" ? (
            <HistoricoFolha
              empresaId={empresaId}
              versoes={props.versoes}
              eventos={props.eventos}
              unidades={unidades}
              funcionariosAtuais={mes.funcionarios}
            />
          ) : null}

          {aba === "configuracao" ? (
            <ConfiguracaoFolha
              empresaId={empresaId}
              unidades={unidades}
              encargosSalvos={config.encargos}
              encargosSugeridos={encargosSugeridos}
              setores={setoresConfig}
              contasDre={props.contasDre}
              planoContas={props.planoContas}
              membros={props.membros}
              podeEditar={perfilEdita}
              ehAdmin={ehAdmin}
            />
          ) : null}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

const CLASSE_FILTRO = "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm disabled:opacity-60";

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

function UnidadesImportadas({ mes, unidades }: { mes: MesFolha; unidades: UnidadeFolha[] }) {
  const semRelatorio = unidades.filter((u) => !mes.apuracoes.some((a) => a.unidadeId === u.id));
  return (
    <div className="flex flex-wrap gap-2">
      {mes.apuracoes.map((a) => {
        const u = unidades.find((x) => x.id === a.unidadeId);
        return (
          <div key={a.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-3.5 text-positive" aria-hidden />
              {u?.nome ?? "Sem unidade"}
            </p>
            <p className="text-muted-foreground">
              {a.empresaRelatorio.cnpj ?? "sem CNPJ"} · {a.arquivoNome} · {dataHora(a.atualizadoEm)}
            </p>
          </div>
        );
      })}
      {semRelatorio.map((u) => (
        <div key={u.id} className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium">{u.nome}</p>
          <p>sem relatório nesta competência</p>
        </div>
      ))}
    </div>
  );
}

function ComparativoPeriodos({
  atual,
  outros,
}: {
  atual: { competencia: string; totais: Totais };
  outros: { competencia: string; totais: Totais }[];
}) {
  const periodos = [...outros, atual].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const rotulo = (c: string) => `${mesCurto(c)}/${c.slice(2, 4)}`;
  return (
    <Card>
      <CardHeader
        titulo="Comparativo de períodos"
        descricao="Mesmos filtros aplicados a cada competência. A variação é sobre o mês anterior da lista."
      />
      <CardBody className="overflow-x-auto px-0 py-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-5 py-2 text-left font-medium">Indicador</th>
              {periodos.map((p) => (
                <th
                  key={p.competencia}
                  className={cn("px-3 py-2 text-right font-medium", p.competencia === atual.competencia && "text-foreground")}
                >
                  {rotulo(p.competencia)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[{ campo: "funcionarios" as const, rotulo: "Funcionários" }, ...INDICADORES].map((ind) => (
              <tr key={ind.campo} className="border-b border-border last:border-0">
                <th scope="row" className="px-5 py-1.5 text-left font-normal">
                  {ind.rotulo}
                </th>
                {periodos.map((p, i) => {
                  const v = ind.campo === "funcionarios" ? p.totais.funcionarios : p.totais.campos[ind.campo];
                  const ant = i > 0 ? (ind.campo === "funcionarios" ? periodos[i - 1].totais.funcionarios : periodos[i - 1].totais.campos[ind.campo]) : null;
                  const variacao = ant ? ((v - ant) / Math.abs(ant)) * 100 : null;
                  return (
                    <td key={p.competencia} className="px-3 py-1.5 text-right tabular whitespace-nowrap">
                      {ind.campo === "funcionarios" ? v : moeda(v)}
                      {variacao !== null && Number.isFinite(variacao) ? (
                        <span className={cn("ml-1.5 text-[11px]", variacao > 0 ? "text-negative" : "text-positive")}>
                          {variacao > 0 ? "+" : ""}
                          {percentual(variacao)}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/** Rota da aba do mês, mantendo ?empresa= (admin) e os demais parâmetros. */
function useHrefCompetencia() {
  const params = useSearchParams();
  return (ano: number, mes: number, extras?: Record<string, string | null>) => {
    const novo = new URLSearchParams(params.toString());
    novo.set("ano", String(ano));
    novo.delete("mes");
    for (const [k, v] of Object.entries(extras ?? {})) {
      if (v) novo.set(k, v);
      else novo.delete(k);
    }
    return `/financeiro/folha/${String(mes).padStart(2, "0")}?${novo.toString()}`;
  };
}

function SeletorComparativo({ competencia, importadas }: { competencia: string; importadas: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const href = useHrefCompetencia();
  const selecionadas = new Set((params.get("comparar") ?? "").split(",").filter(Boolean));
  const opcoes = importadas.filter((c) => c !== competencia).reverse();
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));

  function alternar(c: string) {
    const nova = new Set(selecionadas);
    if (nova.has(c)) nova.delete(c);
    else if (nova.size < 6) nova.add(c);
    router.push(href(ano, mes, { comparar: [...nova].sort().join(",") || null }));
  }

  return (
    <details className="relative">
      <summary className={cn(CLASSE_FILTRO, "cursor-pointer list-none")}>
        {selecionadas.size ? `${selecionadas.size} mês(es)` : "Nenhum período"}
      </summary>
      <div className="absolute right-0 z-30 mt-1 max-h-64 w-56 overflow-auto rounded-lg border border-border bg-surface p-2 shadow-lg">
        {opcoes.length === 0 ? <p className="p-1 text-xs text-muted-foreground">Nenhum outro mês importado.</p> : null}
        {opcoes.map((c) => (
          <label key={c} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-muted">
            <input type="checkbox" checked={selecionadas.has(c)} onChange={() => alternar(c)} />
            {competenciaExtenso(c)}
          </label>
        ))}
      </div>
    </details>
  );
}

/** Abas 01 · Janeiro … 12 · Dezembro; o ✓ marca mês com relatório importado. */
export function AbasMesesFolha({ competencia, importadas }: { competencia: string; importadas: string[] }) {
  const href = useHrefCompetencia();
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const feitas = new Set(importadas.map((c) => c.slice(0, 7)));

  return (
    <div className="border-b border-border">
      <nav aria-label="Meses da folha" className="-mb-px flex gap-1 overflow-x-auto">
        {MESES.map((nome, i) => {
          const m = i + 1;
          const mm = String(m).padStart(2, "0");
          const importado = feitas.has(`${ano}-${mm}`);
          const atual = m === mes;
          return (
            <Link
              key={nome}
              href={href(ano, m, { comparar: null })}
              aria-current={atual ? "page" : undefined}
              title={importado ? "Relatórios importados" : "Sem relatório importado"}
              className={cn(
                "flex items-center gap-1 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
                atual
                  ? "border-brand font-medium text-brand"
                  : importado
                    ? "border-transparent text-foreground hover:border-border"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span className="tabular">{mm}</span> · {nome}
              {importado ? <CheckCircle2 className="size-3.5 text-positive" aria-label="importado" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SeletorAno({ competencia, importadas }: { competencia: string; importadas: string[] }) {
  const router = useRouter();
  const href = useHrefCompetencia();
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const anos = [
    ...new Set([...importadas.map((c) => Number(c.slice(0, 4))), new Date().getFullYear(), ano]),
  ].sort();

  return (
    <select
      aria-label="Ano"
      value={ano}
      onChange={(e) => router.push(href(Number(e.target.value), mes, { comparar: null }))}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm tabular"
    >
      {anos.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

function BotaoAtualizar() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      onClick={() => iniciar(() => router.refresh())}
      disabled={pendente}
      className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
    >
      <RefreshCw className={cn("size-4", pendente && "animate-spin")} aria-hidden />
      Atualizar
    </button>
  );
}
