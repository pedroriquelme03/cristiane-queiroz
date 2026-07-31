import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  Compass,
  FileText,
  Gauge,
  GraduationCap,
  Handshake,
  LogIn,
  Quote,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Video,
  Wallet,
} from "lucide-react";

import { getPlanosPublicos } from "@/lib/dados-assinatura";
import type { Plano } from "@/lib/types";

import { CabecalhoSite } from "./cabecalho-site";
import { PlanosSite } from "./planos-site";
import { Revelar } from "./revelar";

export const metadata: Metadata = {
  title: "CQ Consultoria Financeira — Gestão financeira que vira decisão",
  description:
    "Consultoria e plataforma da Cristiane Queiroz: fluxo de caixa, DRE gerencial, indicadores, diagnóstico e plano de ação para a sua empresa crescer com clareza.",
};

// A leitura dos planos usa cookies (cliente Supabase por request), então a
// página é dinâmica — sempre reflete o que está cadastrado no banco.
export const dynamic = "force-dynamic";

const RECURSOS = [
  {
    icone: Gauge,
    titulo: "Dashboard executivo",
    texto:
      "Saldo, faturamento, resultado e margem do mês em uma tela só, atualizados a cada lançamento.",
  },
  {
    icone: Wallet,
    titulo: "Fluxo de caixa",
    texto:
      "Entradas, saídas e saldo acumulado com projeção de contas a pagar e a receber.",
  },
  {
    icone: TrendingUp,
    titulo: "DRE gerencial",
    texto:
      "Demonstrativo de resultados por competência, comparando previsto e realizado.",
  },
  {
    icone: Receipt,
    titulo: "Contas a pagar e receber",
    texto:
      "Títulos, vencimentos e inadimplência sob controle, com alertas do que está no vermelho.",
  },
  {
    icone: Target,
    titulo: "Indicadores e metas",
    texto:
      "KPIs por segmento acompanhados contra a meta, mês a mês, sem planilha manual.",
  },
  {
    icone: Compass,
    titulo: "Diagnóstico e maturidade",
    texto:
      "Avaliação das áreas do negócio para enxergar onde estão os gargalos e o potencial.",
  },
  {
    icone: ClipboardList,
    titulo: "Plano de ação",
    texto:
      "Do diagnóstico à execução: responsáveis, prazos, prioridades e impacto estimado.",
  },
  {
    icone: FileText,
    titulo: "Documentos e reuniões",
    texto:
      "Relatórios, atas e treinamentos organizados em um só lugar, acessíveis quando precisar.",
  },
];

const ENGLOBA = [
  {
    icone: Compass,
    titulo: "Diagnóstico completo",
    texto:
      "Mapeamos financeiro, comercial, processos e gestão para entender o momento real da empresa.",
  },
  {
    icone: ClipboardList,
    titulo: "Plano de ação sob medida",
    texto:
      "Prioridades claras, com responsáveis e prazos, focadas no que move o resultado.",
  },
  {
    icone: Handshake,
    titulo: "Acompanhamento consultivo",
    texto:
      "Reuniões periódicas com a Cristiane e time para ajustar a rota e sustentar a evolução.",
  },
  {
    icone: GraduationCap,
    titulo: "Capacitação da equipe",
    texto:
      "Treinamentos que deixam a gestão financeira rodando com autonomia dentro da empresa.",
  },
];

const AVALIACOES = [
  {
    nome: "Marina Alves",
    cargo: "Sócia — Rede Bonavita (exemplo)",
    texto:
      "Em seis meses saímos do caixa no escuro para decisões baseadas em número. A margem cresceu e a equipe entendeu o porquê de cada gasto.",
  },
  {
    nome: "Rafael Nogueira",
    cargo: "Diretor — Grupo Meridiano (exemplo)",
    texto:
      "O diagnóstico apontou gargalos que a gente nem via. O plano de ação virou rotina e hoje acompanho tudo pelo painel.",
  },
  {
    nome: "Juliana Prado",
    cargo: "CEO — Studio Aurora (exemplo)",
    texto:
      "A consultoria da Cristiane uniu método e ferramenta. Parei de depender de planilha e ganhei previsibilidade no fluxo de caixa.",
  },
];

const CERTIFICACOES = [
  { icone: GraduationCap, titulo: "Ciências Contábeis", org: "Formação acadêmica" },
  { icone: Award, titulo: "MBA em Controladoria e Finanças", org: "Especialização" },
  { icone: BadgeCheck, titulo: "Consultoria Empresarial", org: "Certificação profissional" },
  { icone: ScrollText, titulo: "Registro CRC ativo", org: "Conselho de Contabilidade" },
];

