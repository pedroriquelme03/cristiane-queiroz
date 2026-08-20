import { Save } from "lucide-react";

import { salvarCadastroEmpresa } from "./actions";
import { SeletorCliente } from "@/app/(app)/admin/visao-cliente/seletor-cliente";
import { EditarCadastroModal } from "@/components/empresa/editar-cadastro-modal";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { CampoData } from "@/components/ui/campo-data";
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

const OPCOES_SEGMENTO = [
  { valor: "geral", rotulo: "Geral" },
  { valor: "hotelaria", rotulo: "Hotelaria" },
  { valor: "comercio", rotulo: "Comércio" },
  { valor: "servicos", rotulo: "Serviços" },
  { valor: "industria", rotulo: "Indústria" },
  { valor: "alimentacao", rotulo: "Alimentação" },
];

const OPCOES_REGIME = [
  { valor: "simples", rotulo: "Simples Nacional" },
  { valor: "presumido", rotulo: "Lucro Presumido" },
  { valor: "real", rotulo: "Lucro Real" },
  { valor: "mei", rotulo: "MEI" },
];

function nomeSegmento(valor: string | null) {
  return valor ? NOME_SEGMENTO[valor as Segmento] ?? valor : "-";
}

function nomeRegime(valor: string | null) {
  return valor ? NOME_REGIME[valor as RegimeTributario] ?? valor : "-";
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
            descricao="Escolha a empresa para consultar e atualizar o cadastro."
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
            titulo="Dados cadastrados"
            descricao="Informações usadas nos relatórios e na identificação da empresa."
            acao={<EditarCadastro empresa={empresa} />}
          />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CampoResumo rotulo="Razão Social" valor={empresa.razao_social} />
              <CampoResumo rotulo="Nome Fantasia" valor={empresa.nome_fantasia ?? "-"} />
              <CampoResumo rotulo="CNPJ" valor={empresa.cnpj ? formatarCnpj(empresa.cnpj) : "-"} monoespacado />
              <CampoResumo rotulo="Segmento" valor={nomeSegmento(empresa.segmento)} />
              <CampoResumo rotulo="Regime Tributário" valor={nomeRegime(empresa.regime_tributario)} />
              <CampoResumo rotulo="Data de Abertura" valor={empresa.data_abertura ? formatarData(empresa.data_abertura) : "-"} />
              <CampoResumo rotulo="Funcionários" valor={String(empresa.qtd_funcionarios ?? 0)} />
            </dl>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function CampoResumo({
  rotulo,
  valor,
  monoespacado,
}: {
  rotulo: string;
  valor: string;
  monoespacado?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{rotulo}</dt>
      <dd className={monoespacado ? "mt-1 font-mono text-sm font-medium" : "mt-1 text-sm font-medium"}>
        {valor}
      </dd>
    </div>
  );
}

function FormCadastroEmpresa({
  empresa,
}: {
  empresa: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    segmento: string;
    regime_tributario: string | null;
    data_abertura: string | null;
    qtd_funcionarios: number | null;
  };
}) {
  return (
    <form action={salvarCadastroEmpresa.bind(null, empresa.id)} className="space-y-3">
      <CampoTexto id="razao_social" rotulo="Razão Social" defaultValue={empresa.razao_social} required />
      <CampoTexto id="nome_fantasia" rotulo="Nome Fantasia" defaultValue={empresa.nome_fantasia ?? ""} required />
      <CampoTexto
        id="cnpj"
        rotulo="CNPJ"
        defaultValue={empresa.cnpj?.replace(/\D/g, "") ?? ""}
        inputMode="numeric"
        minLength={14}
        maxLength={14}
        pattern="[0-9]{14}"
        required
        dica="Informe somente os 14 números."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelect
          id="segmento"
          rotulo="Segmento"
          defaultValue={empresa.segmento}
          opcoes={OPCOES_SEGMENTO}
        />
        <CampoSelect
          id="regime_tributario"
          rotulo="Regime tributário"
          defaultValue={empresa.regime_tributario ?? "simples"}
          opcoes={OPCOES_REGIME}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoData
          id="data_abertura"
          name="data_abertura"
          rotulo="Data de abertura"
          defaultValue={empresa.data_abertura ?? ""}
        />
        <CampoTexto
          id="qtd_funcionarios"
          rotulo="Funcionários"
          tipo="number"
          min={0}
          defaultValue={String(empresa.qtd_funcionarios ?? 0)}
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
      >
        <Save className="size-4" aria-hidden />
        Salvar alterações
      </button>
    </form>
  );
}

function EditarCadastro({
  empresa,
}: {
  empresa: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string | null;
    segmento: string;
    regime_tributario: string | null;
    data_abertura: string | null;
    qtd_funcionarios: number | null;
  };
}) {
  return (
    <EditarCadastroModal>
      <FormCadastroEmpresa empresa={empresa} />
    </EditarCadastroModal>
  );
}
