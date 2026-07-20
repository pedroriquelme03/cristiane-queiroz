import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";

import {
  BadgeStatusAssinatura,
  BadgeStatusFatura,
} from "@/components/assinatura/badge-status";
import { PagarFatura } from "@/components/assinatura/pagar-fatura";
import { VitrinePlanos } from "@/components/assinatura/vitrine-planos";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { calcularEstado, precoNoCiclo } from "@/lib/assinatura";
import {
  getAssinaturaEmpresa,
  getPlanosPublicos,
} from "@/lib/dados-assinatura";
import { getSessao } from "@/lib/sessao";
import { data as formatarData, moeda } from "@/lib/format";
import type { EstadoAssinatura } from "@/lib/types";

export default async function AssinaturaPage() {
  const sessao = await getSessao();
  const [dados, planos] = await Promise.all([
    getAssinaturaEmpresa(sessao.empresaId),
    getPlanosPublicos(),
  ]);

  if (!dados) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma assinatura encontrada para esta empresa.
      </p>
    );
  }

  const { assinatura, plano, faturas } = dados;
  const estado = calcularEstado(assinatura, faturas);
  const emAberto = faturas.filter((f) => f.status === "aberta");

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Assinatura"
        descricao="Seu plano, faturas e forma de pagamento"
      />

      <FaixaSituacao estado={estado} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader titulo="Plano atual" />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{plano.nome}</span>
              <BadgeStatusAssinatura status={estado.status} />
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular">
              {moeda(precoNoCiclo(plano, assinatura.ciclo))}
              <span className="text-sm font-normal text-muted-foreground">
                /{assinatura.ciclo === "anual" ? "ano" : "mês"}
              </span>
            </p>
            <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ciclo</dt>
                <dd className="capitalize">{assinatura.ciclo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Início</dt>
                <dd className="tabular">{formatarData(assinatura.inicio)}</dd>
              </div>
              {estado.faturaEmAberto ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Próximo vencimento</dt>
                  <dd className="tabular">
                    {formatarData(estado.faturaEmAberto.vencimento)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            titulo="Faturas"
            descricao={`${faturas.length} faturas · ${emAberto.length} em aberto`}
          />
          <CardBody className="px-0 py-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2 text-left font-medium">Competência</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Vencimento</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Situação</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 tabular">
                        {formatarData(f.competencia).slice(3)}
                      </td>
                      <td className="px-3 py-2.5 tabular">{formatarData(f.vencimento)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{moeda(f.valor)}</td>
                      <td className="px-3 py-2.5">
                        <BadgeStatusFatura fatura={f} />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {f.status === "aberta" ? (
                          <PagarFatura fatura={f} />
                        ) : f.pagoEm ? (
                          <span className="text-xs text-muted-foreground">
                            Pago em {formatarData(f.pagoEm)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      <VitrinePlanos
        planos={planos}
        planoAtualId={plano.id}
        cicloAtual={assinatura.ciclo}
      />
    </div>
  );
}

function FaixaSituacao({ estado }: { estado: EstadoAssinatura }) {
  if (estado.bloqueada) {
    return (
      <Faixa
        tom="negativo"
        Icone={Ban}
        titulo="Acesso bloqueado por falta de pagamento"
        texto={`Há ${moeda(estado.totalEmAberto)} em aberto, vencidos há ${estado.diasAtraso} dias. Pague a fatura para liberar o acesso.`}
      />
    );
  }
  if (estado.emCarencia) {
    return (
      <Faixa
        tom="atencao"
        Icone={AlertTriangle}
        titulo="Fatura em atraso"
        texto={`Regularize em até ${estado.diasParaBloqueio} dia${estado.diasParaBloqueio === 1 ? "" : "s"} para não perder o acesso ao sistema.`}
      />
    );
  }
  return (
    <Faixa
      tom="positivo"
      Icone={CheckCircle2}
      titulo="Assinatura em dia"
      texto="Obrigado! Seu acesso está liberado e todas as faturas estão quitadas ou dentro do prazo."
    />
  );
}

function Faixa({
  tom,
  Icone,
  titulo,
  texto,
}: {
  tom: "positivo" | "atencao" | "negativo";
  Icone: typeof AlertTriangle;
  titulo: string;
  texto: string;
}) {
  const estilos = {
    positivo: "border-positive/20 bg-positive-soft text-positive",
    atencao: "border-warning/20 bg-warning-soft text-warning",
    negativo: "border-negative/20 bg-negative-soft text-negative",
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${estilos[tom]}`}>
      <Icone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-0.5 text-sm opacity-90">{texto}</p>
      </div>
    </div>
  );
}
