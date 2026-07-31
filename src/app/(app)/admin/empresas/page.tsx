import Link from "next/link";
import { Building2, Plus, Tag, Users } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cnpj as formatarCnpj } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const NOME_SEGMENTO: Record<string, string> = {
  alimentacao: "Alimentação",
  comercio: "Comércio",
  geral: "Geral",
  hotelaria: "Hotelaria",
  industria: "Indústria",
  servicos: "Serviços",
};

function nomeSegmento(segmento: string | null) {
  if (!segmento) return "Não informado";
  return NOME_SEGMENTO[segmento] ?? segmento;
}

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("*")
    .order("nome_fantasia");

  if (error) {
    console.error("Erro ao buscar empresas:", error);
    return <div className="p-4 text-destructive">Erro ao carregar empresas.</div>;
  }

  const lista = empresas ?? [];
  const segmentos = new Set(
    lista.map((empresa) => empresa.segmento).filter(Boolean),
  ).size;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Resumo icone={Building2} rotulo="Usuários cadastrados" valor={lista.length} />
        <Resumo icone={Tag} rotulo="Segmentos atendidos" valor={segmentos} />
        <Resumo icone={Users} rotulo="Gestão de clientes" valor="Ativa" />
      </div>

      <Card>
        <CardHeader
          titulo="Usuários"
          descricao="Cadastre e gerencie os acessos dos clientes à plataforma."
          acao={
            <Link
              href="/admin/empresas/nova"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-brand-foreground hover:opacity-90"
            >
              <Plus className="size-4" />
              Novo usuário
            </Link>
          }
        />
        <CardBody className="px-0 py-0">
          {lista.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Usuário / empresa</th>
                    <th className="px-3 py-2.5 font-medium">CNPJ</th>
                    <th className="px-3 py-2.5 font-medium">Segmento</th>
                    <th className="px-5 py-2.5 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((empresa) => (
                    <tr key={empresa.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{empresa.nome_fantasia}</p>
                        <p className="text-xs text-muted-foreground">{empresa.razao_social}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-muted-foreground">
                        {empresa.cnpj ? formatarCnpj(empresa.cnpj) : "—"}
                      </td>
                      <td className="px-3 py-3">{nomeSegmento(empresa.segmento)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/empresas/${empresa.id}`}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Editar
                        </Link>
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

function Resumo({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: number | string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className="rounded-lg bg-brand/10 p-2 text-brand">
          <Icone className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          <p className="text-lg font-semibold">{valor}</p>
        </div>
      </CardBody>
    </Card>
  );
}
