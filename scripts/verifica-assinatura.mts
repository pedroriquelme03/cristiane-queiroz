import { calcularEstado, precoNoCiclo, economiaAnual } from "@/lib/assinatura";
import type { Assinatura, Fatura } from "@/lib/types";

let falhas = 0;
const check = (rotulo: string, obtido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok   " : "FALHA"} ${rotulo} -> ${JSON.stringify(obtido)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
};

const HOJE = "2026-07-19";
const iso = (dias: number) => {
  const d = new Date(`${HOJE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const base: Assinatura = {
  id: "a1", empresaId: "e1", planoId: "p1", ciclo: "mensal", status: "ativa",
  diaVencimento: 5, carenciaDias: 7, inicio: "2025-01-01", trialFim: null,
  bloqueioManual: false, canceladaEm: null,
};

const fatura = (venc: number, status: Fatura["status"] = "aberta"): Fatura => ({
  id: `f${venc}`, assinaturaId: "a1", empresaId: "e1", competencia: "2026-07-01",
  emissao: iso(venc - 10), vencimento: iso(venc), valor: 597,
  valorPago: status === "paga" ? 597 : 0, status,
  pagoEm: status === "paga" ? iso(venc) : null, metodoPagamento: null,
  referenciaExterna: null, observacao: null,
});

console.log("--- estado da assinatura (carência 7 dias) ---");

// Em dia: fatura a vencer
let e = calcularEstado(base, [fatura(9)], HOJE);
check("a vencer: status", e.status, "ativa");
check("a vencer: bloqueada", e.bloqueada, false);
check("a vencer: emCarencia", e.emCarencia, false);

// Vencida há 3 dias: inadimplente, em carência, ainda acessa
e = calcularEstado(base, [fatura(-3)], HOJE);
check("vencida 3d: status", e.status, "inadimplente");
check("vencida 3d: bloqueada", e.bloqueada, false);
check("vencida 3d: emCarencia", e.emCarencia, true);
check("vencida 3d: diasAtraso", e.diasAtraso, 3);
check("vencida 3d: diasParaBloqueio", e.diasParaBloqueio, 4);

// Vencida exatamente na carência (7 dias): ainda não bloqueia
e = calcularEstado(base, [fatura(-7)], HOJE);
check("vencida 7d (=carência): bloqueada", e.bloqueada, false);
check("vencida 7d: diasParaBloqueio", e.diasParaBloqueio, 0);

// Vencida há 8 dias: passou da carência -> bloqueada
e = calcularEstado(base, [fatura(-8)], HOJE);
check("vencida 8d: status", e.status, "bloqueada");
check("vencida 8d: bloqueada", e.bloqueada, true);
check("vencida 8d: emCarencia", e.emCarencia, false);

// Bloqueio manual sobrepõe faturas em dia
e = calcularEstado({ ...base, bloqueioManual: true }, [fatura(9)], HOJE);
check("bloqueio manual: status", e.status, "bloqueada");
check("bloqueio manual: bloqueada", e.bloqueada, true);

// Cancelada
e = calcularEstado({ ...base, canceladaEm: iso(-30) }, [fatura(9)], HOJE);
check("cancelada: status", e.status, "cancelada");
check("cancelada: bloqueada", e.bloqueada, true);

// Trial
e = calcularEstado({ ...base, trialFim: iso(5) }, [fatura(20)], HOJE);
check("trial: status", e.status, "trial");
check("trial: bloqueada", e.bloqueada, false);

// Tudo pago: ativa, sem aberto
e = calcularEstado(base, [fatura(-30, "paga"), fatura(-60, "paga")], HOJE);
check("tudo pago: status", e.status, "ativa");
check("tudo pago: totalEmAberto", e.totalEmAberto, 0);
check("tudo pago: faturaEmAberto", e.faturaEmAberto, null);

// Duas vencidas: usa a mais antiga para o atraso
e = calcularEstado(base, [fatura(-3), fatura(-10)], HOJE);
check("duas vencidas: diasAtraso (mais antiga)", e.diasAtraso, 10);
check("duas vencidas: bloqueada", e.bloqueada, true);
check("duas vencidas: totalEmAberto", e.totalEmAberto, 1194);

console.log("\n--- preço e economia ---");
const plano = { precoMensal: 597, precoAnual: 5970 };
check("preço mensal", precoNoCiclo(plano, "mensal"), 597);
check("preço anual", precoNoCiclo(plano, "anual"), 5970);
check("economia anual %", economiaAnual(plano), 17);
check("sem anual: cai no mensal x12", precoNoCiclo({ precoMensal: 100, precoAnual: null }, "anual"), 1200);
check("sem anual: economia 0", economiaAnual({ precoMensal: 100, precoAnual: null }), 0);

console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
