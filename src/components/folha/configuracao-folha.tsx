"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import {
  salvarAcessoFolha,
  salvarContaDreFolha,
  salvarSetorFolha,
  salvarUnidadeFolha,
} from "@/app/(app)/financeiro/folha/acoes";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ContaPlano, MembroFolha, UnidadeFolha } from "@/lib/dados-folha";
import { ROTULO_NIVEL_FOLHA, type NivelAcessoFolha } from "@/lib/folha-acesso";
import {
  NATUREZAS_DRE,
  ROTULO_TIPO_CUSTO,
  type ConfigEncargos,
  type NaturezaDre,
} from "@/lib/folha-analitica";
import { cnpj as formatarCnpj } from "@/lib/format";
import { cn } from "@/lib/utils";

type Aba = "unidades" | "setores" | "dre" | "acessos";

const CLASSE_INPUT = "rounded-md border border-border bg-surface px-2 py-1 text-sm disabled:opacity-60";

export function ConfiguracaoFolha({
  empresaId,
  unidades,
  encargosSalvos,
  encargosSugeridos,
  setores,
  contasDre,
  planoContas,
  membros,
  podeEditar,
  ehAdmin,
}: {
  empresaId: string;
  unidades: UnidadeFolha[];
  encargosSalvos: Record<string, ConfigEncargos>;
  /** Alíquotas deduzidas do relatório do mês, por unidade. */
  encargosSugeridos: Record<string, ConfigEncargos>;
  /** Por unidade: códigos de departamento vistos nos relatórios + nome cadastrado. */
  setores: { unidadeId: string; codigo: string; nome: string | null; funcionarios: number }[];
  contasDre: Partial<Record<NaturezaDre, string>>;
  planoContas: ContaPlano[];
  membros: MembroFolha[];
  podeEditar: boolean;
  ehAdmin: boolean;
}) {
  const [aba, setAba] = useState<Aba>("unidades");
  const abas: [Aba, string][] = [
    ["unidades", "Unidades e encargos"],
    ["setores", "Setores"],
    ["dre", "Integração DRE"],
    ...(ehAdmin ? ([["acessos", "Acesso aos dados"]] as [Aba, string][]) : []),
  ];

  return (
    <Card>
      <CardHeader
        titulo="Configurações da folha"
        descricao="Valem para as competências abertas. Uma competência fechada usa a configuração congelada no fechamento."
      />
      <div className="flex gap-1 overflow-x-auto border-b border-border px-5">
        {abas.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave)}
            className={cn(
              "-mb-px border-b-2 px-2.5 py-2 text-sm whitespace-nowrap",
              aba === chave ? "border-brand font-medium text-brand" : "border-transparent text-muted-foreground",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <CardBody>
        {aba === "unidades" ? (
          <div className="space-y-4">
            {unidades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma unidade cadastrada. Crie em{" "}
                <Link href="/cadastros/unidades" className="text-brand">
                  Cadastros → Unidades
                </Link>{" "}
                ou na própria importação do relatório.
              </p>
            ) : null}
            {unidades.map((u) => (
              <FormUnidade
                key={u.id}
                empresaId={empresaId}
                unidade={u}
                salvo={encargosSalvos[u.id]}
                sugerido={encargosSugeridos[u.id]}
                podeEditar={podeEditar}
              />
            ))}
          </div>
        ) : null}

        {aba === "setores" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              O relatório traz só o código do departamento. Dê o nome do setor (manutenção, recreação, restaurante,
              recepção, governança, administrativo…) para cada código de cada unidade.
            </p>
            {unidades
              .filter((u) => setores.some((s) => s.unidadeId === u.id))
              .map((u) => (
                <div key={u.id}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{u.nome}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {setores
                      .filter((s) => s.unidadeId === u.id)
                      .map((s) => (
                        <CampoSetor
                          key={s.codigo}
                          empresaId={empresaId}
                          unidadeId={u.id}
                          codigo={s.codigo}
                          nome={s.nome}
                          funcionarios={s.funcionarios}
                          podeEditar={podeEditar}
                        />
                      ))}
                  </div>
                </div>
              ))}
            {setores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Importe os relatórios do mês para ver os departamentos.</p>
            ) : null}
          </div>
        ) : null}

        {aba === "dre" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              No fechamento da competência, o custo apurado é gravado por unidade, setor, centro de custo, natureza e
              tipo de custo. Vincule cada natureza a uma conta do plano para conciliar com o realizado no DRE. O DRE não
              soma esses valores ao realizado (que vem dos lançamentos financeiros), evitando lançamento duplicado.
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {NATUREZAS_DRE.map((n) => (
                <CampoContaDre
                  key={n.chave}
                  empresaId={empresaId}
                  natureza={n.chave}
                  rotulo={n.rotulo}
                  tipo={ROTULO_TIPO_CUSTO[n.tipo]}
                  atual={contasDre[n.chave] ?? ""}
                  planoContas={planoContas}
                  podeEditar={podeEditar}
                />
              ))}
            </div>
          </div>
        ) : null}

        {aba === "acessos" && ehAdmin ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Define o que cada usuário da empresa vê na folha. CPF só aparece com acesso completo; “somente totais”
              esconde nomes e remuneração individual. A regra também vale no banco (RLS).
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {membros.map((m) => (
                <CampoAcesso key={m.usuarioId} empresaId={empresaId} membro={m} />
              ))}
              {membros.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum usuário vinculado a esta empresa.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function FormUnidade({
  empresaId,
  unidade,
  salvo,
  sugerido,
  podeEditar,
}: {
  empresaId: string;
  unidade: UnidadeFolha;
  salvo: ConfigEncargos | undefined;
  sugerido: ConfigEncargos | undefined;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const base = salvo ?? sugerido;
  const fmt = (v: number | undefined) => (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const [cnpj, setCnpj] = useState(unidade.cnpj ? formatarCnpj(unidade.cnpj) : "");
  const [regime, setRegime] = useState(base?.regime ?? "");
  const [valores, setValores] = useState({
    inssEmpresa: fmt(base?.inssEmpresa ?? 20),
    rat: fmt(base?.rat),
    terceiros: fmt(base?.terceiros),
    fgts: fmt(base?.fgts ?? 8),
    fgtsAprendiz: fmt(base?.fgtsAprendiz ?? 2),
  });
  const [provisionar, setProvisionar] = useState(base?.provisionar ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  function usarSugestao() {
    if (!sugerido) return;
    setRegime(sugerido.regime ?? "");
    setValores((v) => ({
      ...v,
      inssEmpresa: fmt(sugerido.inssEmpresa),
      rat: fmt(sugerido.rat),
      terceiros: fmt(sugerido.terceiros),
    }));
  }

  function salvar() {
    setMsg(null);
    iniciar(async () => {
      const r = await salvarUnidadeFolha(empresaId, {
        unidadeId: unidade.id,
        cnpj: cnpj || null,
        regime: regime || null,
        inssEmpresa: num(valores.inssEmpresa),
        rat: num(valores.rat),
        terceiros: num(valores.terceiros),
        fgts: num(valores.fgts),
        fgtsAprendiz: num(valores.fgtsAprendiz),
        provisionar,
      });
      setMsg(r.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  }

  const campo = (chave: keyof typeof valores, rotulo: string) => (
    <label className="space-y-1">
      <span className="block text-[11px] font-medium text-muted-foreground">{rotulo}</span>
      <input
        inputMode="decimal"
        value={valores[chave]}
        disabled={!podeEditar}
        onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
        className={cn(CLASSE_INPUT, "w-20 text-right tabular")}
      />
    </label>
  );

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {unidade.nome}
          {!salvo ? (
            <span className="ml-2 rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-normal text-warning">
              alíquotas não cadastradas — usando as do relatório
            </span>
          ) : null}
        </p>
        {sugerido ? (
          <p className="text-[11px] text-muted-foreground">
            Relatório do mês: INSS {fmt(sugerido.inssEmpresa)}% · RAT {fmt(sugerido.rat)}% · Terceiros{" "}
            {fmt(sugerido.terceiros)}%
            {podeEditar ? (
              <button type="button" onClick={usarSugestao} className="ml-2 font-medium text-brand">
                Usar
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">CNPJ</span>
          <input
            value={cnpj}
            disabled={!podeEditar}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className={cn(CLASSE_INPUT, "w-44 tabular")}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground">Regime</span>
          <select
            value={regime}
            disabled={!podeEditar}
            onChange={(e) => setRegime(e.target.value as typeof regime)}
            className={cn(CLASSE_INPUT, "w-36")}
          >
            <option value="">Não informado</option>
            <option value="simples">Simples Nacional</option>
            <option value="presumido">Lucro Presumido</option>
            <option value="real">Lucro Real</option>
          </select>
        </label>
        {campo("inssEmpresa", "INSS patronal %")}
        {campo("rat", "RAT × FAP %")}
        {campo("terceiros", "Terceiros %")}
        {campo("fgts", "FGTS %")}
        {campo("fgtsAprendiz", "FGTS aprendiz %")}
        <label className="flex items-center gap-1.5 pb-1.5 text-xs">
          <input
            type="checkbox"
            checked={provisionar}
            disabled={!podeEditar}
            onChange={(e) => setProvisionar(e.target.checked)}
          />
          Provisionar 13º e férias
        </label>
        {podeEditar ? (
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
          >
            <Save className="size-3.5" aria-hidden />
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        ) : null}
        {msg ? <span className={cn("text-xs", msg.ok ? "text-positive" : "text-negative")}>{msg.texto}</span> : null}
      </div>
      {regime === "simples" ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Simples Nacional (anexos I a III e V): a contribuição patronal está no DAS — deixe INSS, RAT e terceiros em
          zero. No anexo IV, informe o INSS patronal.
        </p>
      ) : null}
    </div>
  );
}

function CampoSetor({
  empresaId,
  unidadeId,
  codigo,
  nome,
  funcionarios,
  podeEditar,
}: {
  empresaId: string;
  unidadeId: string;
  codigo: string;
  nome: string | null;
  funcionarios: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(nome ?? "");
  const [estado, setEstado] = useState<"ok" | "erro" | null>(null);
  const [pendente, iniciar] = useTransition();

  const salvar = () => {
    if (valor.trim() === (nome ?? "")) return;
    iniciar(async () => {
      const r = await salvarSetorFolha(empresaId, { unidadeId, codigo, nome: valor.trim() });
      setEstado(r.ok ? "ok" : "erro");
      if (r.ok) router.refresh();
    });
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        Depto {codigo}
        <span className="block text-[10px]">{funcionarios} func.</span>
      </span>
      <input
        value={valor}
        disabled={!podeEditar}
        list="nomes-setores-folha"
        placeholder={`Depto ${codigo}`}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        className={cn(
          CLASSE_INPUT,
          "min-w-0 flex-1",
          estado === "ok" && "border-positive/50",
          estado === "erro" && "border-negative",
          pendente && "opacity-60",
        )}
      />
      <datalist id="nomes-setores-folha">
        {["Manutenção", "Recreação", "Restaurante", "Cozinha", "Recepção", "Governança", "Administrativo", "Lavanderia", "Bar", "Reservas"].map(
          (s) => (
            <option key={s} value={s} />
          ),
        )}
      </datalist>
    </label>
  );
}

function CampoContaDre({
  empresaId,
  natureza,
  rotulo,
  tipo,
  atual,
  planoContas,
  podeEditar,
}: {
  empresaId: string;
  natureza: NaturezaDre;
  rotulo: string;
  tipo: string;
  atual: string;
  planoContas: ContaPlano[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="min-w-60 flex-1">
        {rotulo}
        <span className="ml-2 text-[11px] text-muted-foreground">{tipo}</span>
      </span>
      <select
        value={valor}
        disabled={!podeEditar || pendente}
        onChange={(e) => {
          const novo = e.target.value;
          setValor(novo);
          setErro(null);
          iniciar(async () => {
            const r = await salvarContaDreFolha(empresaId, { natureza, planoContaId: novo || null });
            if (!r.ok) {
              setErro(r.erro);
              setValor(atual);
            } else router.refresh();
          });
        }}
        className={cn(CLASSE_INPUT, "w-72")}
      >
        <option value="">Sem conta vinculada</option>
        {planoContas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.codigo} · {c.nome}
          </option>
        ))}
      </select>
      {erro ? <span className="text-xs text-negative">{erro}</span> : null}
    </div>
  );
}

function CampoAcesso({ empresaId, membro }: { empresaId: string; membro: MembroFolha }) {
  const router = useRouter();
  const [valor, setValor] = useState<NivelAcessoFolha>(membro.acesso);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="min-w-60 flex-1">
        {membro.nome}
        <span className="block text-xs text-muted-foreground">
          {membro.email} · {membro.papel}
        </span>
      </span>
      <select
        value={valor}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value as NivelAcessoFolha;
          setValor(novo);
          setErro(null);
          iniciar(async () => {
            const r = await salvarAcessoFolha(empresaId, { usuarioId: membro.usuarioId, acesso: novo });
            if (!r.ok) {
              setErro(r.erro);
              setValor(membro.acesso);
            } else router.refresh();
          });
        }}
        className={cn(CLASSE_INPUT, "w-52")}
      >
        {(Object.keys(ROTULO_NIVEL_FOLHA) as NivelAcessoFolha[]).map((n) => (
          <option key={n} value={n}>
            {ROTULO_NIVEL_FOLHA[n]}
          </option>
        ))}
      </select>
      {erro ? <span className="text-xs text-negative">{erro}</span> : null}
    </div>
  );
}
