"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Save } from "lucide-react";

import { salvarColaboradorFolha } from "@/app/(app)/financeiro/folha/acoes";
import { ROTULO_GRUPO, type ColunaTabela, type GrupoColuna } from "@/components/folha/colunas-tabela";
import type { NivelAcessoFolha, UnidadeFolha } from "@/lib/dados-folha";
import {
  classificar,
  DEF_COLUNA,
  type ContextoCalculo,
  type GrupoUnidade,
  type LinhaAnalitica,
  type Totais,
} from "@/lib/folha-analitica";
import { cnpj as formatarCnpj, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const ESCALAS_PADRAO = ["6x1", "5x2", "12x36"];

/** Colunas que a primeira coluna fixa (colaborador) já mostra. */
const NA_PRIMEIRA = new Set(["matricula", "nome"]);

const CORES_GRUPO: Record<GrupoColuna, string> = {
  identificacao: "bg-surface-muted",
  proventos: "bg-positive-soft",
  descontos: "bg-negative-soft",
  totalizacao: "bg-brand-soft",
};

function Valor({ coluna, v }: { coluna: ColunaTabela; v: string | number | null }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "number") {
    if (coluna.tipo === "numero") return <>{v.toLocaleString("pt-BR")}</>;
    if (Math.abs(v) < 0.005) return <span className="text-muted-foreground/60">–</span>;
    return <>{moeda(v)}</>;
  }
  return <>{v}</>;
}

export function TabelaAnalitica({
  grupos,
  colunas,
  geral,
  unidades,
  nivel,
  ctx,
  podeEditar,
  empresaId,
  competencia,
  escalasConhecidas,
  setoresPorUnidade,
}: {
  grupos: GrupoUnidade[];
  colunas: ColunaTabela[];
  geral: Totais;
  unidades: UnidadeFolha[];
  nivel: NivelAcessoFolha;
  ctx: ContextoCalculo;
  podeEditar: boolean;
  empresaId: string;
  competencia: string;
  escalasConhecidas: string[];
  setoresPorUnidade: Map<string, { codigo: string; nome: string }[]>;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const semIndividuais = nivel === "agregado";
  const resto = colunas.filter((c) => !NA_PRIMEIRA.has(c.chave));
  const totalColunas = resto.length + 1;
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));

  // Faixas do cabeçalho de grupos (Identificação | Proventos | Descontos | Totalização)
  const faixas: { grupo: GrupoColuna; span: number }[] = [];
  for (const c of resto) {
    const ultima = faixas.at(-1);
    if (ultima?.grupo === c.grupo) ultima.span += 1;
    else faixas.push({ grupo: c.grupo, span: 1 });
  }

  const linhaTotal = (rotulo: string, t: Totais, estilo: string) => (
    <tr className={estilo}>
      <th
        scope="row"
        className={cn("sticky left-0 z-[1] border-b border-border px-3 py-1.5 text-left font-semibold whitespace-nowrap", estilo)}
      >
        {rotulo}
      </th>
      {resto.map((c) => (
        <td key={c.chave} className="border-b border-border px-2 py-1.5 text-right font-semibold tabular whitespace-nowrap">
          {c.total ? <Valor coluna={c} v={c.total(t)} /> : null}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="max-h-[70vh] overflow-auto rounded-b-xl">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 border-b border-border bg-surface px-3 py-1.5" />
            {faixas.map((f, i) => (
              <th
                key={`${f.grupo}-${i}`}
                colSpan={f.span}
                scope="colgroup"
                className={cn(
                  "border-b border-l border-border px-2 py-1.5 text-center text-[10px] font-semibold tracking-wide uppercase",
                  CORES_GRUPO[f.grupo],
                )}
              >
                {ROTULO_GRUPO[f.grupo]}
              </th>
            ))}
          </tr>
          <tr className="bg-surface text-[11px] text-muted-foreground">
            <th
              scope="col"
              className="sticky left-0 z-30 min-w-56 border-b border-border bg-surface px-3 py-2 text-left font-semibold"
            >
              {semIndividuais ? "Setor" : "Colaborador"}
            </th>
            {resto.map((c) => (
              <th
                key={c.chave}
                scope="col"
                title={c.ajuda}
                className={cn(
                  "border-b border-border px-2 py-2 font-semibold whitespace-nowrap",
                  c.tipo === "texto" ? "text-left" : "text-right",
                  c.destaque && "text-foreground",
                  c.ajuda && "cursor-help underline decoration-dotted underline-offset-2",
                )}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const u = g.unidadeId ? unidadePorId.get(g.unidadeId) : undefined;
            return (
              <Fragment key={g.unidadeId ?? "sem"}>
                <tr>
                  <td
                    colSpan={totalColunas}
                    className="border-b border-border bg-foreground px-3 py-1.5 text-[11px] font-semibold tracking-wide text-background uppercase"
                  >
                    <span className="sticky left-3">
                      {u?.nome ?? "Sem unidade"}
                      {u?.cnpj ? <span className="ml-2 font-normal opacity-75">CNPJ {formatarCnpj(u.cnpj)}</span> : null}
                      <span className="ml-2 font-normal opacity-75">
                        · {g.totais.funcionarios} funcionário{g.totais.funcionarios === 1 ? "" : "s"}
                      </span>
                    </span>
                  </td>
                </tr>
                {g.setores.map((s) => (
                  <Fragment key={s.nome}>
                    {!semIndividuais
                      ? s.linhas.map((l) => (
                          <LinhaFuncionario
                            key={l.f.id}
                            linha={l}
                            resto={resto}
                            aberto={aberto === l.f.id}
                            onAlternar={() => setAberto((a) => (a === l.f.id ? null : l.f.id))}
                            totalColunas={totalColunas}
                            ctx={ctx}
                            podeEditar={podeEditar}
                            empresaId={empresaId}
                            competencia={competencia}
                            escalasConhecidas={escalasConhecidas}
                            setores={setoresPorUnidade.get(l.f.unidadeId ?? "") ?? []}
                          />
                        ))
                      : null}
                    {linhaTotal(
                      `${semIndividuais ? "" : "Subtotal "}${s.nome} (${s.totais.funcionarios})`,
                      s.totais,
                      "bg-surface-muted",
                    )}
                  </Fragment>
                ))}
                {linhaTotal(`Total ${u?.nome ?? "sem unidade"}`, g.totais, "bg-surface-muted text-foreground [&>*]:border-b-2")}
              </Fragment>
            );
          })}
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={totalColunas} className="px-5 py-10 text-center text-muted-foreground">
                Nenhum funcionário no filtro.
              </td>
            </tr>
          ) : (
            linhaTotal(`Total consolidado (${geral.funcionarios})`, geral, "bg-brand-soft text-foreground")
          )}
        </tbody>
      </table>
    </div>
  );
}

