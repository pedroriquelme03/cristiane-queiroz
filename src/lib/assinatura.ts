/**
 * Lógica pura de estado da assinatura. Espelha empresa_bloqueada() e
 * recalcular_status_assinatura() da migration 0005 — o banco é a autoridade,
 * mas o cálculo precisa existir aqui para o guarda de acesso e as telas.
 *
 * Nada de I/O: recebe assinatura + faturas e devolve o estado. Testado em
 * scripts/verifica-assinatura.mts.
 */
import type {
  Assinatura,
  EstadoAssinatura,
  Fatura,
  StatusAssinatura,
  StatusFaturaEfetivo,
} from "@/lib/types";

const hojeIso = () => new Date().toISOString().slice(0, 10);

/** Dias entre duas datas ISO (a - b). Positivo quando a > b. */
function diasEntre(a: string, b: string) {
  const ma = Date.parse(`${a}T00:00:00Z`);
  const mb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((ma - mb) / 86_400_000);
}

/** Status efetivo da fatura: "vencida" é derivado, nunca armazenado. */
export function statusFaturaEfetivo(
  fatura: Fatura,
  hoje = hojeIso(),
): StatusFaturaEfetivo {
  if (fatura.status === "paga" || fatura.status === "cancelada") return fatura.status;
  return fatura.vencimento < hoje ? "vencida" : "aberta";
}

const emAberto = (f: Fatura) => f.status === "aberta";
const saldo = (f: Fatura) => f.valor - f.valorPago;

/**
 * Calcula o estado da assinatura de uma empresa.
 *
 * Bloqueio acontece quando:
 *   - o super admin bloqueou manualmente, ou
 *   - a assinatura está cancelada, ou
 *   - há fatura em aberto vencida há mais dias do que a carência.
 *
 * Entre o vencimento e o fim da carência a empresa fica "inadimplente" mas
 * ainda acessa o sistema (emCarencia = true).
 */
export function calcularEstado(
  assinatura: Assinatura,
  faturas: Fatura[],
  hoje = hojeIso(),
): EstadoAssinatura {
  const abertas = faturas
    .filter(emAberto)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  const vencidas = abertas.filter((f) => f.vencimento < hoje);
  const totalEmAberto = abertas.reduce((s, f) => s + saldo(f), 0);

  // A vencida mais antiga define o atraso e a régua de bloqueio
  const maisAntiga = vencidas[0] ?? null;
  const diasAtraso = maisAntiga ? diasEntre(hoje, maisAntiga.vencimento) : 0;

  const cancelada = assinatura.status === "cancelada" || assinatura.canceladaEm !== null;
  const bloqueadaPorAtraso = diasAtraso > assinatura.carenciaDias;
  const bloqueada = assinatura.bloqueioManual || cancelada || bloqueadaPorAtraso;

  const emCarencia = diasAtraso > 0 && !bloqueada;
  const diasParaBloqueio =
    emCarencia ? assinatura.carenciaDias - diasAtraso : null;

  return {
    empresaId: assinatura.empresaId,
    status: derivarStatus(assinatura, { temVencida: vencidas.length > 0, bloqueada }, hoje),
    bloqueada,
    emCarencia,
    diasAtraso,
    diasParaBloqueio,
    faturaEmAberto: abertas[0] ?? null,
    totalEmAberto,
  };
}

function derivarStatus(
  assinatura: Assinatura,
  ctx: { temVencida: boolean; bloqueada: boolean },
  hoje: string,
): StatusAssinatura {
  if (assinatura.status === "cancelada" || assinatura.canceladaEm !== null) {
    return "cancelada";
  }
  if (assinatura.bloqueioManual || ctx.bloqueada) return "bloqueada";
  if (ctx.temVencida) return "inadimplente";
  if (assinatura.trialFim !== null && assinatura.trialFim >= hoje) return "trial";
  return "ativa";
}

// ---------------------------------------------------------------------------
// Rótulos e tons para a UI
// ---------------------------------------------------------------------------

export const ROTULO_STATUS: Record<StatusAssinatura, string> = {
  trial: "Período de teste",
  ativa: "Ativa",
  inadimplente: "Pagamento em atraso",
  bloqueada: "Acesso bloqueado",
  cancelada: "Cancelada",
};

export const TOM_STATUS: Record<
  StatusAssinatura,
  "positivo" | "negativo" | "atencao" | "marca" | "neutro"
> = {
  trial: "marca",
  ativa: "positivo",
  inadimplente: "atencao",
  bloqueada: "negativo",
  cancelada: "neutro",
};

export const ROTULO_STATUS_FATURA: Record<StatusFaturaEfetivo, string> = {
  aberta: "Em aberto",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const TOM_STATUS_FATURA: Record<
  StatusFaturaEfetivo,
  "positivo" | "negativo" | "atencao" | "neutro"
> = {
  aberta: "atencao",
  vencida: "negativo",
  paga: "positivo",
  cancelada: "neutro",
};

/** Preço do plano no ciclo escolhido, já considerando anual cheio. */
export function precoNoCiclo(
  plano: { precoMensal: number; precoAnual: number | null },
  ciclo: "mensal" | "anual",
) {
  if (ciclo === "anual") return plano.precoAnual ?? plano.precoMensal * 12;
  return plano.precoMensal;
}

/** Economia percentual do anual sobre 12x o mensal (0 se não houver anual). */
export function economiaAnual(plano: { precoMensal: number; precoAnual: number | null }) {
  if (!plano.precoAnual || plano.precoMensal === 0) return 0;
  const cheio = plano.precoMensal * 12;
  return Math.round(((cheio - plano.precoAnual) / cheio) * 100);
}
