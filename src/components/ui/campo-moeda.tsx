"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type CodigoMoeda = "BRL" | "USD" | "EUR";

const MOEDAS: {
  codigo: CodigoMoeda;
  rotulo: string;
  locale: string;
}[] = [
  { codigo: "BRL", rotulo: "R$ — Real", locale: "pt-BR" },
  { codigo: "USD", rotulo: "US$ — Dólar", locale: "en-US" },
  { codigo: "EUR", rotulo: "€ — Euro", locale: "de-DE" },
];

function formatarCentavos(centavos: number, codigo: CodigoMoeda, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: codigo,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

function paraCentavos(valor: number | string | null | undefined): number {
  if (valor == null || valor === "") return 0;
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? Math.round(Math.abs(valor) * 100) : 0;
  }

  const digitos = String(valor).replace(/\D/g, "");
  return digitos ? Number(digitos) : 0;
}

export function CampoMoeda({
  id,
  name = "valor",
  rotulo,
  erro,
  dica,
  required,
  defaultValue,
  defaultMoeda = "BRL",
  className,
}: {
  id: string;
  name?: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  defaultMoeda?: CodigoMoeda;
  className?: string;
}) {
  const [moeda, setMoeda] = useState<CodigoMoeda>(defaultMoeda);
  const [centavos, setCentavos] = useState(() => paraCentavos(defaultValue));

  const locale = useMemo(
    () => MOEDAS.find((item) => item.codigo === moeda)?.locale ?? "pt-BR",
    [moeda],
  );

  const exibicao = formatarCentavos(centavos, moeda, locale);
  // Valor enviado no submit: número com ponto decimal (parseValor / Number-friendly)
  const valorEnvio = (centavos / 100).toFixed(2);

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>

      <div className="mt-1 flex gap-2">
        <select
          name="moeda"
          aria-label="Moeda"
          value={moeda}
          onChange={(evento) => setMoeda(evento.target.value as CodigoMoeda)}
          className={cn(
            "w-[9.5rem] shrink-0 rounded-lg border bg-surface px-2.5 py-2 text-sm",
            "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
            erro ? "border-negative" : "border-border",
          )}
        >
          {MOEDAS.map((item) => (
            <option key={item.codigo} value={item.codigo}>
              {item.rotulo}
            </option>
          ))}
        </select>

        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          required={required}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          value={exibicao}
          onChange={(evento) => setCentavos(paraCentavos(evento.currentTarget.value))}
          onFocus={(evento) => evento.currentTarget.select()}
          className={cn(
            "w-full rounded-lg border bg-surface px-3 py-2 text-sm tabular",
            "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
            erro ? "border-negative" : "border-border",
          )}
        />
      </div>

      {/* Campo real do formulário — número limpo para o servidor */}
      <input type="hidden" name={name} value={valorEnvio} />

      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-negative">
          {erro}
        </p>
      ) : dica ? (
        <p className="mt-1 text-xs text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}
