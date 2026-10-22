"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Upload, XCircle } from "lucide-react";

import { importarRelatoriosFolha, type ResultadoRelatorio } from "@/app/(app)/financeiro/folha/acoes";
import { Modal } from "@/components/ui/modal";
import type { UnidadeFolha } from "@/lib/dados-folha";
import { lerExtratoMensal, type ExtratoMensal } from "@/lib/importacao/adaptadores/extrato-mensal";
import { normalizar } from "@/lib/importacao/parsers";
import { lerPdf } from "@/lib/importacao/pdf";
import { cnpj as formatarCnpj, competenciaExtenso, moeda } from "@/lib/format";

interface ArquivoLido {
  nome: string;
  extrato: ExtratoMensal | null;
  erro: string | null;
  /** id da unidade, "nova" para criar a partir do relatório, "" para escolher */
  unidade: string;
  nomeNova: string;
  confirmarCnpj: boolean;
  resultado?: ResultadoRelatorio;
}

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** "RESTAURANTE IPE FOZ LTDA" → "Restaurante Ipe Foz" (nome sugerido para a unidade nova). */
function nomeSugerido(razao: string) {
  return razao
    .replace(/\b(LTDA|EIRELI|ME|EPP|S\/?A)\b\.?/gi, "")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

function unidadeDoRelatorio(extrato: ExtratoMensal, unidades: UnidadeFolha[]): string {
  const cnpj = digitos(extrato.empresa.cnpj);
  const porCnpj = cnpj ? unidades.find((u) => u.cnpj === cnpj) : undefined;
  if (porCnpj) return porCnpj.id;
  const nome = normalizar(nomeSugerido(extrato.empresa.nome));
  const porNome = unidades.find((u) => !u.cnpj && normalizar(u.nome) === nome);
  return porNome?.id ?? (unidades.length ? "" : "nova");
}

export function ImportarRelatorios({
  empresaId,
  competencia,
  unidades,
  temApuracao,
}: {
  empresaId: string;
  competencia: string;
  unidades: UnidadeFolha[];
  temApuracao: (unidadeId: string) => boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoLido[]>([]);
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function ler(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null);
    setLendo(true);
    const lidos: ArquivoLido[] = [];
    for (const arquivo of Array.from(lista)) {
      try {
        if (!arquivo.name.toLowerCase().endsWith(".pdf")) throw new Error("Não é PDF.");
        const extrato = lerExtratoMensal(await lerPdf(arquivo));
        lidos.push({
          nome: arquivo.name,
          extrato,
          erro: null,
          unidade: unidadeDoRelatorio(extrato, unidades),
          nomeNova: nomeSugerido(extrato.empresa.nome),
          confirmarCnpj: false,
        });
      } catch (e) {
        lidos.push({
          nome: arquivo.name,
          extrato: null,
          erro: e instanceof Error ? e.message : "Não foi possível ler o PDF.",
          unidade: "",
          nomeNova: "",
          confirmarCnpj: false,
        });
      }
    }
    setArquivos(lidos);
    setAberto(true);
    setLendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validos = arquivos.filter((a) => a.extrato);
  // A importação vai para a competência dos relatórios (todos precisam ser do mesmo mês)
  const competencias = [...new Set(validos.map((a) => a.extrato!.competencia))];
  const competenciaImportacao = competencias.length === 1 ? `${competencias[0]}-01` : null;

  const atualizar = (i: number, mudanca: Partial<ArquivoLido>) =>
    setArquivos((lista) => lista.map((a, j) => (j === i ? { ...a, ...mudanca } : a)));

  function gravar() {
    if (!competenciaImportacao) return;
    const enviar = arquivos.filter((a) => a.extrato && !a.resultado?.ok);
    iniciar(async () => {
      setErro(null);
      const r = await importarRelatoriosFolha(empresaId, {
        competencia: competenciaImportacao,
        relatorios: enviar.map((a) => {
          const e = a.extrato!;
          return {
            arquivoNome: a.nome,
            unidadeId: a.unidade && a.unidade !== "nova" ? a.unidade : null,
            criarUnidade: a.unidade === "nova" ? a.nomeNova.trim() || null : null,
            confirmarCnpj: a.confirmarCnpj,
            empresa: e.empresa,
            competencia: e.competencia,
            totais: e.totais,
            encargos: e.encargos,
            situacoes: e.situacoes,
            resumoRubricas: e.resumoRubricas,
            avisos: e.avisos,
            funcionarios: e.funcionarios,
          };
        }),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setArquivos((lista) =>
        lista.map((a) => ({ ...a, resultado: r.resultados.find((x) => x.arquivoNome === a.nome) ?? a.resultado })),
      );
      if (r.resultados.every((x) => x.ok)) {
        setAberto(false);
        setArquivos([]);
        const [ano, mes] = competenciaImportacao.split("-");
        const novo = new URLSearchParams(params.toString());
        novo.set("ano", ano);
        novo.delete("comparar");
        router.push(`/financeiro/folha/${mes}?${novo.toString()}`);
      }
      router.refresh();
    });
  }

  const prontos = validos.filter((a) => !a.resultado?.ok);
  const podeGravar =
    Boolean(competenciaImportacao) &&
    prontos.length > 0 &&
    prontos.every((a) => (a.unidade === "nova" ? a.nomeNova.trim() : a.unidade));

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
      >
        <Upload className="size-4" aria-hidden />
        {lendo ? "Lendo PDFs…" : "Importar relatórios"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => ler(e.target.files)}
      />

      <Modal
        aberto={aberto}
        titulo="Importar relatórios da folha"
        descricao="Um Extrato Mensal por unidade (CNPJ). A unidade é identificada pelo CNPJ do relatório."
        onFechar={() => !pendente && setAberto(false)}
        className="max-w-3xl"
      >
        <div className="max-h-[70dvh] space-y-4 overflow-auto">
          {competencias.length > 1 ? (
            <p className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-xs text-negative">
              Os relatórios são de meses diferentes ({competencias.join(", ")}). Importe uma competência por vez.
            </p>
          ) : competenciaImportacao && competenciaImportacao !== competencia ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
              Os relatórios são de <strong>{competenciaExtenso(competenciaImportacao)}</strong>; serão gravados nessa
              competência (você está vendo {competenciaExtenso(competencia)}).
            </p>
          ) : null}

          {arquivos.map((a, i) => {
            const e = a.extrato;
            const unidadeEscolhida = unidades.find((u) => u.id === a.unidade);
            const cnpjRel = digitos(e?.empresa.cnpj);
            const cnpjDiverge = Boolean(unidadeEscolhida?.cnpj && cnpjRel && unidadeEscolhida.cnpj !== cnpjRel);
            return (
              <div key={`${a.nome}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{a.nome}</span>
                  </p>
                  {a.resultado ? (
                    a.resultado.ok ? (
                      <CheckCircle2 className="size-4 shrink-0 text-positive" aria-label="importado" />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-negative" aria-label="falhou" />
                    )
                  ) : null}
                </div>

                {e ? (
                  <>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Empresa no relatório</dt>
                        <dd className="font-medium">
                          {e.empresa.nome}
                          <span className="block font-normal text-muted-foreground">
                            CNPJ {e.empresa.cnpj ?? "não informado"} · {competenciaExtenso(`${e.competencia}-01`)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Funcionários</dt>
                        <dd className="tabular">{e.funcionarios.length}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Líquido</dt>
                        <dd className="font-medium tabular">{moeda(e.totais.liquido)}</dd>
                      </div>
                    </dl>

                    {!a.resultado?.ok ? (
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <label className="space-y-1">
                          <span className="block text-[11px] font-medium text-muted-foreground">Unidade</span>
                          <select
                            value={a.unidade}
                            onChange={(ev) => atualizar(i, { unidade: ev.target.value, confirmarCnpj: false })}
                            className="w-64 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                          >
                            <option value="">Escolha a unidade…</option>
                            {unidades.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nome}
                                {u.cnpj ? ` — ${formatarCnpj(u.cnpj)}` : " — sem CNPJ"}
                              </option>
                            ))}
                            <option value="nova">+ Criar unidade com este CNPJ</option>
                          </select>
                        </label>
                        {a.unidade === "nova" ? (
                          <label className="space-y-1">
                            <span className="block text-[11px] font-medium text-muted-foreground">Nome da unidade</span>
                            <input
                              value={a.nomeNova}
                              onChange={(ev) => atualizar(i, { nomeNova: ev.target.value })}
                              className="w-56 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}

                    {unidadeEscolhida && temApuracao(unidadeEscolhida.id) && competenciaImportacao === competencia && !a.resultado?.ok ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {unidadeEscolhida.nome} já tem relatório neste mês: será substituído. A versão anterior fica no
                        histórico e os funcionários não são duplicados.
                      </p>
                    ) : null}
                    {cnpjDiverge && !a.resultado?.ok ? (
                      <label className="mt-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={a.confirmarCnpj}
                          onChange={(ev) => atualizar(i, { confirmarCnpj: ev.target.checked })}
                          className="mt-0.5"
                        />
                        <span>
                          O CNPJ do relatório difere do cadastro de {unidadeEscolhida?.nome}. Marque para importar mesmo
                          assim (a conferência vai apontar a divergência).
                        </span>
                      </label>
                    ) : null}
                    {e.avisos.length ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {e.avisos.length} diferença(s) na leitura — aparecem na conferência.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-negative">{a.erro}</p>
                )}

                {a.resultado ? (
                  <p className={`mt-2 text-xs ${a.resultado.ok ? "text-positive" : "text-negative"}`}>
                    {a.resultado.mensagem}
                  </p>
                ) : null}
              </div>
            );
          })}

          {erro ? (
            <p role="alert" className="text-sm text-negative">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setAberto(false)}
              disabled={pendente}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={gravar}
              disabled={pendente || !podeGravar}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden />
              {pendente
                ? "Gravando…"
                : `Importar ${prontos.length} relatório${prontos.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
