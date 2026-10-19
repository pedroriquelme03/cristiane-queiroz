"use client";

import { Fragment, useState } from "react";
import { Calculator, ChevronRight, Minus, Plus } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  ROTULO_CATEGORIA,
  calcularCusto,
  configDe,
  rotuloSetor,
  totalFolha,
  type CategoriaCusto,
  type ConfigRubrica,
  type FuncionarioFolha,
  type ManuaisFolha,
} from "@/lib/folha";
import type { RubricaExtrato } from "@/lib/importacao/adaptadores/extrato-mensal";
import { competenciaExtenso, moeda } from "@/lib/format";
import { cn } from "@/lib/utils";

type AlterarConfig = (r: RubricaExtrato, mudanca: Partial<ConfigRubrica>) => void;

// ---------------------------------------------------------------------------
// Resumo por Rubrica

export function ResumoPorRubrica({
  resumo,
  configs,
  competencia,
  podeEditar,
  onAlterar,
}: {
  resumo: RubricaExtrato[];
  configs: Map<string, ConfigRubrica>;
  competencia: string;
  podeEditar: boolean;
  onAlterar: AlterarConfig;
}) {
  const proventos = resumo.filter((r) => r.tipo === "P");
  const descontos = resumo.filter((r) => r.tipo === "D");

  return (
    <Card>
      <CardHeader
        titulo={`Resumo por Rubrica — ${competenciaExtenso(competencia)}`}
        descricao="Defina se cada rubrica soma (recebido) ou subtrai (retorna à empresa) no total da folha."
        acao={
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Total da folha (rubricas)
            </p>
            <p className="text-lg font-semibold tabular">{moeda(totalFolha(resumo, configs))}</p>
          </div>
        }
      />
      <CardBody className="grid gap-0 px-0 py-0 lg:grid-cols-2 lg:divide-x lg:divide-border">
        <ColunaRubricas
          titulo="Proventos (P) — o que o funcionário recebeu"
          rubricas={proventos}
          configs={configs}
          podeEditar={podeEditar}
          onAlterar={onAlterar}
        />
        <ColunaRubricas
          titulo="Débitos (D) — o que retorna à empresa"
          rubricas={descontos}
          configs={configs}
          podeEditar={podeEditar}
          onAlterar={onAlterar}
        />
      </CardBody>
    </Card>
  );
}

