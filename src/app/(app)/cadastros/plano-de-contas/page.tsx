import {
  BotaoPlanoPadrao,
  DialogoNovaConta,
  EditarConta,
  RemoverConta,
} from "@/components/financeiro/plano-contas-controles";
import { AvisoSemEmpresa } from "@/components/cadastros/ui";
import { LinkGerarRelatorio } from "@/components/relatorios/link-gerar-relatorio";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPlanoContas } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import {
  montarSecoesPlanoContas,
  ROTULO_GRUPO_DRE,
  ROTULO_TIPO_CONTA,
  type SecaoPlanoContas,
} from "@/lib/plano-contas-padrao";
import { getSessao } from "@/lib/sessao";

export default async function CadastroPlanoDeContasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaIdAtiva = empresaAtiva(sessao, params.empresa);
  const podeEditar =
    Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const contas = await getPlanoContas(empresaIdAtiva ?? undefined);

  if (!empresaIdAtiva) {
    return <AvisoSemEmpresa />;
  }

  const secoes = montarSecoesPlanoContas(contas, { incluirVazias: true });
  const colunas = podeEditar ? 5 : 4;

  return (
    <Card>
      <CardHeader
        titulo="Classificações"
        descricao="Cada classificação vira uma linha do DRE gerencial. Também alimenta o campo Classificação em lançamentos e contas a pagar/receber."
        acao={
          <div className="flex flex-wrap items-center gap-2">
            <LinkGerarRelatorio href="/financeiro/relatorios/plano-de-contas" empresaId={empresaIdAtiva} />
            {podeEditar ? (
              <>
                {contas.length === 0 ? <BotaoPlanoPadrao empresaId={empresaIdAtiva} /> : null}
                <DialogoNovaConta empresaId={empresaIdAtiva} />
              </>
            ) : null}
          </div>
        }
      />
      <CardBody className="px-0 py-0">
        {contas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma classificação cadastrada. Use <strong>Carregar plano padrão</strong> ou{" "}
            <strong>Nova classificação</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Código</th>
                  <th className="px-3 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-left font-medium">Grupo DRE</th>
                  {podeEditar ? <th className="px-5 py-2.5 text-right font-medium">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {secoes.map((secao) => (
                  <SecaoTabela
                    key={secao.id}
                    secao={secao}
                    colunas={colunas}
                    podeEditar={podeEditar}
                    empresaId={empresaIdAtiva}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SecaoTabela({
  secao,
  colunas,
  podeEditar,
  empresaId,
}: {
  secao: SecaoPlanoContas;
  colunas: number;
  podeEditar: boolean;
  empresaId: string;
}) {
  return (
    <>
      <tr className="border-b border-border bg-surface-muted/60">
        <th scope="colgroup" colSpan={colunas} className="px-5 py-2.5 text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">{secao.titulo}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {secao.descricao}
              {" · "}
              {secao.contas.length}{" "}
              {secao.contas.length === 1 ? "classificação" : "classificações"}
            </span>
          </div>
        </th>
      </tr>
      {secao.contas.length === 0 ? (
        <tr className="border-b border-border">
          <td colSpan={colunas} className="px-5 py-4 text-sm text-muted-foreground">
            Nenhuma classificação nesta seção.
          </td>
        </tr>
      ) : (
        secao.contas.map((conta) => (
          <tr key={conta.id} className="border-b border-border last:border-0">
            <td className="px-5 py-2.5 font-mono text-xs tabular">{conta.codigo}</td>
            <th scope="row" className="px-3 py-2.5 text-left font-normal">
              {conta.nome}
            </th>
            <td className="px-3 py-2.5 text-muted-foreground">{ROTULO_TIPO_CONTA[conta.tipo]}</td>
            <td className="px-3 py-2.5 text-muted-foreground">{ROTULO_GRUPO_DRE[conta.grupoDre]}</td>
            {podeEditar ? (
              <td className="px-5 py-2.5">
                <div className="flex items-center justify-end gap-3">
                  <EditarConta conta={conta} empresaId={empresaId} />
                  <RemoverConta conta={conta} empresaId={empresaId} />
                </div>
              </td>
            ) : null}
          </tr>
        ))
      )}
    </>
  );
}
