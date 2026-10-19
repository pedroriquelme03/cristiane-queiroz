"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ShoppingCart, Trash2, Upload } from "lucide-react";

import { GraficoColunas, GraficoRanking, type PontoVendas } from "@/components/vendas/graficos-vendas";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { Modal } from "@/components/ui/modal";
import { excluirRelatorioVendas, importarRelatorioVendas } from "@/app/(app)/financeiro/vendas/acoes";
import {
  ROTULO_RESUMO,
  lerRelatorioVendas,
  type ItemVendas,
  type RelatorioVendas,
  type ResumoVendas,
} from "@/lib/importacao/adaptadores/relatorio-vendas";
import { lerPdf } from "@/lib/importacao/pdf";
import { combinarResumo, origemSugerida, totaisPorMes, type RelatorioVendasSalvo } from "@/lib/vendas";
import { competenciaExtenso, data as formatarData, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TOP_PRODUTOS = 15;

const porValor = (a: ItemVendas, b: ItemVendas) => b.valor - a.valor;
const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function PainelVendas({
  empresaId,
  ano,
  mesInicial,
  anos,
  relatorios,
  podeEditar,
}: {
  empresaId: string;
  ano: number;
  mesInicial: number;
  anos: number[];
  relatorios: RelatorioVendasSalvo[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [mes, setMes] = useState(mesInicial);
  const [origem, setOrigem] = useState("");

  const origens = useMemo(() => [...new Set(relatorios.map((r) => r.origem))].sort(), [relatorios]);
  const doAno = useMemo(
    () => relatorios.filter((r) => !origem || r.origem === origem),
    [relatorios, origem],
  );
  const competencia = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const doMes = doAno.filter((r) => r.competencia === competencia);
  const mesesComDados = new Set(doAno.map((r) => Number(r.competencia.slice(5, 7))));

  const resumo = (tipo: ResumoVendas) => combinarResumo(doMes, tipo);
  const total = doMes.reduce((s, r) => s + r.totalValor, 0);
  const quantidade = doMes.reduce((s, r) => s + r.totalQuantidade, 0);
  const dias = resumo("data").sort((a, b) => a.nome.localeCompare(b.nome));
  const melhorDia = [...dias].sort(porValor)[0];
  const produtos = resumo("produto").sort(porValor);

  const trocarAno = (novo: number) => {
    const busca = new URLSearchParams(params.toString());
    busca.set("ano", String(novo));
    busca.delete("mes");
    router.push(`${pathname}?${busca.toString()}`);
  };

  const pontosDias: PontoVendas[] = dias.map((d) => {
    const dia = new Date(`${d.nome}T12:00:00`);
    return {
      rotulo: d.nome.slice(8, 10),
      titulo: `${formatarData(d.nome)} (${DIAS_SEMANA[dia.getDay()]})`,
      valor: d.valor,
      quantidade: d.quantidade,
    };
  });
  const ranking = (itens: ItemVendas[]): PontoVendas[] =>
    itens.map((i) => ({ rotulo: i.nome, titulo: i.nome, valor: i.valor, quantidade: i.quantidade }));

  return (
    <>
      <Card>
        <CardHeader
          titulo={`Vendas — ${competenciaExtenso(competencia)}`}
          descricao="Resumos do relatório de vendas do PDV: dia, departamento, produto, categoria, família e usuário."
          acao={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <select
                aria-label="Ano"
                value={ano}
                onChange={(e) => trocarAno(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm tabular"
              >
                {[...new Set([...anos, ano, new Date().getFullYear()])].sort().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {podeEditar ? (
                <ImportarRelatorio empresaId={empresaId} origens={origens} />
              ) : null}
            </div>
          }
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Origem
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              >
                <option value="">Todas</option>
                {origens.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <nav aria-label="Mês" className="flex flex-wrap gap-1">
            {MESES.map((rotulo, i) => {
              const m = i + 1;
              const tem = mesesComDados.has(m);
              return (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => setMes(m)}
                  aria-pressed={m === mes}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
                    m === mes
                      ? "border-brand bg-brand text-brand-foreground"
                      : tem
                        ? "border-border bg-surface hover:bg-surface-muted"
                        : "border-transparent text-muted-foreground hover:bg-surface-muted",
                  )}
                >
                  {rotulo}
                  {tem ? <CheckCircle2 className="size-3" aria-label="com relatório" /> : null}
                </button>
              );
            })}
          </nav>
        </CardBody>
      </Card>

      {doMes.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <ShoppingCart className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">
              Nenhum relatório de vendas{origem ? ` de ${origem}` : ""} em {competenciaExtenso(competencia)}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {podeEditar ? "Use “Importar relatório de vendas” e escolha o PDF do PDV." : "Peça para a consultoria importar o relatório."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi rotulo="Faturamento" valor={moeda(total)} nota={doMes.map((r) => r.origem).join(" + ")} />
            <Kpi rotulo="Itens vendidos" valor={qtd(quantidade)} nota={`${produtos.length} produtos e serviços`} />
            <Kpi rotulo="Valor médio por item" valor={moeda(quantidade ? total / quantidade : 0)} />
            <Kpi
              rotulo="Melhor dia"
              valor={melhorDia ? moeda(melhorDia.valor) : "—"}
              nota={melhorDia ? formatarData(melhorDia.nome) : undefined}
            />
          </div>

          <Card>
            <CardHeader titulo="Faturamento por dia" descricao="Passe o mouse para ver o valor e a quantidade de cada dia." />
            <CardBody>
              <GraficoColunas pontos={pontosDias} />
            </CardBody>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader titulo="Faturamento por departamento" />
              <CardBody>
                <GraficoRanking pontos={ranking(resumo("departamento").sort(porValor))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader titulo="Faturamento por usuário" descricao="Os 10 que mais lançaram vendas no mês." />
              <CardBody>
                <GraficoRanking pontos={ranking(resumo("usuario").sort(porValor).slice(0, 10))} />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              titulo={`Top ${Math.min(TOP_PRODUTOS, produtos.length)} produtos e serviços`}
              descricao="Por faturamento no mês. A lista completa está na tabela abaixo."
            />
            <CardBody>
              <GraficoRanking pontos={ranking(produtos.slice(0, TOP_PRODUTOS))} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo={`Faturamento mês a mês — ${ano}`} descricao={origem || "Todas as origens"} />
            <CardBody>
              <GraficoColunas
                altura={200}
                pontos={totaisPorMes(doAno).map((p) => ({
                  rotulo: MESES[p.mes - 1],
                  titulo: competenciaExtenso(`${ano}-${String(p.mes).padStart(2, "0")}-01`),
                  valor: p.valor,
                }))}
              />
            </CardBody>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <TabelaResumo titulo={ROTULO_RESUMO.categoria} itens={resumo("categoria")} total={total} />
            <TabelaResumo titulo={ROTULO_RESUMO.familia} itens={resumo("familia")} total={total} />
          </div>
          <TabelaResumo titulo="Todos os produtos e serviços" itens={produtos} total={total} busca />

          <Card>
            <CardHeader titulo="Relatórios importados no mês" />
            <CardBody className="px-0 py-0">
              <ul className="divide-y divide-border text-sm">
                {doMes.map((r) => (
                  <ItemRelatorio key={r.id} relatorio={r} empresaId={empresaId} podeEditar={podeEditar} />
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function TabelaResumo({
  titulo,
  itens,
  total,
  busca: comBusca,
}: {
  titulo: string;
  itens: ItemVendas[];
  total: number;
  busca?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const filtrados = [...itens]
    .sort(porValor)
    .filter((i) => !termo || i.nome.toLowerCase().includes(termo.toLowerCase()));

  return (
    <Card>
      <CardHeader
        titulo={titulo}
        descricao={`${itens.length} itens`}
        acao={
          comBusca ? (
            <input
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar…"
              aria-label={`Buscar em ${titulo}`}
              className="w-44 rounded-lg border border-border bg-surface px-3 py-1 text-sm"
            />
          ) : null
        }
      />
      <CardBody className="px-0 py-0">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="py-2 pr-3 pl-5 text-left font-semibold">Nome</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Qtde</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right font-semibold">% do mês</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => (
                <tr key={i.nome} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-3 pl-5">{i.nome}</td>
                  <td className="px-3 py-1.5 text-right tabular">{qtd(i.quantidade)}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular", i.valor < 0 && "text-negative")}>
                    {moeda(i.valor)}
                  </td>
                  <td className="py-1.5 pr-5 pl-3 text-right text-muted-foreground tabular">
                    {total ? `${((i.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Nada encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function ItemRelatorio({
  relatorio,
  empresaId,
  podeEditar,
}: {
  relatorio: RelatorioVendasSalvo;
  empresaId: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
      <div>
        <p className="font-medium">{relatorio.origem}</p>
        <p className="text-xs text-muted-foreground">
          {relatorio.arquivoNome} · {moeda(relatorio.totalValor)}
          {erro ? <span className="ml-2 text-negative">{erro}</span> : null}
        </p>
      </div>
      {podeEditar ? (
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (!window.confirm(`Excluir o relatório "${relatorio.origem}" deste mês?`)) return;
            iniciar(async () => {
              const r = await excluirRelatorioVendas(empresaId, relatorio.id);
              if (r.ok) router.refresh();
              else setErro(r.erro);
            });
          }}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative disabled:opacity-40"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Excluir
        </button>
      ) : null}
    </li>
  );
}

function ImportarRelatorio({
  empresaId,
  origens,
}: {
  empresaId: string;
  origens: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<{ relatorio: RelatorioVendas | null; arquivo: string } | null>(null);
  const [origem, setOrigem] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    try {
      if (!arquivo.name.toLowerCase().endsWith(".pdf")) throw new Error("Escolha o PDF do relatório de vendas.");
      const relatorio = lerRelatorioVendas(await lerPdf(arquivo));
      setPrevia({ relatorio, arquivo: arquivo.name });
      // Reaproveita a origem já usada quando o nome do arquivo bate com ela
      const sugerida = origemSugerida(arquivo.name);
      setOrigem(origens.find((o) => sugerida.toLowerCase().includes(o.toLowerCase())) ?? sugerida);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
      setPrevia({ relatorio: null, arquivo: arquivo.name });
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function gravar() {
    const relatorio = previa?.relatorio;
    if (!previa || !relatorio) return;
    const arquivo = previa.arquivo;
    iniciar(async () => {
      const resultado = await importarRelatorioVendas(empresaId, {
        arquivoNome: arquivo,
        origem,
        competencia: relatorio.competencia,
        periodo: relatorio.periodo,
        resumos: relatorio.resumos,
        totais: relatorio.totais,
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setPrevia(null);
      // O painel remonta com os dados novos; o mês importado vai pela URL
      const [anoImportado, mesImportado] = resultado.competencia.split("-").map(Number);
      const busca = new URLSearchParams(params.toString());
      busca.set("ano", String(anoImportado));
      busca.set("mes", String(mesImportado));
      router.push(`${pathname}?${busca.toString()}`);
      router.refresh();
    });
  }

  const relatorio = previa?.relatorio ?? null;
  const fechar = () => {
    if (pendente) return;
    setPrevia(null);
    setErro(null);
  };
  const totalProdutos = relatorio?.totais.produto;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={lendo}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
      >
        <Upload className="size-4" aria-hidden />
        {lendo ? "Lendo PDF…" : "Importar relatório de vendas"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => ler(e.target.files?.[0])}
      />

      <Modal aberto={Boolean(previa)} titulo="Conferir relatório de vendas" descricao={previa?.arquivo} onFechar={fechar}>
        <div className="space-y-4">
          {relatorio ? (
            <>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Origem (ponto de venda)</span>
                <input
                  type="text"
                  list="origens-vendas"
                  value={origem}
                  maxLength={80}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                />
                <datalist id="origens-vendas">
                  {origens.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
                <span className="block text-xs text-muted-foreground">
                  Ex.: Restaurante Ipê, Hospedagem. Reimportar o mesmo mês e origem substitui o anterior.
                </span>
              </label>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Mês</dt>
                <dd className="font-medium">
                  {relatorio.competencia ? competenciaExtenso(`${relatorio.competencia}-01`) : "—"}
                </dd>
                <dt className="text-muted-foreground">Faturamento</dt>
                <dd className="font-semibold tabular">{totalProdutos ? moeda(totalProdutos.valor) : "—"}</dd>
                <dt className="text-muted-foreground">Itens vendidos</dt>
                <dd className="tabular">{totalProdutos ? qtd(totalProdutos.quantidade) : "—"}</dd>
                {(Object.keys(ROTULO_RESUMO) as ResumoVendas[]).map((r) => (
                  <div key={r} className="contents">
                    <dt className="text-muted-foreground">{ROTULO_RESUMO[r]}</dt>
                    <dd className="tabular">{relatorio.resumos[r].length} itens</dd>
                  </div>
                ))}
              </dl>

              {relatorio.avisos.length ? (
                <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-4 text-warning" aria-hidden />
                    Conferência encontrou diferenças
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {relatorio.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-positive">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Os seis resumos fecham com o total impresso.
                </p>
              )}
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
            {relatorio ? (
              <button
                type="button"
                onClick={gravar}
                disabled={pendente || !origem.trim() || !relatorio.competencia}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
              >
                <Upload className="size-4" aria-hidden />
                {pendente ? "Gravando…" : "Importar"}
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
