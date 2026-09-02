import { Briefcase, Trash2, Users } from "lucide-react";

import { removerClienteConsultoria } from "@/app/(app)/admin/clientes/acoes";
import { FormClienteConsultoria } from "@/components/admin/form-cliente-consultoria";
import { BotaoIconeCadastro, EstadoVazioCadastro } from "@/components/cadastros/ui";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getClientesConsultoria, getResumoClientesConsultoria } from "@/lib/dados-clientes";
import { documentoPessoa, moeda } from "@/lib/format";

export default async function ClientesConsultoriaPage() {
  const [resumo, clientes] = await Promise.all([
    getResumoClientesConsultoria(),
    getClientesConsultoria(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi
          rotulo="Clientes de consultoria"
          valor={String(resumo.total)}
          icone={<Users className="size-4" />}
        />
        <Kpi
          rotulo="Receita mensal"
          valor={moeda(resumo.receitaMensal)}
          nota="Soma dos valores informados no cadastro"
          icone={<Briefcase className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Consultoria"
          descricao="Cadastre clientes atendidos em consultoria com CPF ou CNPJ e o valor mensal pago"
          acao={<FormClienteConsultoria />}
        />
        <CardBody className="px-0 py-0">
          {clientes.length === 0 ? (
            <div className="px-5 py-8">
              <EstadoVazioCadastro
                icone={<Users className="size-5" />}
                texto="Nenhum cliente de consultoria cadastrado."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-xl text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium">Documento</th>
                    <th className="px-3 py-2 text-right font-medium">Valor mensal</th>
                    <th className="px-5 py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-medium">{cliente.nome}</td>
                      <td className="px-3 py-2.5 tabular text-muted-foreground">
                        {documentoPessoa(cliente.documento)}
                        <span className="ml-2 text-xs uppercase">{cliente.tipoDocumento}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{moeda(cliente.valorMensal)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end">
                          <form action={removerClienteConsultoria.bind(null, cliente.id)}>
                            <BotaoIconeCadastro title="Remover cliente">
                              <Trash2 className="size-3.5" aria-hidden />
                            </BotaoIconeCadastro>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
