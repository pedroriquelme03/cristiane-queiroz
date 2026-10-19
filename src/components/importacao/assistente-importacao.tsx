"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import {
  excluirModeloImportacao,
  salvarModeloImportacao,
} from "@/app/(app)/financeiro/importar/acoes";
import {
  ESQUEMAS,
  aplicarRegrasDoTipo,
  sugerirMapeamento,
  validarLinha,
  type LinhaValidada,
  type TipoImportacao,
} from "@/lib/importacao/esquemas";
import {
  lerArquivo,
  montarPlanilha,
  type ArquivoBruto,
  type OpcoesLeitura,
  type PlanilhaLida,
} from "@/lib/importacao/leitor";
import {
  aplicarMapaDoModelo,
  assinaturaDe,
  detectarModelo,
  mapaParaConfig,
  type ModeloImportacao,
} from "@/lib/importacao/modelos";
import { data as formatarData, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

type Etapa = "arquivo" | "mapeamento" | "conferencia";

const ETAPAS: { chave: Etapa; rotulo: string }[] = [
  { chave: "arquivo", rotulo: "Arquivo" },
  { chave: "mapeamento", rotulo: "Colunas" },
  { chave: "conferencia", rotulo: "Conferência" },
];

/** Limite de linhas mostradas na conferência; a validação roda em todas. */
const MAX_PREVIEW = 50;

/** Linhas cruas mostradas para o usuário apontar onde está o cabeçalho. */
const LINHAS_TOPO = 12;

/** Monta a planilha e o mapeamento para um conjunto de opções e modelo. */
function prepararPlanilha(
  bruto: ArquivoBruto,
  opcoes: OpcoesLeitura,
  tipo: TipoImportacao,
  modelo: ModeloImportacao | null,
) {
  const planilha = montarPlanilha(bruto, opcoes);
  const campos = ESQUEMAS[tipo].campos;
  const sugestao = sugerirMapeamento(planilha.cabecalhos, campos);
  const mapa = modelo
    ? aplicarMapaDoModelo(planilha.cabecalhos, campos, sugestao, modelo.config)
    : sugestao;
  return { planilha, mapa };
}

const opcoesDoModelo = (modelo: ModeloImportacao): OpcoesLeitura => ({
  aba: modelo.config.aba,
  linhaCabecalho: modelo.config.linhaCabecalho,
  ignorarLinhasQueComecam: modelo.config.ignorarLinhasQueComecam,
});

export function AssistenteImportacao({
  empresaId,
  modelosIniciais,
  podeSalvarModelo,
}: {
  empresaId: string;
  modelosIniciais: ModeloImportacao[];
  podeSalvarModelo: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [tipo, setTipo] = useState<TipoImportacao>("lancamentos");
  const [bruto, setBruto] = useState<ArquivoBruto | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesLeitura>({});
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [mapa, setMapa] = useState<Record<string, number | null>>({});
  const [modelos, setModelos] = useState(modelosIniciais);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [modeloDetectado, setModeloDetectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const esquema = ESQUEMAS[tipo];
  const modelo = modelos.find((m) => m.id === modeloId) ?? null;

  async function receberArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const lido = await lerArquivo(arquivo);
      const detectado = detectarModelo(lido, modelos, tipo);
      const novasOpcoes = detectado ? opcoesDoModelo(detectado.modelo) : {};
      const preparado = prepararPlanilha(lido, novasOpcoes, tipo, detectado?.modelo ?? null);

      setBruto(lido);
      setOpcoes(novasOpcoes);
      setModeloId(detectado?.modelo.id ?? null);
      setModeloDetectado(Boolean(detectado));
      setPlanilha(preparado.planilha);
      setMapa(preparado.mapa);
      setNomeArquivo(arquivo.name);
      setEtapa("mapeamento");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
      setBruto(null);
      setPlanilha(null);
    } finally {
      setCarregando(false);
    }
  }

  /** Reaplica leitura e mapeamento; erros (ex.: linha vazia) ficam na tela. */
  function reprocessar(
    novasOpcoes: OpcoesLeitura,
    novoModelo: ModeloImportacao | null,
    novoTipo: TipoImportacao = tipo,
  ) {
    if (!bruto) return;
    try {
      const preparado = prepararPlanilha(bruto, novasOpcoes, novoTipo, novoModelo);
      setPlanilha(preparado.planilha);
      setMapa(preparado.mapa);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
    setOpcoes(novasOpcoes);
  }

  function escolherModelo(id: string | null) {
    const escolhido = modelos.find((m) => m.id === id) ?? null;
    setModeloId(escolhido?.id ?? null);
    setModeloDetectado(false);
    reprocessar(escolhido ? opcoesDoModelo(escolhido) : {}, escolhido);
  }

  // Revalida tudo sempre que o mapeamento muda
  const validadas = useMemo<LinhaValidada[]>(() => {
    if (!planilha) return [];
    return planilha.linhas.map((linha, i) =>
      aplicarRegrasDoTipo(
        tipo,
        validarLinha(linha, planilha.numeros[i], esquema.campos, mapa),
      ),
    );
  }, [planilha, mapa, esquema.campos, tipo]);

  const comErro = validadas.filter((l) => l.erros.length > 0);
  const validas = validadas.filter((l) => l.erros.length === 0);

  const obrigatoriosFaltando = esquema.campos.filter(
    (c) => c.obrigatorio && mapa[c.chave] == null,
  );

  function reiniciar() {
    setBruto(null);
    setPlanilha(null);
    setOpcoes({});
    setModeloId(null);
    setModeloDetectado(false);
    setNomeArquivo("");
    setMapa({});
    setErro(null);
    setEtapa("arquivo");
    if (inputRef.current) inputRef.current.value = "";
  }

  function trocarTipo(novo: TipoImportacao) {
    setTipo(novo);
    // Modelo é por tipo: o atual não vale para o outro
    if (modelo && modelo.tipo !== novo) {
      setModeloId(null);
      setModeloDetectado(false);
      reprocessar(opcoes, null, novo);
    } else {
      reprocessar(opcoes, modelo, novo);
    }
  }

  async function salvarModelo(nome: string, atualizar: boolean) {
    if (!planilha) return { ok: false as const, erro: "Nenhum arquivo carregado." };
    const resultado = await salvarModeloImportacao({
      empresaId,
      id: atualizar ? modelo?.id : undefined,
      tipo,
      nome,
      config: {
        aba: planilha.abas.length > 1 ? planilha.aba : null,
        linhaCabecalho: opcoes.linhaCabecalho ?? null,
        ignorarLinhasQueComecam: opcoes.ignorarLinhasQueComecam ?? [],
        mapa: mapaParaConfig(planilha.cabecalhos, mapa),
      },
      assinatura: assinaturaDe(planilha.cabecalhos),
    });
    if (resultado.ok) {
      setModelos((atual) =>
        [...atual.filter((m) => m.id !== resultado.modelo.id), resultado.modelo].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR"),
        ),
      );
      setModeloId(resultado.modelo.id);
      setModeloDetectado(false);
    }
    return resultado;
  }

  async function excluirModelo(id: string) {
    const resultado = await excluirModeloImportacao(empresaId, id);
    if (resultado.ok) {
      setModelos((atual) => atual.filter((m) => m.id !== id));
      if (modeloId === id) setModeloId(null);
    }
    return resultado;
  }

  return (
    <>
      <Passos atual={etapa} />

      {erro ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-negative/20 bg-negative-soft px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden />
          <p className="text-sm text-negative">{erro}</p>
        </div>
      ) : null}

      {etapa === "arquivo" ? (
        <EtapaArquivo
          tipo={tipo}
          onTrocarTipo={trocarTipo}
          onArquivo={receberArquivo}
          carregando={carregando}
          inputRef={inputRef}
        />
      ) : null}

      {etapa === "mapeamento" && planilha && bruto ? (
        <>
          <PainelLeitura
            bruto={bruto}
            planilha={planilha}
            opcoes={opcoes}
            modelos={modelos.filter((m) => m.tipo === tipo)}
            modelo={modelo}
            modeloDetectado={modeloDetectado}
            onModelo={escolherModelo}
            onOpcoes={(novas) => reprocessar(novas, modelo)}
          />
          <EtapaMapeamento
            esquema={esquema}
            planilha={planilha}
            nomeArquivo={nomeArquivo}
            mapa={mapa}
            onMapa={setMapa}
            obrigatoriosFaltando={obrigatoriosFaltando.map((c) => c.rotulo)}
            onVoltar={reiniciar}
            onAvancar={() => setEtapa("conferencia")}
            rodape={
              podeSalvarModelo ? (
                <SalvarModelo
                  modelo={modelo?.empresaId ? modelo : null}
                  nomeSugerido={modelo?.nome ?? nomeSemExtensao(nomeArquivo)}
                  onSalvar={salvarModelo}
                  onExcluir={excluirModelo}
                />
              ) : null
            }
          />
        </>
      ) : null}

      {etapa === "conferencia" && planilha ? (
        <EtapaConferencia
          tipo={tipo}
          esquema={esquema}
          validas={validas}
          comErro={comErro}
          total={validadas.length}
          nomeArquivo={nomeArquivo}
          onVoltar={() => setEtapa("mapeamento")}
        />
      ) : null}
    </>
  );
}

