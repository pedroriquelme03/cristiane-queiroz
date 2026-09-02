"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";

import { consultarCnpj } from "@/app/(app)/admin/empresas/consultar-cnpj";
import { criarEmpresa } from "@/app/(app)/admin/empresas/nova/action";
import { SeletorSegmento } from "@/components/admin/seletor-segmento";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { moeda } from "@/lib/format";
import type { Plano, Segmento } from "@/lib/types";

export function FormNovoCliente({ planos }: { planos: Plano[] }) {
  const [estado, acao, pendente] = useActionState(criarEmpresa, { error: "" });
  const [cnpj, setCnpj] = useState("");
  const [planoId, setPlanoId] = useState(() => planos[0]?.id ?? "");
  const [trialDias, setTrialDias] = useState(() => String(planos[0]?.trialDias ?? 30));
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [segmento, setSegmento] = useState<Exclude<Segmento, "geral">>("servicos");
  const [consultaErro, setConsultaErro] = useState<string | null>(null);
  const [consultaOk, setConsultaOk] = useState<string | null>(null);
  const [consultando, startConsulta] = useTransition();
  const ultimoConsultado = useRef("");

  useEffect(() => {
    if (cnpj.length !== 14 || cnpj === ultimoConsultado.current) return;

    const temporizador = window.setTimeout(() => {
      startConsulta(async () => {
        setConsultaErro(null);
        setConsultaOk(null);
        const resultado = await consultarCnpj(cnpj);
        if (!resultado.ok) {
          setConsultaErro(resultado.erro);
          return;
        }

        ultimoConsultado.current = cnpj;
        setRazaoSocial(resultado.dados.razaoSocial);
        setNomeFantasia(resultado.dados.nomeFantasia);
        setSegmento(resultado.dados.segmento);
        setConsultaOk("Dados preenchidos automaticamente pela Receita Federal.");
      });
    }, 400);

    return () => window.clearTimeout(temporizador);
  }, [cnpj]);

  return (
    <form action={acao} className="space-y-4">
      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Dados da empresa</h3>
        <div className="space-y-3">
          <CampoTexto
            id="cnpj"
            rotulo="CNPJ *"
            required
            value={cnpj}
            inputMode="numeric"
            minLength={14}
            maxLength={14}
            pattern="[0-9]{14}"
            placeholder="Somente os 14 números"
            autoComplete="off"
            dica={
              consultando
                ? "Consultando CNPJ na Receita Federal…"
                : "Ao informar o CNPJ, razão social, nome fantasia e segmento são preenchidos."
            }
            onChange={(evento) => {
              const limpo = evento.currentTarget.value.replace(/\D/g, "").slice(0, 14);
              setCnpj(limpo);
              if (limpo.length < 14) {
                ultimoConsultado.current = "";
                setConsultaErro(null);
                setConsultaOk(null);
              }
            }}
          />

          {consultando ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Buscando dados do CNPJ…
            </p>
          ) : null}

          {consultaErro ? (
            <p role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {consultaErro}
            </p>
          ) : null}

          {consultaOk ? (
            <p role="status" className="rounded-lg bg-positive/10 px-3 py-2 text-xs text-positive">
              {consultaOk}
            </p>
          ) : null}

          <CampoTexto
            id="razao_social"
            rotulo="Razão social *"
            required
            value={razaoSocial}
            onChange={(evento) => setRazaoSocial(evento.currentTarget.value)}
          />
          <CampoTexto
            id="nome_fantasia"
            rotulo="Nome fantasia *"
            required
            value={nomeFantasia}
            onChange={(evento) => setNomeFantasia(evento.currentTarget.value)}
          />
          <SeletorSegmento key={segmento} valorInicial={segmento} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Plano e cobrança</h3>
        {planos.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoSelect
                id="planoId"
                rotulo="Plano *"
                required
                defaultValue={planoId}
                onValueChange={(novoPlanoId) => {
                  setPlanoId(novoPlanoId);
                  const novoPlano = planos.find((plano) => plano.id === novoPlanoId);
                  setTrialDias(String(novoPlano?.trialDias ?? 0));
                }}
                opcoes={planos.map((plano) => ({
                  valor: plano.id,
                  rotulo: plano.nome,
                  detalhe: moeda(plano.precoMensal),
                }))}
              />
              <CampoSelect
                id="ciclo"
                rotulo="Ciclo *"
                required
                defaultValue="mensal"
                opcoes={[
                  { valor: "mensal", rotulo: "Mensal" },
                  { valor: "anual", rotulo: "Anual" },
                ]}
              />
              <CampoTexto
                id="trialDias"
                rotulo="Teste gratuito (dias) *"
                required
                inputMode="numeric"
                min={0}
                max={365}
                value={trialDias}
                dica="Você pode ajustar este prazo somente para este cliente."
                onChange={(evento) => setTrialDias(evento.currentTarget.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O prazo começa com o padrão do plano escolhido, mas pode ser ajustado acima. Durante o teste, a administradora pode trocar o plano sem alterar a data final da avaliação.
            </p>
          </>
        ) : (
          <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Cadastre ou ative um plano antes de criar um cliente.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Dados de acesso do cliente</h3>
        <div className="space-y-3">
          <CampoTexto id="email" rotulo="E-mail *" tipo="email" required placeholder="cliente@exemplo.com" />
          <CampoTexto
            id="senha"
            rotulo="Senha temporária *"
            tipo="password"
            required
            minLength={6}
            placeholder="Mínimo de 6 caracteres"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O cliente usará estas credenciais para acessar o sistema.
        </p>
      </div>

      {estado.error ? (
        <p role="alert" className="rounded-lg bg-negative/10 p-3 text-sm text-negative">
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendente || consultando || !planos.length}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden />
        {pendente ? "Criando cliente..." : "Criar cliente e acesso"}
      </button>
    </form>
  );
}
