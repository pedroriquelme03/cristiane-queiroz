import Link from "next/link";
import { AlertTriangle, Ban, CreditCard, Users } from "lucide-react";

import { BadgeStatusAssinatura } from "@/components/assinatura/badge-status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { getResumoAdmin, getTenants } from "@/lib/dados-assinatura";
import { moeda } from "@/lib/format";

export default async function AdminVisaoGeralPage() {
  const [resumo, tenants] = await Promise.all([getResumoAdmin(), getTenants()]);

  // Quem precisa de atenção primeiro: bloqueados e em atraso no topo
  const prioridade = { bloqueada: 0, inadimplente: 1, trial: 2, ativa: 3, cancelada: 4 };
  const atencao = [...tenants]
    .filter((t) => t.estado.status === "bloqueada" || t.estado.status === "inadimplente")
    .sort((a, b) => prioridade[a.estado.status] - prioridade[b.estado.status]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          rotulo="Receita recorrente (MRR)"
          valor={moeda(resumo.mrr)}
          nota={`${resumo.totalTenants} clientes na carteira`}
          icone={<CreditCard className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Clientes ativos"
          valor={String(resumo.ativos + resumo.emTrial)}
          tom="positivo"
          nota={resumo.emTrial ? `${resumo.emTrial} em período de teste` : undefined}
          icone={<Users className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Em atraso"
          valor={String(resumo.inadimplentes)}
          tom={resumo.inadimplentes ? "atencao" : "neutro"}
          nota={resumo.inadimplenciaValor ? `${moeda(resumo.inadimplenciaValor)} em aberto` : "Nenhum"}
          icone={<AlertTriangle className="size-4" aria-hidden />}
        />
        <Kpi
          rotulo="Bloqueados"
          valor={String(resumo.bloqueados)}
          tom={resumo.bloqueados ? "negativo" : "neutro"}
          nota={resumo.bloqueados ? "Sem acesso ao sistema" : "Nenhum"}
          icone={<Ban className="size-4" aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader
          titulo="Clientes que precisam de atenção"
          descricao="Bloqueados e em atraso, do mais crítico ao menos"
          acao={
            <Link
              href="/admin/assinaturas"
              className="text-xs font-medium text-brand hover:underline"
            >
              Ver todos
            </Link>
          }
        />
        <CardBody className="px-0 py-0">
          {atencao.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente em atraso. Carteira em dia. 🎉
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2 text-left font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Plano</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Situação</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Em aberto</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {atencao.map((t) => (
                  <tr key={t.empresa.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{t.empresa.nomeFantasia}</p>
                      <p className="text-xs text-muted-foreground">{t.empresa.razaoSocial}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{t.plano.nome}</td>
                    <td className="px-3 py-2.5">
                      <BadgeStatusAssinatura status={t.estado.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {moeda(t.estado.totalEmAberto)}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular">
                      {t.estado.diasAtraso > 0 ? `${t.estado.diasAtraso} dias` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
