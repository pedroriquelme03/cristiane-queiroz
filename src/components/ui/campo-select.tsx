"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export interface OpcaoCampoSelect {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

export function CampoSelect({
  id,
  name,
  rotulo,
  opcoes,
  erro,
  dica,
  className,
  defaultValue = "",
  disabled,
  required,
  pesquisavel = false,
}: {
  id: string;
  name?: string;
  rotulo: string;
  opcoes: OpcaoCampoSelect[];
  erro?: string;
  dica?: string;
  className?: string;
  defaultValue?: string | number | readonly string[];
  disabled?: boolean;
  required?: boolean;
  pesquisavel?: boolean;
}) {
  const valorInicial = Array.isArray(defaultValue)
    ? String(defaultValue[0] ?? "")
    : String(defaultValue ?? "");
  const [valor, setValor] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const [portalAlvo, setPortalAlvo] = useState<HTMLElement | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const opcoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const listaId = useId();
  const selecionada = opcoes.find((opcao) => opcao.valor === valor) ?? opcoes[0];
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = termo
    ? opcoes.filter((opcao) =>
        `${opcao.rotulo} ${opcao.detalhe ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo),
      )
    : opcoes;

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      const alvo = event.target as Node;
      if (!raizRef.current?.contains(alvo) && !menuRef.current?.contains(alvo)) {
        setAberto(false);
        setBusca("");
      }
    }

    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  useLayoutEffect(() => {
    if (!aberto) return;

    // Dentro de <dialog showModal()>, o portal precisa ficar no próprio dialog
    // (top layer); em document.body o menu fica atrás do backdrop.
    setPortalAlvo(botaoRef.current?.closest("dialog") ?? document.body);

    function posicionar() {
      const botao = botaoRef.current;
      if (!botao) return;
      const retangulo = botao.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - retangulo.bottom - 12;
      const espacoAcima = retangulo.top - 12;
      const abrirAcima = espacoAbaixo < 220 && espacoAcima > espacoAbaixo;
      const maxHeight = Math.max(160, Math.min(320, abrirAcima ? espacoAcima : espacoAbaixo));

      setPosicao({
        top: abrirAcima ? retangulo.top - maxHeight - 6 : retangulo.bottom + 6,
        left: Math.max(8, Math.min(retangulo.left, window.innerWidth - retangulo.width - 8)),
        width: retangulo.width,
        maxHeight,
      });
    }

    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    requestAnimationFrame(() => {
      if (pesquisavel) buscaRef.current?.focus();
      else opcoesRef.current[Math.max(0, filtradas.findIndex((opcao) => opcao.valor === valor))]?.focus();
    });
  }, [aberto, pesquisavel, filtradas, valor]);

  function selecionar(novoValor: string) {
    setValor(novoValor);
    setAberto(false);
    setBusca("");
    requestAnimationFrame(() => botaoRef.current?.focus());
  }

  return (
    <div ref={raizRef} className={className}>
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">{rotulo}</label>
      <input type="hidden" name={name ?? id} value={valor} required={required} disabled={disabled} />
      <button
        ref={botaoRef}
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}-valor`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-describedby={erro ? `${id}-erro` : undefined}
        disabled={disabled}
        onClick={() => {
          if (aberto) setBusca("");
          setAberto((atual) => !atual);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setAberto(true);
          } else if (event.key === "Escape") {
            setAberto(false);
            setBusca("");
          }
        }}
        className={cn(
          "mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors hover:border-brand/60 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50",
          erro ? "border-negative" : "border-border",
        )}
      >
        <span id={`${id}-valor`} className="min-w-0 truncate">
          {selecionada?.detalhe ? <span className="mr-2 font-mono text-xs text-muted-foreground">{selecionada.detalhe}</span> : null}
          <span>{selecionada?.rotulo ?? "Selecione"}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>

      {erro ? <p id={`${id}-erro`} className="mt-1 text-xs text-negative">{erro}</p> : dica ? <p className="mt-1 text-xs text-muted-foreground">{dica}</p> : null}

      {aberto && portalAlvo ? createPortal(
        <div
          ref={menuRef}
          id={listaId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          style={{ top: posicao.top, left: posicao.left, width: posicao.width, maxHeight: posicao.maxHeight }}
          className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-xl shadow-black/30"
        >
          {pesquisavel ? (
            <div className="relative mb-1 border-b border-border p-1 pb-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
              <input
                ref={buscaRef}
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setAberto(false);
                    setBusca("");
                  }
                  if (event.key === "Enter" && filtradas.length === 1) {
                    event.preventDefault();
                    selecionar(filtradas[0].valor);
                  }
                }}
                placeholder="Buscar por nome ou código"
                aria-label={`Buscar em ${rotulo}`}
                className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          ) : null}
          {pesquisavel && filtradas.length ? (
            <div className="flex gap-3 px-2.5 py-1 text-[10px] font-medium uppercase text-muted-foreground">
              <span className="w-14 shrink-0">Código</span>
              <span>Conta</span>
            </div>
          ) : null}
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {filtradas.length ? filtradas.map((opcao, indice) => {
              const ativa = opcao.valor === valor;
              return (
                <button
                  key={opcao.valor}
                  ref={(elemento) => { opcoesRef.current[indice] = elemento; }}
                  type="button"
                  role="option"
                  aria-selected={ativa}
                  onClick={() => selecionar(opcao.valor)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const passo = event.key === "ArrowDown" ? 1 : -1;
                      opcoesRef.current[(indice + passo + filtradas.length) % filtradas.length]?.focus();
                    } else if (event.key === "Home" || event.key === "End") {
                      event.preventDefault();
                      opcoesRef.current[event.key === "Home" ? 0 : filtradas.length - 1]?.focus();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setAberto(false);
                      botaoRef.current?.focus();
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors",
                    ativa ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground focus:bg-surface-muted focus:text-foreground",
                  )}
                >
                  {pesquisavel ? <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{opcao.detalhe}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{opcao.rotulo}</span>
                  {ativa ? <Check className="size-4 shrink-0 text-brand" aria-hidden /> : null}
                </button>
              );
            }) : <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
          </div>
        </div>,
        portalAlvo,
      ) : null}
    </div>
  );
}
