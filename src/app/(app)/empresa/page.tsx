import Link from "next/link";
import { FilePenLine } from "lucide-react";

import { SeletorCliente } from "@/app/(app)/admin/visao-cliente/seletor-cliente";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cnpj as formatarCnpj, data as formatarData } from "@/lib/format";
import { getSessao } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import type { RegimeTributario, Segmento } from "@/lib/types";

const NOME_SEGMENTO: Record<Segmento, string> = {
  geral: "Geral",
  hotelaria: "Hotelaria",
  comercio: "Comércio",
  servicos: "Serviços",
  industria: "Indústria",
  alimentacao: "Alimentação",
};

const NOME_REGIME: Record<RegimeTributario, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

// Funções auxiliares para validação com fallback
function getNomeSegmento(valor: string): string {
  return NOME_SEGMENTO[valor as Segmento] ?? valor;
}

function getNomeRegime(valor: string): string {
  return NOME_REGIME[valor as RegimeTributario] ?? valor;
}

export default async function EmpresaPage({
  searchParams,
}: PageProps<"/empresa">) {
  const sessao = await getSessao();
  const supabase = await createClient();
  const { empresa: empresaParam } = await searchParams;
  const empresaSelecionadaId =
    sessao.role === "admin" && typeof empresaParam === "string"
      ? empresaParam
      : sessao.empresaId;

  const { data: empresas, error: empresasError } = await supabase
    .from("empresas")
    .select("*")
    .order("razao_social");

  const empresa = (empresas ?? []).find((item) => item.id === empresaSelecionadaId);

  if (empresasError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Não foi possível carregar as empresas. Tente novamente mais tarde.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sessao.role === "admin" ? (
        <Card>
          <CardHeader
            titulo="Cliente visualizado"
            descricao="Escolha a empresa cujos dados cadastrais e estruturais deseja consultar."
          />
          <CardBody className="max-w-xl">
            <SeletorCliente
              empresas={empresas ?? []}
              empresaSelecionadaId={empresa?.id}
              rotaBase="/empresa"
            />
          </CardBody>
        </Card>
      ) : null}

      {!empresa ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted-foreground">
            {sessao.role === "admin"
              ? "Selecione um cliente para consultar os dados da empresa."
              : "Sua conta ainda não está vinculada a uma empresa. Entre em contato com a consultoria."}
          </CardBody>
        </Card>
      ) : (
      <Card>
        <CardHeader
          titulo="Dados gerais"
          acao={
            sessao.role === "admin" ? (
              <Link
                href={`/admin/empresas/${empresa.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-muted"
              >
                <FilePenLine className="size-4" />
                Editar cadastro
              </Link>
            ) : null
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Razão Social</p>
              <p className="font-medium">{empresa.razao_social}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nome Fantasia</p>
              <p className="font-medium">{empresa.nome_fantasia}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CNPJ</p>
              <p className="font-medium font-mono">{formatarCnpj(empresa.cnpj)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Segmento</p>
              <p className="font-medium">{getNomeSegmento(empresa.segmento)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Regime Tributário</p>
              <p className="font-medium">{getNomeRegime(empresa.regime_tributario)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Abertura</p>
              <p className="font-medium">{empresa.data_abertura ? formatarData(empresa.data_abertura) : "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Funcionários</p>
              <p className="font-medium">{empresa.qtd_funcionarios ?? "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>
      )}

      {/* Se houver unidades, exibir aqui */}
      {empresa?.unidades && empresa.unidades.length > 0 && (
        <Card>
          <CardHeader titulo="Estrutura" />
          <CardBody>
            <ul className="space-y-2">
              {empresa.unidades.map((unidade: { id: string; nome: string; tipo: string; cidade: string; uf: string }) => (
                <li key={unidade.id} className="flex items-center gap-2 border-b last:border-0 py-2">
                  <span className="font-medium">{unidade.nome}</span>
                  <span className="text-sm text-muted-foreground">
                    {unidade.tipo} • {unidade.cidade}/{unidade.uf}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
