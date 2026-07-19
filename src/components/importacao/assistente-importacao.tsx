"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import {
  ESQUEMAS,
  aplicarRegrasDoTipo,
  sugerirMapeamento,
  validarLinha,
  type LinhaValidada,
  type TipoImportacao,
} from "@/lib/importacao/esquemas";
import { lerArquivo, type PlanilhaLida } from "@/lib/importacao/leitor";
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

export function AssistenteImportacao() {
  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [tipo, setTipo] = useState<TipoImportacao>("lancamentos");
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [mapa, setMapa] = useState<Record<string, number | null>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const esquema = ESQUEMAS[tipo];

  async function receberArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const lida = await lerArquivo(arquivo);
      setPlanilha(lida);
      setNomeArquivo(arquivo.name);
      setMapa(sugerirMapeamento(lida.cabecalhos, esquema.campos));
      setEtapa("mapeamento");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
      setPlanilha(null);
    } finally {
      setCarregando(false);
    }
  }

  // Revalida tudo sempre que o mapeamento muda
  const validadas = useMemo<LinhaValidada[]>(() => {
    if (!planilha) return [];
    return planilha.linhas.map((linha, i) =>
      aplicarRegrasDoTipo(tipo, validarLinha(linha, i + 2, esquema.campos, mapa)),
    );
  }, [planilha, mapa, esquema.campos, tipo]);

  const comErro = validadas.filter((l) => l.erros.length > 0);
  const validas = validadas.filter((l) => l.erros.length === 0);

  const obrigatoriosFaltando = esquema.campos.filter(
    (c) => c.obrigatorio && mapa[c.chave] == null,
  );

  function reiniciar() {
    setPlanilha(null);
    setNomeArquivo("");
    setMapa({});
    setErro(null);
    setEtapa("arquivo");
    if (inputRef.current) inputRef.current.value = "";
  }

  function trocarTipo(novo: TipoImportacao) {
    setTipo(novo);
    if (planilha) {
      setMapa(sugerirMapeamento(planilha.cabecalhos, ESQUEMAS[novo].campos));
    }
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

      {etapa === "mapeamento" && planilha ? (
        <EtapaMapeamento
          esquema={esquema}
          planilha={planilha}
          nomeArquivo={nomeArquivo}
          mapa={mapa}
          onMapa={setMapa}
          obrigatoriosFaltando={obrigatoriosFaltando.map((c) => c.rotulo)}
          onVoltar={reiniciar}
          onAvancar={() => setEtapa("conferencia")}
        />
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
          descricao="Excel (.xlsx, .xls, .ods) ou CSV. A primeira linha deve ser o cabeçalho."
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
}: {
  esquema: (typeof ESQUEMAS)[TipoImportacao];
  planilha: PlanilhaLida;
  nomeArquivo: string;
  mapa: Record<string, number | null>;
  onMapa: (m: Record<string, number | null>) => void;
  obrigatoriosFaltando: string[];
  onVoltar: () => void;
  onAvancar: () => void;
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
