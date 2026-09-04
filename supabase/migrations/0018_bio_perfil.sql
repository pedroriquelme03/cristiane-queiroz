-- =============================================================================
-- 0018: Link na bio (/bio)
--
-- Página pública de "link na bio" editável pela consultoria no painel admin.
-- É um registro único (singleton) com os textos do topo + listas de serviços e
-- links em JSONB, além de uma foto guardada no Storage.
--
-- Leitura: qualquer visitante (anon) lê o registro quando ativo. As policies de
-- admin ficam escopadas ao papel `authenticated` — como aprendido em 0011, uma
-- policy de SELECT que chama private.is_admin() no papel anon derruba a leitura
-- pública inteira ("permission denied for function is_admin").
-- Escrita: feita pelo service_role no servidor (ignora RLS); a policy de admin
-- existe como reforço caso um cliente autenticado escreva.
-- =============================================================================

create table public.bio_perfil (
  -- Singleton: só existe a linha 'perfil'.
  id            text primary key default 'perfil' check (id = 'perfil'),
  nome          text not null default 'Cristiane Queiroz',
  subtitulo     text not null default 'Consultoria Financeira',
  tagline       text not null default 'Gestão financeira que vira decisão pro seu negócio crescer com clareza.',
  whatsapp      text not null default '5545999316874',
  foto_url      text,
  servicos      jsonb not null default '[]'::jsonb,
  links         jsonb not null default '[]'::jsonb,
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- Conteúdo inicial: espelha os padrões do código (src/lib/bio.ts) para a página
-- já nascer preenchida assim que o banco é provisionado.
insert into public.bio_perfil (id, servicos, links)
values (
  'perfil',
  '[
    {"icone":"compass","titulo":"Consultoria financeira empresarial","texto":"Método completo do diagnóstico ao resultado","tipo":"whatsapp","valor":"Olá Cristiane! Quero conhecer a consultoria financeira para a minha empresa."},
    {"icone":"clipboard","titulo":"Diagnóstico + plano de ação","texto":"Descubra os gargalos e o caminho pra crescer","tipo":"whatsapp","valor":"Olá! Gostaria de agendar um diagnóstico financeiro da minha empresa."},
    {"icone":"trending","titulo":"Fluxo de caixa e DRE gerencial","texto":"Seus números organizados e virando decisão","tipo":"whatsapp","valor":"Olá! Quero organizar o fluxo de caixa e o DRE da minha empresa com a consultoria."},
    {"icone":"dashboard","titulo":"Plataforma de gestão CQ","texto":"Indicadores, metas e painéis em um só lugar","tipo":"url","valor":"/apresentacao#recursos"},
    {"icone":"graduation","titulo":"Capacitação da equipe","texto":"Treinamento pra gestão rodar com autonomia","tipo":"whatsapp","valor":"Olá! Quero saber sobre a capacitação da equipe em gestão financeira."}
  ]'::jsonb,
  '[
    {"icone":"instagram","titulo":"Instagram","texto":"@cristianequeirozconsultoria","url":"https://www.instagram.com/cristianequeirozconsultoria/"},
    {"icone":"globe","titulo":"Site e planos","texto":"Conheça a consultoria e a plataforma","url":"/apresentacao"},
    {"icone":"login","titulo":"Área do cliente","texto":"Acesse o sistema de gestão financeira","url":"/login"}
  ]'::jsonb
);

alter table public.bio_perfil enable row level security;

-- Leitura pública do singleton quando ativo (papel public = anon + authenticated).
create policy "bio_perfil: leitura publica"
  on public.bio_perfil for select
  using (ativo);

-- Admin gerencia (reforço; a escrita real usa service_role no servidor).
-- Escopado a authenticated para não quebrar a leitura anônima (ver 0011).
create policy "bio_perfil: admin gerencia"
  on public.bio_perfil for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: bucket público para a foto do perfil.
-- Bucket público => leitura por URL pública. A escrita é feita pelo
-- service_role (ignora RLS), então não precisamos de policies em objects.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bio', 'bio', true)
on conflict (id) do nothing;
