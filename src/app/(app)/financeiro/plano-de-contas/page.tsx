import {
  BotaoPlanoPadrao,
  DialogoNovaConta,
  RemoverConta,
} from "@/components/financeiro/plano-contas-controles";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPlanoContas } from "@/lib/dados";
import { ROTULO_GRUPO_DRE, ROTULO_TIPO_CONTA } from "@/lib/plano-contas-padrao";
import { getSessao } from "@/lib/sessao";

export default async function PlanoDeContasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [{ empresa }, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaId = typeof empresa === "string" ? empresa : undefined;
  const empresaIdAtiva = sessao.role === "admin" ? empresaId : sessao.empresaId;
  const podeEditar = Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const contas = await getPlanoContas(empresaIdAtiva);

  return (
    <Card>
      <CardHeader
        titulo="Plano de contas"
        descricao="Classificações usadas em lançamentos, contas a pagar/receber e DRE."
        acao={
          podeEditar && empresaIdAtiva ? (
            <div className="flex flex-wrap items-center gap-2">
              {contas.length === 0 ? <BotaoPlanoPadrao empresaId={empresaIdAtiva} /> : null}
              <DialogoNovaConta empresaId={empresaIdAtiva} />
            </div>
          ) : null
        }
      />
      <CardBody className="px-0 py-0">
        {!empresaIdAtiva ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Selecione uma empresa no topo para gerenciar o plano de contas.
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
                {contas.map((conta) => (
                  <tr key={conta.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs tabular">{conta.codigo}</td>
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      {conta.nome}
                    </th>
                    <td className="px-3 py-2.5 text-muted-foreground">{ROTULO_TIPO_CONTA[conta.tipo]}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{ROTULO_GRUPO_DRE[conta.grupoDre]}</td>
                    {podeEditar && empresaIdAtiva ? (
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end">
                          <RemoverConta conta={conta} empresaId={empresaIdAtiva} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {contas.length === 0 ? (
                  <tr>
                    <td colSpan={podeEditar ? 5 : 4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma classificação cadastrada. Use <strong>Carregar plano padrão</strong> ou{" "}
                      <strong>Nova classificação</strong>.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
