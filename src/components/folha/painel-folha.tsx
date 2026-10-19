"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileText, RefreshCw, Upload, Users } from "lucide-react";

import { CustoDaFolha, ResumoPorRubrica, TabelaFuncionariosFolha } from "@/components/folha/secoes-folha";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Modal } from "@/components/ui/modal";
import {
  importarExtratoMensal,
  salvarConfigRubricaFolha,
  salvarManuaisFolha,
} from "@/app/(app)/financeiro/folha/acoes";
import {
  chaveRubrica,
  configDe,
  resumirRubricas,
  rotuloSetor,
  type ApuracaoFolha,
  type ConfigRubrica,
  type FuncionarioFolha,
  type ManuaisFolha,
} from "@/lib/folha";
import {
  lerExtratoMensal,
  type ExtratoMensal,
  type RubricaExtrato,
} from "@/lib/importacao/adaptadores/extrato-mensal";
import { lerPdf } from "@/lib/importacao/pdf";
import { competenciaExtenso, dataHora, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function PainelFolha({
  empresaId,
  competencia,
  competenciasImportadas,
  apuracao,
  funcionarios,
  configsIniciais,
  podeEditar,
}: {
  empresaId: string;
  competencia: string;
  competenciasImportadas: string[];
  apuracao: ApuracaoFolha | null;
  funcionarios: FuncionarioFolha[];
  configsIniciais: ConfigRubrica[];
  podeEditar: boolean;
}) {
  const [setor, setSetor] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [configs, setConfigs] = useState(
    () => new Map(configsIniciais.map((c) => [chaveRubrica(c), c])),
  );
  const [manuais, setManuais] = useState<ManuaisFolha>(apuracao?.manuais ?? {});
  const [aviso, setAviso] = useState<string | null>(null);

  const setores = useMemo(
    () =>
      [...new Set(funcionarios.map((f) => f.departamento ?? ""))].sort(
        (a, b) => Number(a) - Number(b),
      ),
    [funcionarios],
  );

  const filtrados = useMemo(
    () =>
      funcionarios.filter(
        (f) =>
          (!setor || (f.departamento ?? "") === setor) && (!funcionarioId || f.id === funcionarioId),
      ),
    [funcionarios, setor, funcionarioId],
  );
  const comFiltro = Boolean(setor || funcionarioId);

  // Sem filtro, vale o Resumo por Rubrica impresso no extrato (fonte oficial)
  const resumo = useMemo(
    () => (comFiltro || !apuracao ? resumirRubricas(filtrados) : apuracao.resumoRubricas),
    [comFiltro, apuracao, filtrados],
  );

  const situacoes = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const f of filtrados) contagem.set(f.situacao || "—", (contagem.get(f.situacao || "—") ?? 0) + 1);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  const soma = (campo: "proventos" | "descontos" | "liquido") =>
    filtrados.reduce((s, f) => s + f[campo], 0);

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
    const anterior = manuais;
    const novos = { ...manuais, [campo]: valor };
    setManuais(novos);
    const resultado = await salvarManuaisFolha(empresaId, { competencia, manuais: novos });
    if (!resultado.ok) {
      setManuais(anterior);
      setAviso(resultado.erro);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          titulo={`Apuração da Folha — ${competenciaExtenso(competencia)}`}
          descricao="Folha do mês por funcionário (proventos, descontos, líquido e bases), importada do Extrato Mensal."
          acao={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SeletorAno competencia={competencia} importadas={competenciasImportadas} />
              <BotaoAtualizar />
              {podeEditar ? (
                <ImportarExtrato
                  empresaId={empresaId}
                  competencia={competencia}
                  temApuracao={Boolean(apuracao)}
                />
              ) : null}
            </div>
          }
        />
        <CardBody className="space-y-4">
          {apuracao ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Setor</span>
                <select
                  value={setor}
                  onChange={(e) => {
                    setSetor(e.target.value);
                    setFuncionarioId("");
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                >
                  <option value="">Todos os setores</option>
                  {setores.map((s) => (
                    <option key={s} value={s}>
                      {rotuloSetor(s || null)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Funcionário</span>
                <select
                  value={funcionarioId}
                  onChange={(e) => setFuncionarioId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                >
                  <option value="">Todos os funcionários</option>
                  {funcionarios
                    .filter((f) => !setor || (f.departamento ?? "") === setor)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.matricula} · {f.nome}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {aviso ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-negative/20 bg-negative-soft px-4 py-3"
        >
          <p className="text-sm text-negative">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} className="text-xs font-medium text-negative">
            Fechar
          </button>
        </div>
      ) : null}

      {!apuracao ? (
        <Card>
          <CardBody className="py-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">
              Nenhum Extrato Mensal importado para {competenciaExtenso(competencia)}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {podeEditar
                ? "Use “Importar Extrato” acima e escolha o PDF da folha deste mês."
                : "Peça para a consultoria importar o extrato deste mês."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="-mt-2 text-xs text-muted-foreground">
            {apuracao.empresaRelatorio.nome} · {apuracao.arquivoNome} · atualizado em{" "}
            {dataHora(apuracao.atualizadoEm)}
          </p>

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
            configs={configs}
            competencia={competencia}
            podeEditar={podeEditar}
            onAlterar={alterarConfig}
          />

          <CustoDaFolha
            resumo={resumo}
            configs={configs}
            manuais={manuais}
            competencia={competencia}
            comFiltro={comFiltro}
            encargos={apuracao.encargos}
            podeEditar={podeEditar}
            onAlterarConfig={alterarConfig}
            onAlterarManual={alterarManual}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi rotulo="Funcionários" valor={String(filtrados.length)} />
            <Kpi rotulo="Proventos" valor={moeda(soma("proventos"))} tom="positivo" />
            <Kpi rotulo="Descontos" valor={moeda(soma("descontos"))} tom="negativo" />
            <Kpi
              rotulo="Líquido"
              valor={moeda(soma("liquido"))}
              nota={comFiltro ? undefined : `Extrato: ${moeda(apuracao.totais.liquido)}`}
            />
          </div>

          <TabelaFuncionariosFolha funcionarios={filtrados} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/** Rota da aba do mês, mantendo ?empresa= (admin) e trocando só o ano. */
function useHrefCompetencia() {
  const params = useSearchParams();
  return (ano: number, mes: number) => {
    const novo = new URLSearchParams(params.toString());
    novo.set("ano", String(ano));
    novo.delete("mes");
    return `/financeiro/folha/${String(mes).padStart(2, "0")}?${novo.toString()}`;
  };
}

/** Abas 01 · Janeiro … 12 · Dezembro; o ✓ marca mês com extrato importado. */
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
              href={href(ano, m)}
              aria-current={atual ? "page" : undefined}
              title={importado ? "Extrato importado" : "Sem extrato importado"}
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
      onChange={(e) => router.push(href(Number(e.target.value), mes))}
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

function ImportarExtrato({
  empresaId,
  competencia,
  temApuracao,
}: {
  empresaId: string;
  competencia: string;
  temApuracao: boolean;
}) {
  const nomeMes = MESES[Number(competencia.slice(5, 7)) - 1];
  const router = useRouter();
  const href = useHrefCompetencia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<{ extrato: ExtratoMensal | null; arquivo: string } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cnpjDiferente, setCnpjDiferente] = useState(false);
  const [pendente, iniciar] = useTransition();

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setCnpjDiferente(false);
    setLendo(true);
    try {
      if (!arquivo.name.toLowerCase().endsWith(".pdf")) throw new Error("Escolha o PDF do Extrato Mensal.");
      const extrato = lerExtratoMensal(await lerPdf(arquivo));
      setPrevia({ extrato, arquivo: arquivo.name });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
      setPrevia({ extrato: null, arquivo: arquivo.name });
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function gravar(confirmarCnpj: boolean) {
    const extrato = previa?.extrato;
    if (!previa || !extrato) return;
    const arquivo = previa.arquivo;
    iniciar(async () => {
      const resultado = await importarExtratoMensal(empresaId, {
        arquivoNome: arquivo,
        confirmarCnpj,
        empresa: extrato.empresa,
        competencia: extrato.competencia,
        totais: extrato.totais,
        encargos: extrato.encargos,
        situacoes: extrato.situacoes,
        resumoRubricas: extrato.resumoRubricas,
        // O CPF fica só no PDF: não vai para o servidor
        funcionarios: extrato.funcionarios.map((f) => ({ ...f, cpf: null })),
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        setCnpjDiferente(Boolean(resultado.cnpjDiferente));
        return;
      }
      setPrevia(null);
      const [ano, mes] = resultado.competencia.split("-").map(Number);
      router.push(href(ano, mes));
      router.refresh();
    });
  }

  const extrato = previa?.extrato ?? null;
  const fechar = () => {
    if (pendente) return;
    setPrevia(null);
    setErro(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
      >
        <Upload className="size-4" aria-hidden />
        {lendo ? "Lendo PDF…" : `Importar Extrato de ${nomeMes}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => ler(e.target.files?.[0])}
      />

      <Modal
        aberto={Boolean(previa)}
        titulo="Conferir Extrato Mensal"
        descricao={previa?.arquivo}
        onFechar={fechar}
        className="max-w-xl"
      >
        <div className="space-y-4">
          {extrato ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Empresa</dt>
                <dd className="font-medium">
                  {extrato.empresa.nome}
                  <span className="block text-xs font-normal text-muted-foreground">
                    CNPJ {extrato.empresa.cnpj ?? "—"}
                  </span>
                </dd>
                <dt className="text-muted-foreground">Competência</dt>
                <dd className="font-medium">{competenciaExtenso(`${extrato.competencia}-01`)}</dd>
                <dt className="text-muted-foreground">Funcionários</dt>
                <dd className="tabular">{extrato.funcionarios.length}</dd>
                <dt className="text-muted-foreground">Rubricas no resumo</dt>
                <dd className="tabular">{extrato.resumoRubricas.length}</dd>
                <dt className="text-muted-foreground">Proventos</dt>
                <dd className="tabular text-positive">{moeda(extrato.totais.proventos)}</dd>
                <dt className="text-muted-foreground">Descontos</dt>
                <dd className="tabular text-negative">{moeda(extrato.totais.descontos)}</dd>
                <dt className="text-muted-foreground">Líquido</dt>
                <dd className="tabular font-semibold">{moeda(extrato.totais.liquido)}</dd>
              </dl>

              {extrato.avisos.length ? (
                <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-4 text-warning" aria-hidden />
                    Conferência encontrou diferenças
                  </p>
                  <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                    {extrato.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-positive">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Totais por funcionário, resumo por rubrica e totais gerais conferem.
                </p>
              )}

              {`${extrato.competencia}-01` !== competencia ? (
                <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
                  Este extrato é de <strong>{competenciaExtenso(`${extrato.competencia}-01`)}</strong>, não
                  de {competenciaExtenso(competencia)}. Ele será gravado na aba do mês dele.
                </p>
              ) : null}
              {temApuracao && `${extrato.competencia}-01` === competencia ? (
                <p className="text-xs text-muted-foreground">
                  Este mês já tem apuração: ela será substituída. Os valores de FGTS
                  digitados são mantidos.
                </p>
              ) : !temApuracao ? (
                <p className="text-xs text-muted-foreground">
                  Se o mês do extrato já tiver apuração, ela será substituída (o FGTS digitado é mantido).
                </p>
              ) : null}
            </>
          ) : null}

          {erro ? (
            <p role="alert" className="text-sm text-negative">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={fechar}
              disabled={pendente}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            {extrato ? (
              <button
                type="button"
                onClick={() => gravar(cnpjDiferente)}
                disabled={pendente}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
              >
                <Upload className="size-4" aria-hidden />
                {pendente
                  ? "Gravando…"
                  : cnpjDiferente
                    ? "Importar mesmo assim"
                    : `Importar ${extrato.funcionarios.length} funcionários`}
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
