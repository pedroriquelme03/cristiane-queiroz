import Link from "next/link";
import {
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { AvisoRelatorioSemEmpresa } from "@/components/relatorios/aviso-empresa";
import { Card, CardBody } from "@/components/ui/card";
import { planoPermite } from "@/lib/acesso-planos";
import { getAssinaturaEmpresa } from "@/lib/dados-assinatura";
import { carregarContextoRelatorio } from "@/lib/relatorios/contexto";
import { comEmpresa } from "@/lib/relatorios/filtros";

const RELATORIOS_BASICOS = [
  {
    href: "/financeiro/relatorios/contas-a-pagar",
    rotulo: "Contas a pagar",
    descricao: "Títulos a pagar com filtros de período, situação e plano de contas.",
    icone: Wallet,
  },
  {
    href: "/financeiro/relatorios/contas-a-receber",
    rotulo: "Contas a receber",
    descricao: "Valores recebidos, pendentes e futuros por cliente e classificação.",
    icone: Wallet,
  },
  {
    href: "/financeiro/relatorios/contratos",
    rotulo: "Contratos",
    descricao: "Contas e recebimentos fixos: parcelas, vencimentos e situação.",
    icone: FileSpreadsheet,
  },
  {
    href: "/financeiro/relatorios/plano-de-contas",
    rotulo: "Plano de contas",
    descricao: "Quanto foi pago ou recebido em cada classificação.",
    icone: Landmark,
  },
  {
    href: "/financeiro/relatorios/fluxo-de-caixa",
    rotulo: "Fluxo de caixa",
    descricao: "Entradas, saídas e saldo do período, com lançamentos e títulos.",
    icone: TrendingUp,
  },
];

export default async function RelatoriosHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessao, empresaId } = await carregarContextoRelatorio(searchParams);
  if (!empresaId) return <AvisoRelatorioSemEmpresa />;

  const assinatura =
    sessao.role === "cliente" && sessao.empresaId
      ? await getAssinaturaEmpresa(sessao.empresaId)
      : null;
  const avancado = sessao.role !== "cliente" || planoPermite(assinatura?.plano, "financeiro-avancado");
  const consultoria = sessao.role !== "cliente" || planoPermite(assinatura?.plano, "consultoria");

  const itens = [
    ...RELATORIOS_BASICOS,
    ...(avancado
      ? [
          {
            href: "/financeiro/relatorios/dre",
            rotulo: "DRE gerencial",
            descricao: "Realizado, orçado e desvio por classificação no período.",
            icone: TrendingUp,
          },
        ]
      : []),
    ...(consultoria
      ? [
          {
            href: "/plano-de-acao/relatorio",
            rotulo: "Plano de ação",
            descricao: "Ações cadastradas, prazos, status e responsáveis.",
            icone: ClipboardList,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {itens.map((item) => {
        const Icone = item.icone;
        return (
          <Link key={item.href} href={comEmpresa(item.href, empresaId)} className="group">
            <Card className="h-full transition-colors group-hover:border-brand/50">
              <CardBody className="space-y-2">
                <span className="grid size-9 place-items-center rounded-lg bg-surface-muted text-muted-foreground group-hover:text-brand">
                  <Icone className="size-4" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold">{item.rotulo}</h2>
                <p className="text-xs text-muted-foreground">{item.descricao}</p>
                <p className="text-xs font-medium text-brand">Abrir relatório →</p>
              </CardBody>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
