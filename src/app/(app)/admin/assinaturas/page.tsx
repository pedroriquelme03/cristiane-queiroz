import { BadgeStatusAssinatura } from "@/components/assinatura/badge-status";
import { GerenciarTenant } from "@/components/admin/gerenciar-tenant";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPlanos, getTenants } from "@/lib/dados-assinatura";
import { cnpj as formatarCnpj, data as formatarData, moeda } from "@/lib/format";

export default async function AdminAssinaturasPage() {
  const [tenants, planos] = await Promise.all([getTenants(), getPlanos()]);

  // Mais críticos primeiro
  const ordem = { bloqueada: 0, inadimplente: 1, trial: 2, ativa: 3, cancelada: 4 };
  const lista = [...tenants].sort(
    (a, b) => ordem[a.estado.status] - ordem[b.estado.status],
  );

  return (
    <Card>
      <CardHeader
        titulo="Assinaturas dos clientes"
        descricao={`${tenants.length} clientes · registre pagamentos, troque planos e controle o acesso`}
      />
      <CardBody className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 text-left font-medium">Cliente</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Plano</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Situação</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Próx. vencimento</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Em aberto</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => {
                const proxima = t.estado.faturaEmAberto;
                return (
                  <tr key={t.empresa.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium">{t.empresa.nomeFantasia}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.empresa.cnpj ? formatarCnpj(t.empresa.cnpj) : t.empresa.razaoSocial}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{t.plano.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.assinatura.ciclo === "anual" ? "Anual" : "Mensal"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <BadgeStatusAssinatura status={t.estado.status} />
                      {t.estado.emCarencia && t.estado.diasParaBloqueio !== null ? (
                        <p className="mt-1 text-xs text-warning">
                          Bloqueia em {t.estado.diasParaBloqueio} dia
                          {t.estado.diasParaBloqueio === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular">
                      {proxima ? formatarData(proxima.vencimento) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular">
                      {t.estado.totalEmAberto > 0 ? moeda(t.estado.totalEmAberto) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <GerenciarTenant tenant={t} planos={planos} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
