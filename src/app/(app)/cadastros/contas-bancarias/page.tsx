import {
  DialogoNovaContaBancaria,
  EditarContaBancaria,
  RemoverContaBancaria,
} from "@/components/cadastros/contas-bancarias-controles";
import { AvisoSemEmpresa } from "@/components/cadastros/ui";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getContasBancarias } from "@/lib/dados";
import { empresaAtiva } from "@/lib/empresa-ativa";
import { data as formatarData, moeda } from "@/lib/format";
import { getSessao } from "@/lib/sessao";

const ROTULO_TIPO = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  caixa: "Caixa",
  aplicacao: "Aplicação",
} as const;

export default async function CadastroContasBancariasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string | string[] }>;
}) {
  const [params, sessao] = await Promise.all([searchParams, getSessao()]);
  const empresaIdAtiva = empresaAtiva(sessao, params.empresa);
  const podeEditar =
    Boolean(empresaIdAtiva) && (sessao.role === "admin" || sessao.role === "cliente");
  const contas = await getContasBancarias(empresaIdAtiva ?? undefined);

  if (!empresaIdAtiva) {
    return <AvisoSemEmpresa />;
  }

  return (
    <Card>
      <CardHeader
        titulo="Contas bancárias e caixa"
        descricao="Saldo inicial na data de referência; baixas e lançamentos atualizam o saldo atual sem duplicar o valor."
        acao={podeEditar ? <DialogoNovaContaBancaria empresaId={empresaIdAtiva} /> : null}
      />
      <CardBody className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Nome</th>
                <th className="px-3 py-2.5 text-left font-medium">Banco</th>
                <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-left font-medium">Data ref.</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldo inicial</th>
                <th className="px-3 py-2.5 text-right font-medium">Saldo atual</th>
                {podeEditar ? <th className="px-5 py-2.5 text-right font-medium">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    {conta.nome}
                  </th>
                  <td className="px-3 py-2.5 text-muted-foreground">{conta.banco ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{ROTULO_TIPO[conta.tipo]}</td>
                  <td className="px-3 py-2.5 tabular text-muted-foreground">
                    {formatarData(conta.dataSaldoInicial)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-muted-foreground">
                    {moeda(conta.saldoInicial)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular font-medium">
                    {moeda(conta.saldoAtual ?? conta.saldoInicial)}
                  </td>
                  {podeEditar ? (
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <EditarContaBancaria conta={conta} empresaId={empresaIdAtiva} />
                        <RemoverContaBancaria conta={conta} empresaId={empresaIdAtiva} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {contas.length === 0 ? (
                <tr>
                  <td
                    colSpan={podeEditar ? 7 : 6}
                    className="px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma conta cadastrada. Use <strong>Nova conta</strong> para começar.
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
