import { Check, EyeOff } from "lucide-react";

import { DialogoPlano } from "@/components/admin/dialogo-plano";
import { ExcluirPlano } from "@/components/admin/excluir-plano";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { economiaAnual } from "@/lib/assinatura";
import { getPlanos, getTenants } from "@/lib/dados-assinatura";
import { moeda } from "@/lib/format";

export default async function AdminPlanosPage() {
  const [planos, tenants] = await Promise.all([getPlanos(), getTenants()]);

  // Quantos tenants usam cada plano, para mostrar o alcance de cada um
  const usoPorPlano = new Map<string, number>();
  for (const t of tenants) {
    usoPorPlano.set(t.plano.id, (usoPorPlano.get(t.plano.id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {planos.length} planos · {planos.filter((p) => p.publico && p.ativo).length} na vitrine
        </p>
        <DialogoPlano />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {planos.map((plano) => {
          const economia = economiaAnual(plano);
          const uso = usoPorPlano.get(plano.id) ?? 0;
          return (
            <Card key={plano.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{plano.nome}</h3>
                      {!plano.publico ? (
                        <Badge tom="neutro">
                          <EyeOff className="size-3" aria-hidden /> Oculto
                        </Badge>
                      ) : null}
                      {!plano.ativo ? <Badge tom="negativo">Inativo</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{plano.descricao}</p>
                  </div>
                </div>

                <div>
                  <p className="text-2xl font-semibold tracking-tight tabular">
                    {moeda(plano.precoMensal)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  {plano.precoAnual ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ou {moeda(plano.precoAnual)}/ano
                      {economia > 0 ? (
                        <span className="text-positive"> · economia de {economia}%</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>

                <ul className="flex-1 space-y-1.5 text-sm">
                  {plano.recursos.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>

                <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Usuários</dt>
                    <dd className="font-medium">{plano.limiteUsuarios ?? "Ilimitado"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Empresas</dt>
                    <dd className="font-medium">{plano.limiteEmpresas ?? "Ilimitado"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Teste</dt>
                    <dd className="font-medium">{plano.trialDias ? `${plano.trialDias}d` : "—"}</dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {uso} {uso === 1 ? "cliente usa" : "clientes usam"}
                  </span>
                  <div className="flex items-center gap-4">
                    <DialogoPlano plano={plano} />
                    <ExcluirPlano id={plano.id} nome={plano.nome} />
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
