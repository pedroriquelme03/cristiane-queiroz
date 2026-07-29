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

export default async function EmpresaPage() {
  const sessao = await getSessao();
  const supabase = await createClient();

  const { data: empresa, error } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", sessao.empresaId)
    .single();

  if (error || !empresa) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Empresa não encontrada. Entre em contato com o suporte.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader titulo="Dados gerais" />
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

      {/* Se houver unidades, exibir aqui */}
      {empresa.unidades && empresa.unidades.length > 0 && (
        <Card>
          <CardHeader titulo="Estrutura" />
          <CardBody>
            <ul className="space-y-2">
              {empresa.unidades.map((unidade: any) => (
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