import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { FiltroMesFluxo } from "@/components/financeiro/filtro-mes-fluxo";
import { FormCadastrarPrevistos } from "@/components/financeiro/form-cadastrar-previsto";
import {
  getCompetenciaAtual,
  getDre,
  getOrcamentos,
  getPlanoContas,
  intervaloDoMes,
  listarCompetenciasOpcoes,
} from "@/lib/dados";
import { competenciaExtenso, moeda, percentual } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

/** Tolerância antes de a conta ser tratada como desvio relevante. */
const TOLERANCIA = 0.1;

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa }, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const podeEditar = Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const sufixoEmpresa = empresaIdAtiva ? `?empresa=${encodeURIComponent(empresaIdAtiva)}` : "";

  const [competencia, opcoesCompetencia] = await Promise.all([
    getCompetenciaAtual(),
    listarCompetenciasOpcoes(empresaIdAtiva),
  ]);
  const { inicio, fim } = intervaloDoMes(competencia);
  const [linhasDre, contas, orcamentos] = await Promise.all([
    getDre(inicio, fim, empresaIdAtiva),
    getPlanoContas(empresaIdAtiva),
    getOrcamentos(competencia, empresaIdAtiva),
  ]);

  // Comparativo usa o mesmo `previsto` da DRE (tabela orcamentos cadastrada acima).
  const linhas = linhasDre.filter((l) => l.realizado !== 0 || l.previsto !== 0);
  const receitas = linhas.filter((l) => l.tipo === "receita");
  const gastos = linhas.filter((l) => l.tipo !== "receita");

  const totalPrevisto = linhas.reduce((s, l) => s + l.previsto, 0);
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const totalOrcadoCadastrado = orcamentos.reduce((s, o) => s + o.valorPrevisto, 0);
  const orcadoConfere =
    Math.abs(
      linhasDre.reduce((s, l) => s + l.previsto, 0) - totalOrcadoCadastrado,
    ) < 0.005;

  /**
   * Um desvio é favorável quando sobra dinheiro: receita acima do orçado ou
   * gasto abaixo. Como os gastos vêm negativos, a conta é a mesma nos dois casos.
   */
  const desvios = linhas
    .map((l) => ({
      ...l,
      desvio: l.realizado - l.previsto,
      desvioRelativo:
        l.previsto !== 0 ? ((l.realizado - l.previsto) / Math.abs(l.previsto)) * 100 : 0,
    }))
    .filter((l) => Math.abs(l.desvioRelativo) > TOLERANCIA * 100)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

  const maiorEscala = Math.max(
    ...linhas.map((l) => Math.max(Math.abs(l.previsto), Math.abs(l.realizado))),
    1,
  );

  if (sessao.role === "admin" && !empresaIdAtiva) {
    return (
      <>
        <FiltroMesFluxo
          competencia={competencia}
          opcoes={opcoesCompetencia}
          titulo="Período do orçamento"
          descricao="Mês de competência dos valores orçados e da comparação com o realizado"
          idPrefixo="filtro-orcamento"
        />
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            Selecione um cliente (empresa) no topo para cadastrar e editar o orçamento.
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <FiltroMesFluxo
        competencia={competencia}
        opcoes={opcoesCompetencia}
        titulo="Período do orçamento"
        descricao="Mês de competência dos valores orçados e da comparação com o realizado"
        idPrefixo="filtro-orcamento"
      />

      <FormCadastrarPrevistos
        empresaId={empresaIdAtiva}
        competencia={competencia}
        contas={contas}
        orcamentos={orcamentos}
        podeEditar={podeEditar}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Resultado orçado"
          valor={moeda(totalPrevisto)}
          nota={`${orcamentos.length} categoria${orcamentos.length === 1 ? "" : "s"} cadastrada${orcamentos.length === 1 ? "" : "s"}`}
        />
        <Kpi
          rotulo="Resultado realizado"
          valor={moeda(totalRealizado)}
          tom={totalRealizado >= 0 ? "positivo" : "negativo"}
        />
        <Kpi
          rotulo="Desvio total"
          valor={moeda(totalRealizado - totalPrevisto)}
          tom={totalRealizado >= totalPrevisto ? "positivo" : "negativo"}
          nota={percentual(
            totalPrevisto !== 0
              ? ((totalRealizado - totalPrevisto) / Math.abs(totalPrevisto)) * 100
              : null,
          )}
        />
        <Kpi
          rotulo="Contas fora da tolerância"
          valor={String(desvios.length)}
          tom={desvios.length > 3 ? "atencao" : "neutro"}
          nota={`Tolerância de ${percentual(TOLERANCIA * 100, 0)}`}
        />
      </div>

      <p
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          orcadoConfere
            ? "border-positive/30 bg-positive/5 text-foreground"
            : "border-warning/40 bg-warning/5 text-foreground",
        )}
      >
        {orcadoConfere
          ? `Comparativo orçado × realizado usa os ${orcamentos.length} valor(es) cadastrados na tabela orçamentos deste mês (${moeda(totalOrcadoCadastrado)}).`
          : `Atenção: o orçado nas linhas da DRE (${moeda(linhasDre.reduce((s, l) => s + l.previsto, 0))}) não bate com a soma dos cadastros (${moeda(totalOrcadoCadastrado)}).`}{" "}
        <Link href={`/financeiro/dre${sufixoEmpresa}`} className="font-medium text-brand hover:underline">
          Ver na DRE
        </Link>
      </p>

      <Card>
        <CardHeader
          titulo="Maiores desvios"
          descricao={`Contas que fugiram mais de ${percentual(TOLERANCIA * 100, 0)} do orçado em ${competenciaExtenso(competencia)}`}
        />
        <CardBody className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Conta</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Orçado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Realizado</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Desvio</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {desvios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      {orcamentos.length === 0
                        ? "Cadastre os orçados acima (por categoria e mês) para acompanhar os desvios."
                        : "Nenhum desvio acima da tolerância neste período."}
                    </td>
                  </tr>
                ) : (
                  desvios.map((linha) => {
                    const favoravel = linha.desvio > 0;
                    return (
                      <tr key={linha.planoContaId} className="border-b border-border last:border-0">
                        <th scope="row" className="px-5 py-2.5 text-left font-normal">
                          <span className="tabular text-xs text-muted-foreground">
                            {linha.codigo}
                          </span>{" "}
                          {linha.conta}
                        </th>
                        <td className="tabular px-3 py-2.5 text-right text-muted-foreground">
                          {moeda(linha.previsto)}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right font-medium">
                          {moeda(linha.realizado)}
                        </td>
                        <td
                          className={cn(
                            "tabular px-3 py-2.5 text-right font-medium",
                            favoravel ? "text-positive" : "text-negative",
                          )}
                        >
                          {linha.desvio > 0 ? "+" : ""}
                          {moeda(linha.desvio)}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <Badge tom={favoravel ? "positivo" : "negativo"}>
                            {favoravel ? "Favorável" : "Desfavorável"}{" "}
                            {percentual(Math.abs(linha.desvioRelativo), 0)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <ComparativoCard
          titulo="Receitas: orçado × realizado"
          linhas={receitas}
          escala={maiorEscala}
        />
        <ComparativoCard
          titulo="Custos e despesas: orçado × realizado"
          linhas={gastos}
          escala={maiorEscala}
        />
      </div>
    </>
  );
}

/**
 * Barras pareadas em HTML. Duas séries, então há legenda; cada barra também
 * carrega o valor em texto, o que dispensa depender só da cor.
 */
function ComparativoCard({
  titulo,
  linhas,
  escala,
}: {
  titulo: string;
  linhas: { planoContaId: string; conta: string; previsto: number; realizado: number }[];
  escala: number;
}) {
  return (
    <Card>
      <CardHeader titulo={titulo} />
      <CardBody className="space-y-4">
        <ul className="flex items-center gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--eixo)]" />
            Orçado
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-[var(--serie-saldo)]" />
            Realizado
          </li>
        </ul>

        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados neste grupo.</p>
        ) : (
          linhas.map((linha) => (
            <div key={linha.planoContaId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{linha.conta}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {moeda(linha.realizado)} de {moeda(linha.previsto)}
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="h-1.5 w-full rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-[var(--eixo)]"
                    style={{ width: `${(Math.abs(linha.previsto) / escala) * 100}%` }}
                  />
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-[var(--serie-saldo)]"
                    style={{ width: `${(Math.abs(linha.realizado) / escala) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