const nomeSemExtensao = (nome: string) => nome.replace(/\.[^.]+$/, "");

// ---------------------------------------------------------------------------

function Passos({ atual }: { atual: Etapa }) {
  const indiceAtual = ETAPAS.findIndex((e) => e.chave === atual);

  return (
    <ol className="flex items-center gap-2 text-sm">
      {ETAPAS.map((passo, i) => {
        const estado = i < indiceAtual ? "feito" : i === indiceAtual ? "atual" : "futuro";
        return (
          <li key={passo.chave} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-xs font-medium",
                estado === "feito" && "bg-positive-soft text-positive",
                estado === "atual" && "bg-brand text-brand-foreground",
                estado === "futuro" && "bg-surface-muted text-muted-foreground",
              )}
            >
              {estado === "feito" ? <CheckCircle2 className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                estado === "futuro" ? "text-muted-foreground" : "font-medium",
              )}
            >
              {passo.rotulo}
            </span>
            {i < ETAPAS.length - 1 ? (
              <span aria-hidden className="mx-1 h-px w-8 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function EtapaArquivo({
  tipo,
  onTrocarTipo,
  onArquivo,
  carregando,
  inputRef,
}: {
  tipo: TipoImportacao;
  onTrocarTipo: (t: TipoImportacao) => void;
  onArquivo: (a: File | undefined) => void;
  carregando: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [arrastando, setArrastando] = useState(false);

  return (
    <>
      <Card>
        <CardHeader
          titulo="O que você vai importar?"
          descricao="Isso define quais colunas o sistema vai procurar na planilha"
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {Object.values(ESQUEMAS).map((op) => (
            <button
              key={op.tipo}
              type="button"
              aria-pressed={tipo === op.tipo}
              onClick={() => onTrocarTipo(op.tipo)}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition-colors",
                tipo === op.tipo
                  ? "border-brand bg-brand-soft"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              <p className="text-sm font-medium">{op.rotulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{op.descricao}</p>
            </button>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Arquivo"
          descricao="Excel (.xlsx, .xls, .ods) ou CSV. Se o cabeçalho não estiver na primeira linha, você ajusta na próxima etapa."
        />
        <CardBody>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              onArquivo(e.dataTransfer.files[0]);
            }}
            className={cn(
              "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              arrastando ? "border-brand bg-brand-soft" : "border-border",
            )}
          >
            <FileSpreadsheet
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="mt-3 text-sm">
              Arraste a planilha aqui ou{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand underline underline-offset-2"
              >
                escolha um arquivo
              </button>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {carregando ? "Lendo a planilha…" : "Nada é enviado antes da sua conferência"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt"
              className="sr-only"
              onChange={(e) => onArquivo(e.target.files?.[0])}
            />
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function EtapaMapeamento({
  esquema,
  planilha,
  nomeArquivo,
  mapa,
  onMapa,
  obrigatoriosFaltando,
  onVoltar,
  onAvancar,
  rodape,
}: {
  esquema: (typeof ESQUEMAS)[TipoImportacao];
  planilha: PlanilhaLida;
  nomeArquivo: string;
  mapa: Record<string, number | null>;
  onMapa: (m: Record<string, number | null>) => void;
  obrigatoriosFaltando: string[];
  onVoltar: () => void;
  onAvancar: () => void;
  rodape?: React.ReactNode;
}) {
  const detectadas = Object.values(mapa).filter((v) => v !== null).length;

  return (
    <Card>
      <CardHeader
        titulo="Confira o mapeamento das colunas"
        descricao={`${nomeArquivo} · ${planilha.linhas.length} linhas · ${detectadas} de ${esquema.campos.length} colunas reconhecidas automaticamente`}
        acao={
          <button
            type="button"
            onClick={onVoltar}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Trocar arquivo
          </button>
        }
      />
      <CardBody className="space-y-4">
        {esquema.campos.map((campo) => {
          const indice = mapa[campo.chave];
          const exemplo =
            indice === null
              ? null
              : planilha.linhas
                  .slice(0, 5)
                  .map((l) => l[indice])
                  .find((v) => v != null && String(v).trim() !== "");

          return (
            <div
              key={campo.chave}
              className="grid items-center gap-3 sm:grid-cols-[14rem_1fr]"
            >
              <div>
                <label
                  htmlFor={`col-${campo.chave}`}
                  className="text-sm font-medium"
                >
                  {campo.rotulo}
                  {campo.obrigatorio ? (
                    <span className="ml-1 text-negative" aria-label="obrigatório">
                      *
                    </span>
                  ) : null}
                </label>
                {campo.ajuda ? (
                  <p className="text-xs text-muted-foreground">{campo.ajuda}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  id={`col-${campo.chave}`}
                  value={indice ?? ""}
                  onChange={(e) =>
                    onMapa({
                      ...mapa,
                      [campo.chave]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className={cn(
                    "min-w-52 rounded-lg border bg-surface px-3 py-1.5 text-sm",
                    campo.obrigatorio && indice === null
                      ? "border-negative"
                      : "border-border",
                  )}
                >
                  <option value="">— não importar —</option>
                  {planilha.cabecalhos.map((cabecalho, i) => (
                    <option key={i} value={i}>
                      {cabecalho}
                    </option>
                  ))}
                </select>

                {exemplo != null ? (
                  <span className="truncate text-xs text-muted-foreground">
                    ex.: {String(exemplo)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {obrigatoriosFaltando.length > 0 ? (
          <p role="alert" className="text-xs text-negative">
            Faltam colunas obrigatórias: {obrigatoriosFaltando.join(", ")}.
          </p>
        ) : null}

        {rodape}

        <div className="flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onAvancar}
            disabled={obrigatoriosFaltando.length > 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Conferir dados
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function EtapaConferencia({
  tipo,
  esquema,
  validas,
  comErro,
  total,
  nomeArquivo,
  onVoltar,
}: {
  tipo: TipoImportacao;
  esquema: (typeof ESQUEMAS)[TipoImportacao];
  validas: LinhaValidada[];
  comErro: LinhaValidada[];
  total: number;
  nomeArquivo: string;
  onVoltar: () => void;
}) {
  // Entradas e saídas nunca somam no mesmo número: um "total" misturando as
  // duas não significa nada. Em lançamentos mostramos o líquido e a abertura.
  const soma = (predicado: (l: LinhaValidada) => boolean) =>
    validas.reduce((s, l) => {
      const v = l.valores.valor;
      return s + (predicado(l) && typeof v === "number" ? v : 0);
    }, 0);

  const entradas = soma((l) => l.valores.tipo === "entrada");
  const saidas = soma((l) => l.valores.tipo === "saida");
  const somaTotal = soma(() => true);

  const campoData = tipo === "titulos" ? "vencimento" : "data";
  const datas = validas
    .map((l) => l.valores[campoData])
    .filter((d): d is string => typeof d === "string")
    .sort();

  const periodo = datas.length
    ? `De ${formatarData(datas[0])} a ${formatarData(datas[datas.length - 1])}`
    : undefined;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Linhas lidas" valor={String(total)} nota={nomeArquivo} />
        <Kpi
          rotulo="Prontas para importar"
          valor={String(validas.length)}
          tom={validas.length ? "positivo" : "neutro"}
          nota={periodo}
        />
        <Kpi
          rotulo="Com problema"
          valor={String(comErro.length)}
          tom={comErro.length ? "negativo" : "positivo"}
          nota={comErro.length ? "Serão ignoradas" : "Nenhuma inconsistência"}
        />
        {tipo === "lancamentos" ? (
          <Kpi
            rotulo="Resultado líquido"
            valor={moeda(entradas - saidas)}
            tom={entradas - saidas >= 0 ? "positivo" : "negativo"}
            nota={`${moeda(entradas)} de entrada · ${moeda(saidas)} de saída`}
          />
        ) : (
          <Kpi rotulo="Valor total" valor={moeda(somaTotal)} />
        )}
      </div>

      {comErro.length > 0 ? (
        <Card>
          <CardHeader
            titulo="Linhas com problema"
            descricao="Corrija na planilha e importe de novo, ou siga sem elas"
          />
          <CardBody className="px-0 py-0">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2 text-left font-medium">
                      Linha
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Problema
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comErro.slice(0, MAX_PREVIEW).map((linha) => (
                    <tr key={linha.numero} className="border-b border-border last:border-0">
                      <td className="tabular px-5 py-2 align-top">{linha.numero}</td>
                      <td className="px-3 py-2">
                        <ul className="space-y-0.5">
                          {linha.erros.map((e, i) => (
                            <li key={i} className="text-negative">
                              {e.mensagem}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titulo="Prévia dos dados"
          descricao={
            validas.length > MAX_PREVIEW
              ? `Primeiras ${MAX_PREVIEW} de ${validas.length} linhas válidas`
              : `${validas.length} linhas válidas`
          }
        />
        <CardBody className="px-0 py-0">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {esquema.campos.map((campo) => (
                    <th
                      key={campo.chave}
                      scope="col"
                      className="px-3 py-2 text-left font-medium whitespace-nowrap first:pl-5 last:pr-5"
                    >
                      {campo.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validas.slice(0, MAX_PREVIEW).map((linha) => (
                  <tr key={linha.numero} className="border-b border-border last:border-0">
                    {esquema.campos.map((campo) => {
                      const valor = linha.valores[campo.chave];
                      return (
                        <td
                          key={campo.chave}
                          className="px-3 py-2 whitespace-nowrap first:pl-5 last:pr-5"
                        >
                          {valor == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : campo.tipo === "data" ? (
                            <span className="tabular">{formatarData(String(valor))}</span>
                          ) : campo.tipo === "valor" ? (
                            <span className="tabular">{moeda(Number(valor))}</span>
                          ) : campo.tipo === "opcao" ? (
                            <Badge
                              tom={
                                valor === "entrada" || valor === "receber"
                                  ? "positivo"
                                  : "negativo"
                              }
                            >
                              {campo.opcoes?.find((o) => o.valor === valor)?.rotulo ??
                                String(valor)}
                            </Badge>
                          ) : (
                            String(valor)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onVoltar}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Revisar colunas
          </button>

          <div className="flex items-center gap-3">
            <p className="max-w-md text-right text-xs text-muted-foreground">
              A gravação depende do banco, que ainda não foi provisionado. Assim que
              o Supabase estiver ligado, este botão grava as {validas.length} linhas
              válidas e registra a importação para permitir desfazer.
            </p>
            <button
              type="button"
              disabled
              title="Requer o banco de dados provisionado"
              className="flex shrink-0 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="size-4" aria-hidden />
              Importar {validas.length} linhas
            </button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function PainelLeitura({
  bruto,
  planilha,
  opcoes,
  modelos,
  modelo,
  modeloDetectado,
  onModelo,
  onOpcoes,
}: {
  bruto: ArquivoBruto;
  planilha: PlanilhaLida;
  opcoes: OpcoesLeitura;
  modelos: ModeloImportacao[];
  modelo: ModeloImportacao | null;
  modeloDetectado: boolean;
  onModelo: (id: string | null) => void;
  onOpcoes: (o: OpcoesLeitura) => void;
}) {
  const aba = bruto.abas.find((a) => a.nome === planilha.aba) ?? bruto.abas[0];
  const topo = aba.matriz.slice(0, LINHAS_TOPO);
  const largura = Math.min(
    8,
    Math.max(1, ...topo.map((l) => l.length)),
  );
  const [ignorarTexto, setIgnorarTexto] = useState(
    (opcoes.ignorarLinhasQueComecam ?? []).join(", "),
  );

  // Ao trocar de modelo as opções mudam por fora; o campo de texto acompanha
  const ignorarAtual = (opcoes.ignorarLinhasQueComecam ?? []).join(", ");
  const [ultimoIgnorar, setUltimoIgnorar] = useState(ignorarAtual);
  if (ignorarAtual !== ultimoIgnorar) {
    setUltimoIgnorar(ignorarAtual);
    setIgnorarTexto(ignorarAtual);
  }

  const aplicarIgnorar = () => {
    const lista = ignorarTexto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onOpcoes({ ...opcoes, ignorarLinhasQueComecam: lista });
  };

  return (
    <Card>
      <CardHeader
        titulo="Leitura do relatório"
        descricao="Modelo salvo, aba, linha do cabeçalho e linhas a descartar"
      />
      <CardBody className="space-y-4">
        {modelo && modeloDetectado ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-4 py-3">
            <BookmarkCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
            <p className="text-sm">
              Reconhecemos este relatório: modelo <strong>{modelo.nome}</strong> aplicado.
              Confira as colunas abaixo.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="modelo-importacao" className="text-sm font-medium">
              Modelo
            </label>
            <select
              id="modelo-importacao"
              value={modelo?.id ?? ""}
              onChange={(e) => onModelo(e.target.value || null)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            >
              <option value="">Nenhum (detectar colunas)</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                  {m.empresaId ? "" : " (padrão)"}
                </option>
              ))}
            </select>
          </div>

          {bruto.abas.length > 1 ? (
            <div className="space-y-1">
              <label htmlFor="aba-importacao" className="text-sm font-medium">
                Aba
              </label>
              <select
                id="aba-importacao"
                value={planilha.aba}
                // A linha do cabeçalho de uma aba não vale para outra
                onChange={(e) => onOpcoes({ ...opcoes, aba: e.target.value, linhaCabecalho: null })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              >
                {bruto.abas.map((a) => (
                  <option key={a.nome} value={a.nome}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="linha-cabecalho" className="text-sm font-medium">
              Linha do cabeçalho
            </label>
            <input
              id="linha-cabecalho"
              type="number"
              min={1}
              inputMode="numeric"
              value={opcoes.linhaCabecalho ?? ""}
              placeholder={`Automático (${planilha.linhaCabecalho})`}
              onChange={(e) => {
                const n = Number(e.target.value);
                onOpcoes({
                  ...opcoes,
                  linhaCabecalho: e.target.value && n >= 1 ? Math.floor(n) : null,
                });
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm tabular"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ignorar-linhas" className="text-sm font-medium">
              Ignorar linhas que começam com
            </label>
            <input
              id="ignorar-linhas"
              type="text"
              value={ignorarTexto}
              placeholder="Total, Subtotal, Saldo anterior"
              onChange={(e) => setIgnorarTexto(e.target.value)}
              onBlur={aplicarIgnorar}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarIgnorar();
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Separe por vírgula.
              {planilha.ignoradas > 0
                ? ` ${planilha.ignoradas} linha(s) descartada(s).`
                : ""}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">
            Início da aba: clique na linha que contém os nomes das colunas.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <tbody>
                {topo.map((linha, i) => {
                  const numero = aba.primeiraLinha + i;
                  const ehCabecalho = numero === planilha.linhaCabecalho;
                  return (
                    <tr
                      key={numero}
                      onClick={() => onOpcoes({ ...opcoes, linhaCabecalho: numero })}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-0",
                        ehCabecalho ? "bg-brand-soft font-medium" : "hover:bg-surface-muted",
                      )}
                    >
                      <th
                        scope="row"
                        className="w-10 px-2 py-1 text-right font-normal tabular text-muted-foreground"
                      >
                        {numero}
                      </th>
                      {Array.from({ length: largura }, (_, c) => (
                        <td key={c} className="max-w-40 truncate px-2 py-1 whitespace-nowrap">
                          {linha[c] == null ? "" : String(linha[c])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function SalvarModelo({
  modelo,
  nomeSugerido,
  onSalvar,
  onExcluir,
}: {
  /** Modelo da própria empresa em uso (globais não são editáveis aqui). */
  modelo: ModeloImportacao | null;
  nomeSugerido: string;
  onSalvar: (nome: string, atualizar: boolean) => Promise<{ ok: boolean; erro?: string }>;
  onExcluir: (id: string) => Promise<{ ok: boolean; erro?: string }>;
}) {
  const [nome, setNome] = useState(nomeSugerido);
  // Trocar de modelo no seletor traz o nome dele para o campo
  const [ultimoSugerido, setUltimoSugerido] = useState(nomeSugerido);
  if (nomeSugerido !== ultimoSugerido) {
    setUltimoSugerido(nomeSugerido);
    setNome(nomeSugerido);
  }
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) =>
    iniciar(async () => {
      const resultado = await acao();
      setMensagem(
        resultado.ok
          ? { tom: "ok", texto: sucesso }
          : { tom: "erro", texto: resultado.erro ?? "Algo deu errado." },
      );
    });

  const atualizar = Boolean(modelo) && nome.trim() === modelo?.nome;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm font-medium">Salvar como modelo desta empresa</p>
      <p className="text-xs text-muted-foreground">
        Na próxima importação deste relatório, aba, cabeçalho, linhas ignoradas e colunas
        já vêm prontos.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label="Nome do modelo"
          value={nome}
          maxLength={80}
          onChange={(e) => setNome(e.target.value)}
          className="min-w-60 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm sm:flex-none"
        />
        <button
          type="button"
          disabled={pendente || !nome.trim()}
          onClick={() =>
            executar(
              () => onSalvar(nome.trim(), atualizar),
              atualizar ? "Modelo atualizado." : "Modelo salvo.",
            )
          }
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pendente ? "Salvando…" : atualizar ? "Atualizar modelo" : "Salvar modelo"}
        </button>
        {modelo ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() => {
              if (!window.confirm(`Excluir o modelo "${modelo.nome}"?`)) return;
              executar(() => onExcluir(modelo.id), "Modelo excluído.");
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-negative disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Excluir modelo
          </button>
        ) : null}
      </div>
      {mensagem ? (
        <p
          role={mensagem.tom === "erro" ? "alert" : "status"}
          className={cn("text-xs", mensagem.tom === "erro" ? "text-negative" : "text-positive")}
        >
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}
