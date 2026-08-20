"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import {
  excluirGrupoContaFixa,
  type EstadoFormulario,
} from "@/app/(app)/financeiro/acoes";
import {
  DialogoBaixaTitulo,
  DialogoTitulo,
} from "@/components/financeiro/dialogo-titulo";
import { Badge, type TomBadge } from "@/components/ui/badge";
import { type ContaFixaAgrupada, statusEfetivo } from "@/lib/titulos";
import { data as formatarData, diasAte, moeda } from "@/lib/format";
import type { PlanoConta, Titulo } from "@/lib/types";

const ROTULO: Record<string, string> = {
  aberto: "Em aberto",
  parcial: "Parcial",
  pago: "Pago",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

const TOM: Record<string, TomBadge> = {
  aberto: "neutro",
  parcial: "atencao",
  pago: "positivo",
  cancelado: "neutro",
  vencido: "negativo",
};

function textoProximo(vencimento: string, status: string) {
  if (status === "pago") return "Quitado";
  const dias = diasAte(vencimento);
  if (dias < 0) return `${Math.abs(dias)} dias em atraso`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} dias`;
}

const ESTADO_INICIAL: EstadoFormulario = {};

function ExcluirGrupoFixa({
  grupo,
  empresaId,
  rotulo,
}: {
  grupo: ContaFixaAgrupada;
  empresaId: string;
  rotulo: string;
}) {
  const [estado, acao] = useActionState(excluirGrupoContaFixa, ESTADO_INICIAL);
  const excluidas = grupo.parcelas.filter((p) => p.valorPago === 0).length;

  return (
    <form
      action={acao}
      onSubmit={(event) => {
        if (
          !confirm(
            `Excluir o ${rotulo} de "${grupo.titulo.contraparte}" e as ${excluidas} parcela(s) sem baixa?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="tituloId" value={grupo.titulo.id} />
      {grupo.titulo.grupoFixaId ? (
        <input type="hidden" name="grupoFixaId" value={grupo.titulo.grupoFixaId} />
      ) : null}
      <button
        type="submit"
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-negative"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Excluir
      </button>
      {estado.erro ? <p className="mt-1 max-w-48 text-xs text-negative">{estado.erro}</p> : null}
    </form>
  );
}

/** Lista títulos fixos agrupados: uma linha por cadastro, com meses restantes. */
export function TabelaContasFixas({
  grupos,
  tipo,
  rotuloContraparte,
  contas = [],
  empresaId,
  podeEditar = false,
}: {
  grupos: ContaFixaAgrupada[];
  tipo: Titulo["tipo"];
  rotuloContraparte: string;
  contas?: PlanoConta[];
  empresaId?: string;
  podeEditar?: boolean;
}) {
  const rotuloItem = tipo === "pagar" ? "conta fixa" : "recebimento fixo";
  const vazio =
    tipo === "pagar" ? "Nenhuma conta fixa em aberto." : "Nenhum recebimento fixo em aberto.";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-5 py-2.5 text-left font-medium">
              {rotuloContraparte}
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Documento
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Valor mensal
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Próximo vencimento
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Meses restantes
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Situação
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">
              Saldo
            </th>
            {podeEditar ? (
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                Ações
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => {
            const situacao = statusEfetivo(grupo.titulo);
            return (
              <tr key={grupo.chave} className="border-b border-border last:border-0">
                <th scope="row" className="px-5 py-2.5 text-left font-normal">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {grupo.titulo.contraparte}
                    <Badge tom="atencao">Fixo</Badge>
                  </span>
                </th>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {grupo.titulo.documento ?? "—"}
                </td>
                <td className="tabular px-3 py-2.5">{moeda(grupo.valorMensal)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="tabular">{formatarData(grupo.titulo.vencimento)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {textoProximo(grupo.titulo.vencimento, situacao)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="tabular font-medium">{grupo.mesesRestantes}</span>
                  <span className="text-muted-foreground">
                    {grupo.mesesRestantes === 1 ? " mês" : " meses"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tom={TOM[situacao]}>{ROTULO[situacao]}</Badge>
                </td>
                <td className="tabular px-5 py-2.5 text-right font-medium">
                  {moeda(grupo.saldo)}
                </td>
                {podeEditar && empresaId ? (
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {grupo.titulo.status !== "pago" && grupo.titulo.status !== "cancelado" ? (
                        <DialogoBaixaTitulo titulo={grupo.titulo} empresaId={empresaId} />
                      ) : null}
                      <DialogoTitulo
                        tipo={tipo}
                        contas={contas}
                        empresaId={empresaId}
                        titulo={grupo.titulo}
                      />
                      <ExcluirGrupoFixa grupo={grupo} empresaId={empresaId} rotulo={rotuloItem} />
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
          {grupos.length === 0 ? (
            <tr>
              <td
                colSpan={podeEditar ? 8 : 7}
                className="px-5 py-8 text-center text-sm text-muted-foreground"
              >
                {vazio}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
