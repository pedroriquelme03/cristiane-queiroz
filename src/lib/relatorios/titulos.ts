import { statusEfetivo } from "@/lib/titulos";
import type { Lancamento, Titulo } from "@/lib/types";

import {
  CONTA_SEM_CLASSIFICACAO,
  type CampoDataRelatorio,
  type FiltrosRelatorio,
  type IntervaloRelatorio,
} from "@/lib/relatorios/filtros";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export function dataDoCampo(titulo: Titulo, campo: CampoDataRelatorio): string | null {
  if (campo === "vencimento") return titulo.vencimento.slice(0, 10);
  if (campo === "emissao") return (titulo.emissao || titulo.vencimento).slice(0, 10);
  return titulo.dataPagamento ? titulo.dataPagamento.slice(0, 10) : null;
}

function passaConta(planoContaId: string | null, contas: string[]) {
  if (contas.length === 0) return true;
  if (!planoContaId) return contas.includes(CONTA_SEM_CLASSIFICACAO);
  return contas.includes(planoContaId);
}

function passaBusca(texto: string, q: string) {
  if (!q) return true;
  return texto.toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR"));
}

function passaSituacao(titulo: Titulo, situacao: FiltrosRelatorio["situacao"]) {
  if (situacao === "todos") return true;
  const efetivo = statusEfetivo(titulo);
  if (situacao === "pago") return titulo.status === "pago";
  if (situacao === "aberto") return efetivo === "aberto" || efetivo === "parcial";
  if (situacao === "vencido") return efetivo === "vencido";
  return titulo.status !== "pago" && titulo.status !== "cancelado" && titulo.vencimento >= hojeIso();
}

export function filtrarTitulos(
  titulos: Titulo[],
  filtros: FiltrosRelatorio,
  intervalo: IntervaloRelatorio,
): Titulo[] {
  return titulos.filter((titulo) => {
    if (titulo.status === "cancelado") return false;
    if (filtros.tipo !== "todos" && titulo.tipo !== filtros.tipo) return false;
    if (filtros.origem === "fixa" && !titulo.fixa) return false;
    if (filtros.origem === "avulso" && titulo.fixa) return false;
    if (!passaConta(titulo.planoContaId, filtros.contas)) return false;
    if (!passaSituacao(titulo, filtros.situacao)) return false;
    if (!passaBusca(`${titulo.contraparte} ${titulo.documento ?? ""}`, filtros.q)) return false;

    const data = dataDoCampo(titulo, filtros.campoData);
    if (!data) return false;
    return data >= intervalo.inicio && data <= intervalo.fim;
  });
}

export function filtrarLancamentos(
  lancamentos: Lancamento[],
  filtros: FiltrosRelatorio,
  intervalo: IntervaloRelatorio,
): Lancamento[] {
  return lancamentos.filter((lancamento) => {
    if (lancamento.origem === "integracao") return false;
    if (filtros.tipo === "pagar" && lancamento.tipo !== "saida") return false;
    if (filtros.tipo === "receber" && lancamento.tipo !== "entrada") return false;
    if (!passaConta(lancamento.planoContaId, filtros.contas)) return false;
    if (!passaBusca(`${lancamento.descricao} ${lancamento.contraparte ?? ""} ${lancamento.documento ?? ""}`, filtros.q)) {
      return false;
    }
    const data = lancamento.data.slice(0, 10);
    return data >= intervalo.inicio && data <= intervalo.fim;
  });
}

export function rotuloSituacaoTitulo(titulo: Titulo, tipo: Titulo["tipo"] = titulo.tipo) {
  const efetivo = statusEfetivo(titulo);
  if (efetivo === "pago") return tipo === "receber" ? "Recebido" : "Pago";
  if (efetivo === "vencido") return "Vencido";
  if (efetivo === "parcial") return "Parcial";
  if (efetivo === "cancelado") return "Cancelado";
  return "Em aberto";
}
