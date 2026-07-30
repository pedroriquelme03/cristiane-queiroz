import { AlertTriangle, Ban, CreditCard, Users } from "lucide-react";

import { BadgeStatusAssinatura } from "@/components/assinatura/badge-status";
import { GerenciarTenant } from "@/components/admin/gerenciar-tenant";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getPlanos, getResumoAdmin, getTenants } from "@/lib/dados-assinatura";
import { moeda } from "@/lib/format";
import type { StatusAssinatura } from "@/lib/types";

export default async function GestaoPlataformaPage() {
  const [resumo, tenants, planos] = await Promise.all([
    getResumoAdmin(),
    getTenants(),
    getPlanos(),
  ]);
  const prioridade = { bloqueada: 0, inadimplente: 1, trial: 2, ativa: 3, cancelada: 4 };
  const carteira = [...tenants].sort((a, b) => {
    const porPrioridade = prioridade[a.estado.status] - prioridade[b.estado.status];
    if (porPrioridade !== 0) return porPrioridade;
    return b.estado.diasAtraso - a.estado.diasAtraso;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Receita recorrente (MRR)" valor={moeda(resumo.mrr)} nota={`${resumo.totalTenants} clientes na carteira`} icone={<CreditCard className="size-4" />} />
        <Kpi rotulo="Clientes ativos" valor={String(resumo.ativos + resumo.emTrial)} tom="positivo" nota={resumo.emTrial ? `${resumo.emTrial} em período de teste` : undefined} icone={<Users className="size-4" />} />
        <Kpi rotulo="Em atraso" valor={String(resumo.inadimplentes)} tom={resumo.inadimplentes ? "atencao" : "neutro"} nota={resumo.inadimplenciaValor ? `${moeda(resumo.inadimplenciaValor)} em aberto` : "Nenhum"} icone={<AlertTriangle className="size-4" />} />
        <Kpi rotulo="Bloqueados" valor={String(resumo.bloqueados)} tom={resumo.bloqueados ? "negativo" : "neutro"} nota={resumo.bloqueados ? "Sem acesso ao sistema" : "Nenhum"} icone={<Ban className="size-4" />} />
      </div>

      <Card>
        <CardHeader
          titulo="Assinaturas dos clientes"
          descricao="Visão operacional dos clientes, do maior risco para a carteira em dia"
        />
        <CardBody className="px-0 py-0">
          {carteira.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum cliente com assinatura cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium">Plano</th>
                    <th className="px-3 py-2 text-left font-medium">Situação</th>
                    <th className="px-3 py-2 text-left font-medium">Risco operacional</th>
                    <th className="px-3 py-2 text-right font-medium">Em aberto</th>
                    <th className="px-3 py-2 text-right font-medium">Atraso</th>
                    <th className="px-5 py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {carteira.map((tenant) => (
                    <tr key={tenant.empresa.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{tenant.empresa.nomeFantasia}</p>
                        <p className="text-xs text-muted-foreground">{tenant.empresa.razaoSocial}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{tenant.plano.nome}</td>
                      <td className="px-3 py-2.5"><BadgeStatusAssinatura status={tenant.estado.status} /></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{riscoOperacional(tenant.estado.status)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{tenant.estado.totalEmAberto > 0 ? moeda(tenant.estado.totalEmAberto) : "-"}</td>
                      <td className="px-3 py-2.5 text-right tabular">{tenant.estado.diasAtraso > 0 ? `${tenant.estado.diasAtraso} dias` : "-"}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end">
                          <GerenciarTenant tenant={tenant} planos={planos} />
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

function riscoOperacional(status: StatusAssinatura) {
  const rotulos: Record<StatusAssinatura, string> = {
    bloqueada: "Acesso suspenso",
    inadimplente: "Inadimplência em carência",
    trial: "Período de avaliação",
    ativa: "Carteira regular",
    cancelada: "Contrato encerrado",
  };

  return rotulos[status];
}
