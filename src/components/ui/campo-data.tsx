"use client";

import { useState } from "react";

import { brParaIso, digitosParaBr, isoParaBr, somenteDigitosData } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Campo de data no padrão brasileiro dd/mm/aaaa.
 * Mostra e edita em dd/mm/aaaa; envia ISO (aaaa-mm-dd) no submit.
 */
export function CampoData({
  id,
  name,
  rotulo,
  erro,
  dica,
  required,
  defaultValue,
  className,
}: {
  id: string;
  name: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  required?: boolean;
  /** ISO aaaa-mm-dd ou dd/mm/aaaa */
  defaultValue?: string | null;
  className?: string;
}) {
  const [exibicao, setExibicao] = useState(() =>
    defaultValue ? isoParaBr(defaultValue) || String(defaultValue) : "",
  );
  const iso = brParaIso(exibicao) ?? "";

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        required={required}
        pattern={required ? "\\d{2}/\\d{2}/\\d{4}" : undefined}
        title="Use o formato dd/mm/aaaa"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        value={exibicao}
        onChange={(evento) => {
          const digitos = somenteDigitosData(evento.currentTarget.value).slice(0, 8);
          setExibicao(digitosParaBr(digitos));
        }}
        onBlur={() => {
          const normalizado = brParaIso(exibicao);
          if (normalizado) setExibicao(isoParaBr(normalizado));
        }}
        className={cn(
          "mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm tabular",
          "focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none",
          "placeholder:text-muted-foreground/70",
          erro ? "border-negative" : "border-border",
        )}
      />
      <input type="hidden" name={name} value={iso} />
      {erro ? (
        <p id={`${id}-erro`} className="mt-1 text-xs text-negative">
          {erro}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{dica ?? "Formato: dd/mm/aaaa"}</p>
      )}
    </div>
  );
}
