"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const OPCOES = [
  { valor: "light", rotulo: "Claro", Icone: Sun },
  { valor: "dark", rotulo: "Escuro", Icone: Moon },
  { valor: "system", rotulo: "Sistema", Icone: Monitor },
] as const;

/** Nunca muda; só distingue render do servidor (false) do cliente (true). */
const assinarNada = () => () => {};

export function SeletorTema() {
  const { theme, setTheme } = useTheme();

  // No servidor não dá para saber qual tema está ativo. Só marcamos a opção
  // selecionada depois da hidratação, senão o HTML renderizado não bate com o
  // que o script do next-themes já aplicou no <html>.
  const montado = useSyncExternalStore(
    assinarNada,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const ativo = montado && theme === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={rotulo}
            title={rotulo}
            onClick={() => setTheme(valor)}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors",
              ativo
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
