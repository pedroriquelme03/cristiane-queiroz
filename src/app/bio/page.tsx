import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getBioPerfil } from "@/lib/bio";

import { Revelar } from "../apresentacao/revelar";
import { IconeBio } from "./icones";
import { WhatsAppIcon } from "./whatsapp-icon";

export const metadata: Metadata = {
  title: "Cristiane Queiroz | Consultoria Financeira",
  description:
    "Consultoria financeira e plataforma de gestão para empresas que querem decidir com clareza. Fale com a Cristiane Queiroz.",
};

// O conteúdo é editável no admin e lido do banco a cada acesso.
export const dynamic = "force-dynamic";

const wa = (numero: string, texto: string) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

/** Duas iniciais para o monograma de fallback quando não há foto. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const letras = (partes[0]?.[0] ?? "") + (partes.at(-1)?.[0] ?? "");
  return letras.toUpperCase() || "CQ";
}

export default async function BioPage() {
  const perfil = await getBioPerfil();

  return (
    <main className="bio-root min-h-dvh w-full">
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 pb-16 pt-14">
        {/* -------------------------------------------------------- Perfil */}
        <Revelar className="flex flex-col items-center text-center">
          <span className="bio-avatar-ring grid size-28 place-items-center rounded-full">
            {perfil.fotoUrl ? (
              <Image
                src={perfil.fotoUrl}
                alt={perfil.nome}
                width={112}
                height={112}
                className="size-[6.2rem] rounded-full object-cover"
                priority
                unoptimized
              />
            ) : (
              <span className="grid size-[6.2rem] place-items-center rounded-full bg-[#0b2b34] font-serif text-4xl font-semibold tracking-tight text-[#e3c37f]">
                {iniciais(perfil.nome)}
              </span>
            )}
          </span>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#f5efe2]">
            {perfil.nome}
          </h1>
          {perfil.subtitulo ? (
            <p className="mt-1 text-sm font-medium uppercase tracking-[0.18em] text-[#c8a256]">
              {perfil.subtitulo}
            </p>
          ) : null}
          {perfil.tagline ? (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#c9d4d8]">
              {perfil.tagline}
            </p>
          ) : null}
        </Revelar>

        {/* ------------------------------------------- Destaque: WhatsApp */}
        <Revelar delay={80} className="mt-8 w-full">
          <a
            href={wa(
              perfil.whatsapp,
              `Olá ${perfil.nome}! Vim pela sua bio e quero falar sobre a consultoria financeira.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="bio-card-whats group flex items-center gap-4 rounded-2xl px-5 py-4"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/15">
              <WhatsAppIcon className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Fale comigo no WhatsApp</span>
              <span className="mt-0.5 block text-sm text-black/70">
                Atendimento direto · responde rápido
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              Chamar
            </span>
          </a>
        </Revelar>

        {/* ------------------------------------------------------ Serviços */}
        {perfil.servicos.length > 0 ? (
          <>
            <p className="mt-9 self-start text-xs font-semibold uppercase tracking-[0.22em] text-[#a9805a]">
              Serviços
            </p>
            <div className="mt-3 flex w-full flex-col gap-3">
              {perfil.servicos.map((s, i) => {
                const href = s.tipo === "whatsapp" ? wa(perfil.whatsapp, s.valor) : s.valor;
                const externo = href.startsWith("http");
                const conteudo = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/10">
                      <IconeBio chave={s.icone} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">{s.titulo}</span>
                      {s.texto ? (
                        <span className="mt-0.5 block text-sm text-[#3a2b0f]/70">
                          {s.texto}
                        </span>
                      ) : null}
                    </span>
                    <ArrowUpRight className="size-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </>
                );
                const classe =
                  "bio-card-gold group flex items-center gap-3.5 rounded-2xl px-4 py-3.5";
                return (
                  <Revelar as="div" key={`${s.titulo}-${i}`} delay={i * 60}>
                    {externo ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className={classe}>
                        {conteudo}
                      </a>
                    ) : (
                      <Link href={href} className={classe}>
                        {conteudo}
                      </Link>
                    )}
                  </Revelar>
                );
              })}
            </div>
          </>
        ) : null}

        {/* --------------------------------------------------------- Links */}
        {perfil.links.length > 0 ? (
          <>
            <p className="mt-9 self-start text-xs font-semibold uppercase tracking-[0.22em] text-[#a9805a]">
              Links
            </p>
            <div className="mt-3 flex w-full flex-col gap-3">
              {perfil.links.map((l, i) => {
                const externo = l.url.startsWith("http");
                const conteudo = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c8a256]/12 text-[#d9b874]">
                      <IconeBio chave={l.icone} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug text-[#f2ead9]">
                        {l.titulo}
                      </span>
                      {l.texto ? (
                        <span className="mt-0.5 block text-sm text-[#9fb0b6]">{l.texto}</span>
                      ) : null}
                    </span>
                    <ArrowUpRight className="size-5 shrink-0 text-[#7d939a] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </>
                );
                const classe =
                  "bio-card-outline group flex items-center gap-3.5 rounded-2xl px-4 py-3.5";
                return (
                  <Revelar as="div" key={`${l.titulo}-${i}`} delay={i * 60}>
                    {externo ? (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className={classe}>
                        {conteudo}
                      </a>
                    ) : (
                      <Link href={l.url} className={classe}>
                        {conteudo}
                      </Link>
                    )}
                  </Revelar>
                );
              })}
            </div>
          </>
        ) : null}

        {/* -------------------------------------------------------- Rodapé */}
        <p className="mt-12 text-center text-xs text-[#7d939a]">
          © {new Date().getFullYear()} {perfil.nome} · {perfil.subtitulo}
          <br />
          Foz do Iguaçu · PR
        </p>
      </div>
    </main>
  );
}
