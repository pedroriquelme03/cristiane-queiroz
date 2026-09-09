"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";

import { cadastrarSegmento, type EstadoSegmento } from "@/app/(app)/admin/segmentos/acoes";
import { SEGMENTOS_CADASTRO } from "@/lib/segmentos";
import type { SegmentoOpcao } from "@/lib/dados-segmentos";
import { cn } from "@/lib/utils";

const ESTADO: EstadoSegmento = {};

export function SeletorSegmento({
  valorInicial = "servicos",
  segmentos,
  permitirCadastro = true,
}: {
  valorInicial?: string;
  /** Lista vinda do banco; se omitida, usa o padrão estático. */
  segmentos?: SegmentoOpcao[];
  /** Exibe opção para cadastrar novo segmento. */
  permitirCadastro?: boolean;
}) {
  const router = useRouter();
  const iniciais = segmentos?.length ? segmentos : SEGMENTOS_CADASTRO;
  const [lista, setLista] = useState<SegmentoOpcao[]>(iniciais);
  const [aberto, setAberto] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [valor, setValor] = useState(valorInicial);
  const [estado, acao] = useActionState(cadastrarSegmento, ESTADO);
  const raizRef = useRef<HTMLDivElement>(null);
  const opcoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const selecionado = lista.find((segmento) => segmento.valor === valor) ?? lista[0];

  useEffect(() => {
    if (segmentos?.length) setLista(segmentos);
  }, [segmentos]);

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (!raizRef.current?.contains(event.target as Node)) {
        setAberto(false);
        setCadastrando(false);
      }
    }

    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  useEffect(() => {
    if (estado.ok && estado.valor && estado.rotulo) {
      setLista((atual) => {
        if (atual.some((item) => item.valor === estado.valor)) return atual;
        return [...atual, { valor: estado.valor!, rotulo: estado.rotulo! }].sort((a, b) =>
          a.rotulo.localeCompare(b.rotulo, "pt-BR"),
        );
      });
      setValor(estado.valor);
      setCadastrando(false);
      setAberto(false);
      router.refresh();
    }
  }, [estado, router]);

  function selecionar(novoValor: string) {
    setValor(novoValor);
    setAberto(false);
    setCadastrando(false);
  }

  function moverFoco(indice: number) {
    const destino = (indice + lista.length) % lista.length;
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
        onClick={() => {
          setAberto((atual) => !atual);
          setCadastrando(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setAberto(true);
            const indice = lista.findIndex((segmento) => segmento.valor === valor);
            requestAnimationFrame(() => moverFoco(event.key === "ArrowDown" ? indice : indice - 1));
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors hover:border-brand/60 focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <span id="segmento-valor">{selecionado?.rotulo ?? "Selecione"}</span>
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
          <div className="max-h-56 overflow-y-auto">
            {lista.map((segmento, indice) => {
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

          {permitirCadastro ? (
            <div className="border-t border-border p-1 pt-1.5">
              {cadastrando ? (
                <form action={acao} className="space-y-2 p-1.5">
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Novo segmento / serviço
                    <input
                      name="rotulo"
                      required
                      autoFocus
                      minLength={2}
                      maxLength={80}
                      placeholder="Ex.: Consultoria, Saúde, Educação"
                      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </label>
                  {estado.erro ? <p className="text-xs text-negative">{estado.erro}</p> : null}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCadastrando(false)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground"
                    >
                      Cadastrar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCadastrando(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-brand hover:bg-brand-soft"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Cadastrar novo segmento
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