function LinhaFuncionario({
  linha: l,
  resto,
  aberto,
  onAlternar,
  totalColunas,
  ctx,
  podeEditar,
  empresaId,
  competencia,
  escalasConhecidas,
  setores,
}: {
  linha: LinhaAnalitica;
  resto: ColunaTabela[];
  aberto: boolean;
  onAlternar: () => void;
  totalColunas: number;
  ctx: ContextoCalculo;
  podeEditar: boolean;
  empresaId: string;
  competencia: string;
  escalasConhecidas: string[];
  setores: { codigo: string; nome: string }[];
}) {
  return (
    <>
      <tr onClick={onAlternar} className={cn("group cursor-pointer", aberto && "bg-surface-muted")}>
        <th
          scope="row"
          className={cn(
            "sticky left-0 z-[1] border-b border-border px-3 py-1.5 text-left font-normal group-hover:bg-surface-muted",
            aberto ? "bg-surface-muted" : "bg-surface",
          )}
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={cn("size-3 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-90")}
              aria-hidden
            />
            <span className="w-10 shrink-0 text-muted-foreground tabular">{l.f.matricula}</span>
            <span className="max-w-56 truncate font-medium" title={l.f.nome}>
              {l.f.nome}
            </span>
          </span>
        </th>
        {resto.map((c) => (
          <td
            key={c.chave}
            className={cn(
              "border-b border-border px-2 py-1.5 whitespace-nowrap group-hover:bg-surface-muted",
              c.tipo === "texto" ? "text-left" : "text-right tabular",
              c.destaque && "font-semibold",
              c.grupo === "descontos" && c.tipo === "moeda" && !c.destaque && "text-negative",
            )}
          >
            <Valor coluna={c} v={c.valor(l)} />
          </td>
        ))}
      </tr>
      {aberto ? (
        <tr>
          <td colSpan={totalColunas} className="border-b border-border bg-surface-muted/50 p-0">
            <div className="sticky left-0 max-w-[min(100vw-3rem,64rem)] px-5 py-3">
              <DetalheColaborador
                linha={l}
                ctx={ctx}
                podeEditar={podeEditar}
                empresaId={empresaId}
                competencia={competencia}
                escalasConhecidas={escalasConhecidas}
                setores={setores}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetalheColaborador({
  linha: l,
  ctx,
  podeEditar,
  empresaId,
  competencia,
  escalasConhecidas,
  setores,
}: {
  linha: LinhaAnalitica;
  ctx: ContextoCalculo;
  podeEditar: boolean;
  empresaId: string;
  competencia: string;
  escalasConhecidas: string[];
  setores: { codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [escala, setEscala] = useState(l.escala ?? "");
  const [jornada, setJornada] = useState(l.jornadaSemanal === null ? "" : String(l.jornadaSemanal));
  const [setor, setSetor] = useState(l.setorCodigo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const grupo = (tipo: "P" | "D") => l.f.rubricas.filter((r) => r.tipo === tipo);

  function salvar() {
    if (!l.f.unidadeId) return;
    setErro(null);
    setSalvo(false);
    const jornadaNum = jornada.trim() ? Number(jornada.replace(",", ".")) : null;
    iniciar(async () => {
      const r = await salvarColaboradorFolha(empresaId, {
        competencia,
        unidadeId: l.f.unidadeId,
        matricula: l.f.matricula,
        nome: l.f.nome,
        escala: escala.trim() || null,
        jornadaSemanal: jornadaNum !== null && Number.isFinite(jornadaNum) ? jornadaNum : null,
        // Só grava setor quando difere do que o relatório traz
        setor: setor && setor !== (l.f.departamento ?? "") ? setor : null,
      });
      if (!r.ok) setErro(r.erro);
      else {
        setSalvo(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        {(["P", "D"] as const).map((tipo) => (
          <table key={tipo} className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-muted-foreground uppercase">
                <th className="pb-1 text-left font-semibold" colSpan={4}>
                  {tipo === "P" ? "Proventos" : "Descontos"} do relatório
                </th>
              </tr>
            </thead>
            <tbody>
              {grupo(tipo).map((r, i) => {
                const cls = classificar(r, ctx.colunas);
                return (
                  <tr key={`${r.codigo}-${i}`}>
                    <td className="w-12 py-0.5 text-muted-foreground tabular">{r.codigo}</td>
                    <td className="py-0.5">
                      {r.descricao}
                      <span
                        className={cn(
                          "ml-1.5 rounded px-1 text-[10px]",
                          cls.origem === "nao_reconhecida"
                            ? "bg-warning-soft text-warning"
                            : "bg-surface-muted text-muted-foreground",
                        )}
                      >
                        {DEF_COLUNA.get(cls.coluna)?.rotulo}
                      </span>
                    </td>
                    <td className="py-0.5 pr-3 text-right text-muted-foreground tabular">{r.referencia}</td>
                    <td className={cn("py-0.5 text-right tabular", tipo === "D" && "text-negative")}>{moeda(r.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>

      {l.f.observacoes.length ? (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {l.f.observacoes.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Base de provisão {moeda(l.baseProvisao)} (salário-base + variáveis habituais) · Base INSS{" "}
        {moeda(l.f.baseInss + l.f.excedenteInss)} · Vínculo {l.f.vinculo ?? "—"} · Centro de custo{" "}
        {l.f.centroCusto ?? "—"}
      </p>

      {podeEditar && l.f.unidadeId ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <label className="space-y-1">
            <span className="block text-[11px] font-medium text-muted-foreground">Escala</span>
            <input
              list="escalas-folha"
              value={escala}
              onChange={(e) => setEscala(e.target.value)}
              placeholder="6x1, 5x2, 12x36…"
              className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-xs"
            />
            <datalist id="escalas-folha">
              {[...new Set([...ESCALAS_PADRAO, ...escalasConhecidas])].map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-medium text-muted-foreground">Jornada semanal (h)</span>
            <input
              inputMode="decimal"
              value={jornada}
              onChange={(e) => setJornada(e.target.value)}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-right text-xs tabular"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-medium text-muted-foreground">Setor</span>
            <select
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="w-48 rounded-md border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="">Sem setor</option>
              {setores.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nome}
                  {s.codigo === l.f.departamento ? " (relatório)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1 text-xs font-medium text-brand-foreground disabled:opacity-60"
          >
            <Save className="size-3.5" aria-hidden />
            {pendente ? "Salvando…" : "Salvar cadastro"}
          </button>
          {salvo ? <span className="text-xs text-positive">Salvo.</span> : null}
          {erro ? <span className="text-xs text-negative">{erro}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
