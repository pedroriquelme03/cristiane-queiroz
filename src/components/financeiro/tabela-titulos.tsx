import { Badge, type TomBadge } from "@/components/ui/badge";
import {
  DialogoBaixaTitulo,
  DialogoTitulo,
  ExcluirTitulo,
} from "@/components/financeiro/dialogo-titulo";
import { statusEfetivo } from "@/lib/dados";
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

/** Descreve o vencimento em linguagem natural: "vence em 6 dias", "12 dias em atraso". */
function textoVencimento(titulo: Titulo) {
  if (titulo.status === "pago") return "Quitado";
  const dias = diasAte(titulo.vencimento);
  if (dias < 0) return `${Math.abs(dias)} dias em atraso`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} dias`;
}

export function TabelaTitulos({
  titulos,
  rotuloContraparte,
  contas = [],
  empresaId,
  podeEditar = false,
}: {
  titulos: Titulo[];
  /** "Fornecedor" em contas a pagar, "Cliente" em contas a receber */
  rotuloContraparte: string;
  contas?: PlanoConta[];
  empresaId?: string;
  podeEditar?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-5 py-2.5 text-left font-medium">
              {rotuloContraparte}
            </th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Documento</th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Vencimento</th>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">Situação</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Saldo</th>
            {podeEditar ? <th scope="col" className="px-5 py-2.5 text-right font-medium">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {titulos.map((titulo) => {
            const situacao = statusEfetivo(titulo);
            return (
              <tr key={titulo.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-5 py-2.5 text-left font-normal">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {titulo.contraparte}
                    {titulo.fixa ? <Badge tom="atencao">Fixa</Badge> : null}
                  </span>
                </th>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {titulo.documento ?? "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="tabular">{formatarData(titulo.vencimento)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {textoVencimento(titulo)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tom={TOM[situacao]}>{ROTULO[situacao]}</Badge>
                </td>
                <td className="tabular px-5 py-2.5 text-right font-medium">
                  {moeda(titulo.valor - titulo.valorPago)}
                </td>
                {podeEditar && empresaId ? (
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {titulo.status !== "pago" && titulo.status !== "cancelado" ? (
                        <DialogoBaixaTitulo titulo={titulo} empresaId={empresaId} />
                      ) : null}
                      <DialogoTitulo
                        tipo={titulo.tipo}
                        contas={contas}
                        empresaId={empresaId}
                        titulo={titulo}
                      />
                      {titulo.valorPago === 0 ? (
                        <ExcluirTitulo titulo={titulo} empresaId={empresaId} />
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
          {titulos.length === 0 ? (
            <tr>
              <td colSpan={podeEditar ? 6 : 5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhum título nesta seção.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
