"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { SEGMENTOS_CADASTRO } from "@/lib/segmentos";
import { cn } from "@/lib/utils";

const SEGMENTOS = SEGMENTOS_CADASTRO;

export function SeletorSegmento({ valorInicial = "hotelaria" }: { valorInicial?: string }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(valorInicial);
  const raizRef = useRef<HTMLDivElement>(null);
  const opcoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const selecionado = SEGMENTOS.find((segmento) => segmento.valor === valor) ?? SEGMENTOS[0];

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (!raizRef.current?.contains(event.target as Node)) setAberto(false);
    }

    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  function selecionar(novoValor: string) {
    setValor(novoValor);
    setAberto(false);
  }

  function moverFoco(indice: number) {
    const destino = (indice + SEGMENTOS.length) % SEGMENTOS.length;
    opcoesRef.current[destino]?.focus();
  }

  return (
    <div ref={raizRef} className="relative">
      <label id="segmento-label" className="mb-1 block text-sm font-medium">
        Segmento *
      </label>
      <input type="hidden" name="segmento" value={valor} />
      <button
        type="button"
        aria-labelledby="segmento-label segmento-valor"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls="segmento-opcoes"
        onClick={() => setAberto((atual) => !atual)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setAberto(true);
            const indice = SEGMENTOS.findIndex((segmento) => segmento.valor === valor);
            requestAnimationFrame(() => moverFoco(event.key === "ArrowDown" ? indice : indice - 1));
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors hover:border-brand/60 focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <span id="segmento-valor">{selecionado.rotulo}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div
          id="segmento-opcoes"
          role="listbox"
          aria-labelledby="segmento-label"
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-xl shadow-black/20"
        >
          {SEGMENTOS.map((segmento, indice) => {
            const ativo = segmento.valor === valor;
            return (
              <button
                key={segmento.valor}
                ref={(elemento) => {
                  opcoesRef.current[indice] = elemento;
                }}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => selecionar(segmento.valor)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moverFoco(indice + 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moverFoco(indice - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    moverFoco(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    moverFoco(SEGMENTOS.length - 1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setAberto(false);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors",
                  ativo
                    ? "bg-brand-soft text-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground focus:bg-surface-muted focus:text-foreground",
                )}
              >
                <span>{segmento.rotulo}</span>
                {ativo ? <Check className="size-4 text-brand" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