const SELOS = [
  { icone: ShieldCheck, titulo: "Dados protegidos", texto: "Infraestrutura segura e backups" },
  { icone: Star, titulo: "Satisfação 4,9/5", texto: "Avaliação média dos clientes" },
  { icone: Users, titulo: "+120 empresas", texto: "Atendidas pela consultoria" },
  { icone: CalendarCheck, titulo: "12 anos", texto: "De experiência em gestão" },
];

export default async function ApresentacaoPage() {
  let planos: Plano[] = [];
  try {
    planos = await getPlanosPublicos();
  } catch {
    // A vitrine não deve derrubar a landing se o banco estiver indisponível.
    planos = [];
  }

  return (
    <div className="min-h-dvh bg-background">
      <CabecalhoSite />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(--brand) 16%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        />
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 text-center lg:px-8 lg:pt-24 lg:pb-28">
          <Revelar className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="inline-block size-1.5 rounded-full bg-positive" />
            Consultoria + plataforma em um só lugar
          </Revelar>

          <Revelar
            as="div"
            delay={80}
            className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          >
            <h1>
              Gestão financeira que{" "}
              <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
                vira decisão
              </span>
            </h1>
          </Revelar>

          <Revelar
            delay={160}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
          >
            A Cristiane Queiroz une método de consultoria e uma plataforma completa
            para você enxergar o caixa, entender o resultado e agir com clareza —
            sem depender de planilhas soltas.
          </Revelar>

          <Revelar
            delay={240}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/login?redirect=%2Fassinatura"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-[0_10px_30px_-12px_rgba(15,61,76,0.7)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Começar agora
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#planos"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-surface-muted sm:w-auto"
            >
              Ver planos
            </a>
          </Revelar>

          <Revelar
            delay={320}
            className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4"
          >
            {[
              { valor: "+120", rotulo: "empresas atendidas" },
              { valor: "12 anos", rotulo: "de experiência" },
              { valor: "4,9/5", rotulo: "satisfação média" },
              { valor: "R$ 40mi+", rotulo: "sob gestão" },
            ].map((s) => (
              <div key={s.rotulo} className="bg-surface px-4 py-5">
                <p className="text-2xl font-semibold tracking-tight text-brand tabular">
                  {s.valor}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.rotulo}</p>
              </div>
            ))}
          </Revelar>
        </div>
      </section>

      {/* -------------------------------------------------------------- Planos */}
      <section id="planos" className="scroll-mt-20 border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
          <Revelar className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              Planos
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Escolha o nível de acompanhamento
            </h2>
            <p className="mt-4 text-muted-foreground">
              Do essencial ao consultivo dedicado. Todos com a plataforma completa e
              suporte da equipe CQ.
            </p>
          </Revelar>

          <Revelar delay={120} className="mt-12">
            <PlanosSite planos={planos} />
          </Revelar>
        </div>
      </section>

      {/* ------------------------------------------------------ O que engloba */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Revelar>
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                O que engloba
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Mais que um sistema: um método completo
              </h2>
              <p className="mt-4 text-muted-foreground">
                A consultoria conduz a empresa do diagnóstico à execução, com a
                plataforma sustentando cada etapa. Você não recebe só uma
                ferramenta — recebe direção.
              </p>
              <Link
                href="/login?redirect=%2Fassinatura"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-transform hover:-translate-y-0.5"
              >
                Falar com a consultoria
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Revelar>

            <div className="grid gap-4 sm:grid-cols-2">
              {ENGLOBA.map((item, i) => (
                <Revelar
                  as="article"
                  key={item.titulo}
                  delay={i * 80}
                  className="rounded-2xl border border-border bg-surface p-6"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                    <item.icone className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{item.titulo}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.texto}</p>
                </Revelar>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Avaliações */}
      <section id="avaliacoes" className="scroll-mt-20 border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
          <Revelar className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              Quem já vive isso
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Resultados que os clientes sentem
            </h2>
          </Revelar>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {AVALIACOES.map((a, i) => (
              <Revelar
                as="article"
                key={a.nome}
                delay={i * 100}
                className="flex flex-col rounded-2xl border border-border bg-surface p-7"
              >
                <Quote className="size-7 text-accent/70" aria-hidden />
                <div className="mt-3 flex gap-0.5" aria-label="5 de 5 estrelas">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-accent text-accent" aria-hidden />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                  “{a.texto}”
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                  <span className="grid size-10 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                    {a.nome
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.cargo}</p>
                  </div>
                </div>
              </Revelar>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Depoimentos ilustrativos para demonstração.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- Certificações */}
      <section id="certificacoes" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <Revelar className="order-2 lg:order-1">
              <div className="grid gap-4 sm:grid-cols-2">
                {CERTIFICACOES.map((c, i) => (
                  <Revelar
                    as="article"
                    key={c.titulo}
                    delay={i * 80}
                    className="rounded-2xl border border-border bg-surface p-5"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
                      <c.icone className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold">{c.titulo}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{c.org}</p>
                  </Revelar>
                ))}
              </div>
            </Revelar>

            <Revelar className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                Credenciais
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Experiência que dá segurança
              </h2>
              <p className="mt-4 text-muted-foreground">
                À frente da consultoria, Cristiane Queiroz combina formação técnica
                sólida com anos de campo ajudando empresas a organizarem as finanças
                e crescerem com consistência.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Credenciais ilustrativas para demonstração — serão substituídas pelos
                certificados reais.
              </p>
            </Revelar>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Cards do sistema (recursos) */}
      <section id="recursos" className="scroll-mt-20 border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-24">
          <Revelar className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              Dentro da plataforma
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tudo o que você acompanha no sistema
            </h2>
            <p className="mt-4 text-muted-foreground">
              Um ambiente para reunir os números do negócio e transformá-los em ação.
            </p>
          </Revelar>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS.map((r, i) => (
              <Revelar
                as="article"
                key={r.titulo}
                delay={(i % 4) * 70}
                className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-brand/40"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                  <r.icone className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{r.titulo}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.texto}</p>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Selos */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SELOS.map((s, i) => (
              <Revelar
                key={s.titulo}
                delay={i * 70}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icone className="size-6" aria-hidden />
                </span>
                <div className="leading-tight">
                  <p className="text-base font-semibold">{s.titulo}</p>
                  <p className="text-xs text-muted-foreground">{s.texto}</p>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- Banner do principal cliente */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <Revelar className="relative overflow-hidden rounded-3xl border border-brand/30 bg-brand px-7 py-12 text-brand-foreground lg:px-14 lg:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(50% 80% at 85% 20%, color-mix(in srgb, var(--accent) 45%, transparent) 0%, transparent 60%)",
              }}
            />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <Sparkles className="size-3.5" aria-hidden />
                  Cliente em destaque
                </span>
                <blockquote className="mt-5 text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                  “Passamos a decidir com número na mão. A CQ virou parte da nossa
                  gestão.”
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-white/15 text-lg font-semibold">
                    GM
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">Grupo Meridiano</p>
                    <p className="text-xs text-white/70">
                      Varejo · cliente exemplo para demonstração
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { valor: "+38%", rotulo: "margem em 1 ano" },
                  { valor: "-27%", rotulo: "inadimplência" },
                  { valor: "100%", rotulo: "caixa previsível" },
                  { valor: "6", rotulo: "unidades integradas" },
                ].map((m) => (
                  <div
                    key={m.rotulo}
                    className="rounded-2xl bg-white/10 px-4 py-4 backdrop-blur-sm"
                  >
                    <p className="text-2xl font-semibold tracking-tight tabular">
                      {m.valor}
                    </p>
                    <p className="mt-0.5 text-xs text-white/75">{m.rotulo}</p>
                  </div>
                ))}
              </div>
            </div>
          </Revelar>
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8">
          <Revelar>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pronta para ver seus números com clareza?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Comece hoje e transforme dados financeiros em decisões que fazem a
              empresa crescer.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login?redirect=%2Fassinatura"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-[0_10px_30px_-12px_rgba(15,61,76,0.7)] transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                Assinar um plano
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-surface-muted sm:w-auto"
              >
                <LogIn className="size-4" aria-hidden />
                Já sou cliente
              </Link>
            </div>
          </Revelar>
        </div>
      </section>

      {/* ------------------------------------------------------------- Rodapé */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground">
                  CQ
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">Cristiane Queiroz</span>
                  <span className="block text-xs text-muted-foreground">
                    Consultoria Financeira
                  </span>
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Consultoria e plataforma de gestão financeira para empresas que
                querem crescer com método e clareza.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Navegação
                </p>
                <a href="#planos" className="block text-muted-foreground hover:text-foreground">
                  Planos
                </a>
                <a href="#recursos" className="block text-muted-foreground hover:text-foreground">
                  Recursos
                </a>
                <a href="#avaliacoes" className="block text-muted-foreground hover:text-foreground">
                  Avaliações
                </a>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Acesso
                </p>
                <Link href="/login" className="block text-muted-foreground hover:text-foreground">
                  Entrar
                </Link>
                <Link
                  href="/login?redirect=%2Fassinatura"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Assinar
                </Link>
              </div>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} Cristiane Queiroz Consultoria Financeira.</p>
            <p>Feito com método e cuidado.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