function ColunaRubricas({
  titulo,
  rubricas,
  configs,
  podeEditar,
  onAlterar,
}: {
  titulo: string;
  rubricas: RubricaExtrato[];
  configs: Map<string, ConfigRubrica>;
  podeEditar: boolean;
  onAlterar: AlterarConfig;
}) {
  const total = rubricas.reduce((s, r) => s + r.valor, 0);
  return (
    <div className="min-w-0 border-t border-border first:border-t-0 lg:border-t-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</p>
        <p className="text-xs font-medium tabular">{moeda(total)}</p>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-xs">
          <tbody>
            {rubricas.map((r) => {
              const { efeito } = configDe(r, configs);
              const soma = efeito === "soma";
              return (
                <tr key={r.codigo} className="border-b border-border last:border-0">
                  <td className="w-12 py-1.5 pl-5 text-muted-foreground tabular">{r.codigo}</td>
                  <td className="py-1.5 pr-2">{r.descricao}</td>
                  <td className="py-1.5 pr-2 text-right text-[11px] text-muted-foreground tabular whitespace-nowrap">
                    {r.referencia}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium tabular whitespace-nowrap">
                    {moeda(r.valor)}
                  </td>
                  <td className="w-24 py-1.5 pr-5 text-right">
                    <button
                      type="button"
                      disabled={!podeEditar}
                      onClick={() => onAlterar(r, { efeito: soma ? "subtrai" : "soma" })}
                      title={podeEditar ? "Clique para inverter" : undefined}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        soma ? "bg-brand-soft text-brand" : "bg-negative-soft text-negative",
                        efeito === "ignora" && "bg-surface-muted text-muted-foreground",
                        podeEditar ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      {soma ? <Plus className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
                      {soma ? "Soma" : efeito === "ignora" ? "Ignora" : "Subtrai"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rubricas.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-center text-muted-foreground">Nenhuma rubrica.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custo da Folha

const CATEGORIAS_EDITAVEIS = Object.keys(ROTULO_CATEGORIA) as CategoriaCusto[];

export function CustoDaFolha({
  resumo,
  configs,
  manuais,
  competencia,
  comFiltro,
  encargos,
  podeEditar,
  onAlterarConfig,
  onAlterarManual,
}: {
  resumo: RubricaExtrato[];
  configs: Map<string, ConfigRubrica>;
  manuais: ManuaisFolha;
  competencia: string;
  comFiltro: boolean;
  encargos: Record<string, number>;
  podeEditar: boolean;
  onAlterarConfig: AlterarConfig;
  onAlterarManual: (campo: keyof ManuaisFolha, valor: number) => void;
}) {
  // O FGTS digitado é da empresa inteira: não se aplica a um recorte por setor/funcionário
  const custo = calcularCusto(resumo, configs, comFiltro ? {} : manuais);
  const { linhas } = custo;

  const linha = (categoria: Exclude<CategoriaCusto, "ignorar">, opcoes?: { negativo?: boolean }) => (
    <LinhaCategoria
      key={categoria}
      rotulo={ROTULO_CATEGORIA[categoria]}
      rubricas={linhas[categoria].rubricas}
      valor={linhas[categoria].valor}
      negativo={opcoes?.negativo}
      configs={configs}
      podeEditar={podeEditar}
      onAlterar={onAlterarConfig}
    />
  );

  return (
    <Card>
      <CardHeader
        titulo={`Custo da Folha — ${competenciaExtenso(competencia)}`}
        descricao="Linhas somadas das rubricas (clique para ver os códigos e mudar a classificação). FGTS e provisões de FGTS são informados à mão. TOTAL CUSTO = salário + provisões + encargos − retornos."
        acao={<Calculator className="size-4 text-muted-foreground" aria-hidden />}
      />
      <CardBody className="px-0 py-0">
        <div className="divide-y divide-border text-sm">
          {linha("proventos")}
          {linha("comissao")}
          {linha("produtividade")}
          <LinhaTotal rotulo="Total Salário" valor={custo.totalSalario} />
          {linha("retornos", { negativo: true })}
          {linha("decimo_terceiro")}
          {linha("ferias")}
          {linha("terco_ferias")}
          <LinhaManual
            rotulo="FGTS"
            ajuda={
              encargos["Valor do FGTS"] !== undefined
                ? `Extrato: ${moeda(encargos["Valor do FGTS"])}`
                : undefined
            }
            valor={manuais.fgts}
            desativado={!podeEditar || comFiltro}
            onSalvar={(v) => onAlterarManual("fgts", v)}
          />
          <LinhaManual
            rotulo="FGTS Prov. Férias"
            valor={manuais.fgtsProvFerias}
            desativado={!podeEditar || comFiltro}
            onSalvar={(v) => onAlterarManual("fgtsProvFerias", v)}
          />
          <LinhaManual
            rotulo="FGTS Prov. 13º"
            valor={manuais.fgtsProv13}
            desativado={!podeEditar || comFiltro}
            onSalvar={(v) => onAlterarManual("fgtsProv13", v)}
          />
          {linha("inss")}
          {linha("inss_13")}
          {linha("inss_ferias")}
          {custo.ignoradas.length ? (
            <LinhaCategoria
              rotulo={ROTULO_CATEGORIA.ignorar}
              rubricas={custo.ignoradas}
              valor={custo.ignoradas.reduce((s, r) => s + r.valor, 0)}
              apagado
              configs={configs}
              podeEditar={podeEditar}
              onAlterar={onAlterarConfig}
            />
          ) : null}
          <div className="flex items-center justify-between bg-brand-soft px-5 py-3">
            <span className="font-semibold text-brand">TOTAL CUSTO</span>
            <span className="text-base font-semibold text-brand tabular">{moeda(custo.totalCusto)}</span>
          </div>
        </div>
        {comFiltro ? (
          <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
            Com filtro de setor ou funcionário, o FGTS informado à mão (da empresa inteira) não entra no total.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function LinhaCategoria({
  rotulo,
  rubricas,
  valor,
  negativo,
  apagado,
  configs,
  podeEditar,
  onAlterar,
}: {
  rotulo: string;
  rubricas: RubricaExtrato[];
  valor: number;
  negativo?: boolean;
  apagado?: boolean;
  configs: Map<string, ConfigRubrica>;
  podeEditar: boolean;
  onAlterar: AlterarConfig;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-surface-muted"
      >
        <span className={cn("flex items-center gap-1.5", apagado && "text-muted-foreground")}>
          <ChevronRight
            className={cn("size-3.5 text-muted-foreground transition-transform", aberto && "rotate-90")}
            aria-hidden
          />
          {rotulo}
          <span className="text-[11px] text-muted-foreground">({rubricas.length})</span>
        </span>
        <span className={cn("tabular", negativo && valor ? "text-negative" : "", apagado && "text-muted-foreground")}>
          {negativo && valor ? `− ${moeda(valor)}` : moeda(valor)}
        </span>
      </button>
      {aberto ? (
        <div className="bg-surface-muted/50 px-5 pb-2">
          {rubricas.length === 0 ? (
            <p className="py-2 pl-5 text-xs text-muted-foreground">Nenhuma rubrica nesta linha.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {rubricas.map((r) => (
                  <tr key={`${r.tipo}${r.codigo}`} className="border-b border-border/60 last:border-0">
                    <td className="w-14 py-1 pl-5 text-muted-foreground tabular">
                      {r.tipo} {r.codigo}
                    </td>
                    <td className="py-1">{r.descricao}</td>
                    <td className="py-1 pr-3 text-right tabular">{moeda(r.valor)}</td>
                    <td className="w-44 py-1 text-right">
                      <select
                        aria-label={`Linha de custo da rubrica ${r.codigo}`}
                        value={configDe(r, configs).categoria}
                        disabled={!podeEditar}
                        onChange={(e) => onAlterar(r, { categoria: e.target.value as CategoriaCusto })}
                        className="w-full rounded-md border border-border bg-surface px-2 py-0.5 text-xs"
                      >
                        {CATEGORIAS_EDITAVEIS.map((c) => (
                          <option key={c} value={c}>
                            {ROTULO_CATEGORIA[c]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LinhaTotal({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between bg-surface-muted px-5 py-2.5 font-semibold">
      <span>{rotulo}</span>
      <span className="tabular">{moeda(valor)}</span>
    </div>
  );
}

function LinhaManual({
  rotulo,
  ajuda,
  valor,
  desativado,
  onSalvar,
}: {
  rotulo: string;
  ajuda?: string;
  valor: number | undefined;
  desativado: boolean;
  onSalvar: (valor: number) => void;
}) {
  const formatar = (v: number | undefined) =>
    (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [texto, setTexto] = useState(formatar(valor));

  const salvar = () => {
    const numero = Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
    setTexto(formatar(numero));
    if (Math.round(numero * 100) !== Math.round((valor ?? 0) * 100)) onSalvar(Math.max(0, numero));
  };

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2">
      <span className="pl-5">
        {rotulo}
        {ajuda ? <span className="ml-2 text-[11px] text-muted-foreground">{ajuda}</span> : null}
      </span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={rotulo}
        value={texto}
        disabled={desativado}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-36 rounded-md border border-warning/40 bg-warning-soft px-2 py-1 text-right text-sm tabular disabled:opacity-60"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funcionários

export function TabelaFuncionariosFolha({ funcionarios }: { funcionarios: FuncionarioFolha[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const colunas = 13;

  return (
    <Card>
      <CardBody className="px-0 py-0">
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                {["Matríc.", "Funcionário", "Setor", "Cargo", "Situação"].map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap first:pl-5">
                    {c}
                  </th>
                ))}
                {["Salário", "Proventos", "Descontos", "Líquido", "Base INSS", "Base FGTS", "Valor FGTS", "Base IRRF"].map(
                  (c) => (
                    <th key={c} scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap last:pr-5">
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <Fragment key={f.id}>
                  <tr
                    onClick={() => setAberto((a) => (a === f.id ? null : f.id))}
                    className={cn(
                      "cursor-pointer border-b border-border hover:bg-surface-muted",
                      aberto === f.id && "bg-surface-muted",
                    )}
                  >
                    <td className="py-2 pr-3 pl-5 tabular text-muted-foreground">{f.matricula}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{f.nome}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{rotuloSetor(f.departamento)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.cargo ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.situacao}</td>
                    <td className="px-3 py-2 text-right tabular whitespace-nowrap">
                      {f.salario === null ? "—" : moeda(f.salario)}
                    </td>
                    <td className="px-3 py-2 text-right text-brand tabular whitespace-nowrap">{moeda(f.proventos)}</td>
                    <td className="px-3 py-2 text-right text-negative tabular whitespace-nowrap">{moeda(f.descontos)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular whitespace-nowrap">{moeda(f.liquido)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular whitespace-nowrap">{moeda(f.baseInss)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular whitespace-nowrap">{moeda(f.baseFgts)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular whitespace-nowrap">{moeda(f.valorFgts)}</td>
                    <td className="py-2 pr-5 pl-3 text-right text-muted-foreground tabular whitespace-nowrap">
                      {moeda(f.baseIrrf)}
                    </td>
                  </tr>
                  {aberto === f.id ? (
                    <tr className="border-b border-border bg-surface-muted/50">
                      <td colSpan={colunas} className="px-5 py-3">
                        <DetalheFuncionario funcionario={f} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {funcionarios.length === 0 ? (
                <tr>
                  <td colSpan={colunas} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhum funcionário no filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function DetalheFuncionario({ funcionario }: { funcionario: FuncionarioFolha }) {
  const grupo = (tipo: "P" | "D") => funcionario.rubricas.filter((r) => r.tipo === tipo);
  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-2">
        {(["P", "D"] as const).map((tipo) => (
          <table key={tipo} className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-muted-foreground uppercase">
                <th className="pb-1 text-left font-semibold" colSpan={4}>
                  {tipo === "P" ? "Proventos" : "Descontos"}
                </th>
              </tr>
            </thead>
            <tbody>
              {grupo(tipo).map((r, i) => (
                <tr key={`${r.codigo}-${i}`}>
                  <td className="w-12 py-0.5 text-muted-foreground tabular">{r.codigo}</td>
                  <td className="py-0.5">{r.descricao}</td>
                  <td className="py-0.5 pr-3 text-right text-muted-foreground tabular">{r.referencia}</td>
                  <td className={cn("py-0.5 text-right tabular", tipo === "D" && "text-negative")}>
                    {moeda(r.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      {funcionario.observacoes.length ? (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {funcionario.observacoes.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
