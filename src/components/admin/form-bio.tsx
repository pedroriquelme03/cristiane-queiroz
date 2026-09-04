"use client";

import Image from "next/image";
import { useActionState, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { salvarBio, uploadFotoBio, type EstadoBio } from "@/app/(app)/admin/bio/acoes";
import { IconeBio, OPCOES_ICONE } from "@/app/bio/icones";
import { CampoTexto } from "@/components/ui/campo";
import type { BioLink, BioPerfil, BioServico } from "@/lib/bio";

const ESTADO_INICIAL: EstadoBio = {};

const CLASSE_CONTROLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none";

/** Move um item da lista para cima/baixo. */
function mover<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

export function FormBio({ perfil }: { perfil: BioPerfil }) {
  const [estado, acao] = useActionState(salvarBio, ESTADO_INICIAL);
  const [servicos, setServicos] = useState<BioServico[]>(perfil.servicos);
  const [links, setLinks] = useState<BioLink[]>(perfil.links);
  const [fotoUrl, setFotoUrl] = useState<string | null>(perfil.fotoUrl);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  async function enviarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErroFoto(null);
    setEnviandoFoto(true);
    const dados = new FormData();
    dados.append("foto", arquivo);
    const resultado = await uploadFotoBio(dados);
    setEnviandoFoto(false);
    evento.target.value = "";
    if (resultado.ok && resultado.url) setFotoUrl(resultado.url);
    else setErroFoto(resultado.erro ?? "Não foi possível enviar a imagem.");
  }

  function atualizarServico(indice: number, campo: keyof BioServico, valor: string) {
    setServicos((atual) =>
      atual.map((s, i) => (i === indice ? ({ ...s, [campo]: valor } as BioServico) : s)),
    );
  }
  function atualizarLink(indice: number, campo: keyof BioLink, valor: string) {
    setLinks((atual) =>
      atual.map((l, i) => (i === indice ? ({ ...l, [campo]: valor } as BioLink) : l)),
    );
  }

  return (
    <form action={acao} className="space-y-8">
      {estado.ok ? (
        <Faixa tom="ok" texto="Bio salva. As alterações já valem na página /bio." />
      ) : estado.erro ? (
        <Faixa tom="info" texto={estado.erro} />
      ) : null}

      {/* Campos serializados */}
      <input type="hidden" name="fotoUrl" value={fotoUrl ?? ""} />
      <input type="hidden" name="servicos" value={JSON.stringify(servicos)} />
      <input type="hidden" name="links" value={JSON.stringify(links)} />

      {/* ------------------------------------------------------- Identidade */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Identidade</h2>
          <a
            href="/bio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            Ver página <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-muted">
            {fotoUrl ? (
              <Image
                src={fotoUrl}
                alt="Foto do perfil"
                width={80}
                height={80}
                className="size-20 object-cover"
                unoptimized
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {perfil.nome.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <div className="space-y-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-muted">
              {enviandoFoto ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {enviandoFoto ? "Enviando…" : fotoUrl ? "Trocar foto" : "Enviar foto"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="sr-only"
                onChange={enviarFoto}
                disabled={enviandoFoto}
              />
            </label>
            {fotoUrl ? (
              <button
                type="button"
                onClick={() => setFotoUrl(null)}
                className="ml-2 text-xs font-medium text-muted-foreground hover:text-negative"
              >
                Remover
              </button>
            ) : null}
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou AVIF · até 5 MB</p>
            {erroFoto ? <p className="text-xs text-negative">{erroFoto}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto id="nome" rotulo="Nome" required defaultValue={perfil.nome} erro={estado.campos?.nome} />
          <CampoTexto id="subtitulo" rotulo="Subtítulo" placeholder="Consultoria Financeira" defaultValue={perfil.subtitulo} erro={estado.campos?.subtitulo} />
        </div>
        <div>
          <label htmlFor="tagline" className="text-sm font-medium">Tagline</label>
          <textarea
            id="tagline"
            name="tagline"
            rows={2}
            defaultValue={perfil.tagline}
            className={`mt-1 ${CLASSE_CONTROLE}`}
          />
          {estado.campos?.tagline ? <p className="mt-1 text-xs text-negative">{estado.campos.tagline}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="whatsapp"
            rotulo="WhatsApp"
            required
            inputMode="numeric"
            placeholder="5545999316874"
            dica="Só números, com DDI (55) e DDD."
            defaultValue={perfil.whatsapp}
            erro={estado.campos?.whatsapp}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={perfil.ativo}
              className="size-4 rounded border-border"
            />
            Página publicada (visível ao público)
          </label>
        </div>
      </section>

      {/* -------------------------------------------------------- Serviços */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Serviços</h2>
            <p className="text-xs text-muted-foreground">Cartões dourados de destaque.</p>
          </div>
          <BotaoAdicionar
            onClick={() =>
              setServicos((atual) => [
                ...atual,
                { icone: "compass", titulo: "", texto: "", tipo: "whatsapp", valor: "" },
              ])
            }
          />
        </div>

        {estado.campos?.servicos ? <Faixa tom="info" texto={estado.campos.servicos} /> : null}

        {servicos.length === 0 ? (
          <Vazio texto="Nenhum serviço. Clique em Adicionar." />
        ) : (
          <ul className="space-y-3">
            {servicos.map((s, i) => (
              <li key={i} className="rounded-xl border border-border bg-surface-muted/40 p-4">
                <Cabecalho
                  indice={i}
                  total={servicos.length}
                  onCima={() => setServicos((a) => mover(a, i, i - 1))}
                  onBaixo={() => setServicos((a) => mover(a, i, i + 1))}
                  onRemover={() => setServicos((a) => a.filter((_, x) => x !== i))}
                />
                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <SelectIcone
                    valor={s.icone}
                    onChange={(v) => atualizarServico(i, "icone", v)}
                  />
                  <input
                    value={s.titulo}
                    onChange={(e) => atualizarServico(i, "titulo", e.target.value)}
                    placeholder="Título do serviço"
                    className={CLASSE_CONTROLE}
                  />
                </div>
                <input
                  value={s.texto}
                  onChange={(e) => atualizarServico(i, "texto", e.target.value)}
                  placeholder="Descrição curta (opcional)"
                  className={`mt-3 ${CLASSE_CONTROLE}`}
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
                  <select
                    value={s.tipo}
                    onChange={(e) => atualizarServico(i, "tipo", e.target.value)}
                    className={CLASSE_CONTROLE}
                  >
                    <option value="whatsapp">Abre WhatsApp</option>
                    <option value="url">Abre link</option>
                  </select>
                  <input
                    value={s.valor}
                    onChange={(e) => atualizarServico(i, "valor", e.target.value)}
                    placeholder={
                      s.tipo === "whatsapp"
                        ? "Mensagem que o cliente já envia"
                        : "https://… ou /pagina-interna"
                    }
                    className={CLASSE_CONTROLE}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------------- Links */}
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Links</h2>
            <p className="text-xs text-muted-foreground">Cartões com contorno (Instagram, site…).</p>
          </div>
          <BotaoAdicionar
            onClick={() =>
              setLinks((atual) => [
                ...atual,
                { icone: "globe", titulo: "", texto: "", url: "" },
              ])
            }
          />
        </div>

        {estado.campos?.links ? <Faixa tom="info" texto={estado.campos.links} /> : null}

        {links.length === 0 ? (
          <Vazio texto="Nenhum link. Clique em Adicionar." />
        ) : (
          <ul className="space-y-3">
            {links.map((l, i) => (
              <li key={i} className="rounded-xl border border-border bg-surface-muted/40 p-4">
                <Cabecalho
                  indice={i}
                  total={links.length}
                  onCima={() => setLinks((a) => mover(a, i, i - 1))}
                  onBaixo={() => setLinks((a) => mover(a, i, i + 1))}
                  onRemover={() => setLinks((a) => a.filter((_, x) => x !== i))}
                />
                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <SelectIcone valor={l.icone} onChange={(v) => atualizarLink(i, "icone", v)} />
                  <input
                    value={l.titulo}
                    onChange={(e) => atualizarLink(i, "titulo", e.target.value)}
                    placeholder="Título do link"
                    className={CLASSE_CONTROLE}
                  />
                </div>
                <input
                  value={l.texto}
                  onChange={(e) => atualizarLink(i, "texto", e.target.value)}
                  placeholder="Descrição curta (opcional)"
                  className={`mt-3 ${CLASSE_CONTROLE}`}
                />
                <input
                  value={l.url}
                  onChange={(e) => atualizarLink(i, "url", e.target.value)}
                  placeholder="https://… ou /pagina-interna"
                  className={`mt-3 ${CLASSE_CONTROLE}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/80 py-4 backdrop-blur">
        <Salvar />
      </div>
    </form>
  );
}

function SelectIcone({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        <IconeBio chave={valor} className="size-4" />
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Ícone"
        className={`${CLASSE_CONTROLE} sm:w-40`}
      >
        {OPCOES_ICONE.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

function Cabecalho({
  indice,
  total,
  onCima,
  onBaixo,
  onRemover,
}: {
  indice: number;
  total: number;
  onCima: () => void;
  onBaixo: () => void;
  onRemover: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">Item {indice + 1}</span>
      <div className="flex items-center gap-1">
        <BotaoIcone titulo="Mover para cima" onClick={onCima} disabled={indice === 0}>
          <ArrowUp className="size-4" aria-hidden />
        </BotaoIcone>
        <BotaoIcone titulo="Mover para baixo" onClick={onBaixo} disabled={indice === total - 1}>
          <ArrowDown className="size-4" aria-hidden />
        </BotaoIcone>
        <BotaoIcone titulo="Remover" onClick={onRemover} destrutivo>
          <Trash2 className="size-4" aria-hidden />
        </BotaoIcone>
      </div>
    </div>
  );
}

function BotaoIcone({
  titulo,
  onClick,
  disabled,
  destrutivo,
  children,
}: {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  destrutivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface disabled:opacity-30 ${
        destrutivo ? "hover:text-negative" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BotaoAdicionar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
    >
      <Plus className="size-3.5" aria-hidden />
      Adicionar
    </button>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
      {texto}
    </p>
  );
}

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-40"
    >
      {pending ? "Salvando…" : "Salvar alterações"}
    </button>
  );
}

function Faixa({ tom, texto }: { tom: "ok" | "info"; texto: string }) {
  const ok = tom === "ok";
  return (
    <div
      role="status"
      className={
        ok
          ? "flex items-start gap-2.5 rounded-lg border border-positive/20 bg-positive-soft px-3 py-2.5"
          : "flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5"
      }
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <p className={ok ? "text-sm text-positive" : "text-sm text-muted-foreground"}>{texto}</p>
    </div>
  );
}
