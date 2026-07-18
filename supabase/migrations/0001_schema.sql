-- =============================================================================
-- Plataforma CQ Consultoria Financeira — schema inicial
-- =============================================================================

create extension if not exists "pgcrypto";

-- Helper: mantem updated_at em dia
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. Tenants e acesso
-- =============================================================================

create table public.empresas (
  id                uuid primary key default gen_random_uuid(),
  razao_social      text not null,
  nome_fantasia     text,
  cnpj              text unique,
  segmento          text not null default 'geral'
                      check (segmento in ('geral','hotelaria','comercio','servicos','industria','alimentacao')),
  regime_tributario text check (regime_tributario in ('simples','presumido','real','mei')),
  data_abertura     date,
  qtd_funcionarios  integer default 0 check (qtd_funcionarios >= 0),
  logo_url          text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.unidades (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  tipo        text not null default 'filial' check (tipo in ('matriz','filial','cd','loja')),
  cidade      text,
  uf          char(2),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.unidades (empresa_id);

-- Espelha auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  email       text,
  telefone    text,
  avatar_url  text,
  -- admin: controle total da plataforma. consultor: acessa empresas atribuidas.
  -- cliente: acessa apenas a propria empresa, somente leitura.
  role        text not null default 'cliente' check (role in ('admin','consultor','cliente')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Vinculo usuario <-> empresa. Um consultor pode atender varias empresas.
create table public.empresa_membros (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  papel       text not null default 'cliente' check (papel in ('consultor','cliente')),
  created_at  timestamptz not null default now(),
  unique (empresa_id, user_id)
);
create index on public.empresa_membros (user_id);

-- Cria o profile automaticamente no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 2. Financeiro
-- =============================================================================

-- Plano de contas hierarquico, usado para classificar lancamentos e montar a DRE
create table public.plano_contas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  parent_id   uuid references public.plano_contas(id) on delete set null,
  codigo      text not null,
  nome        text not null,
  tipo        text not null check (tipo in ('receita','deducao','custo','despesa','investimento','nao_operacional')),
  -- agrupamento usado na montagem da DRE gerencial
  grupo_dre   text not null default 'outros'
                check (grupo_dre in ('receita_bruta','deducoes','custo_variavel','despesa_pessoal',
                                     'despesa_administrativa','despesa_comercial','despesa_financeira',
                                     'investimento','nao_operacional','outros')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index on public.plano_contas (empresa_id);

create table public.contas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null,
  banco         text,
  tipo          text not null default 'corrente' check (tipo in ('corrente','poupanca','caixa','aplicacao')),
  saldo_inicial numeric(14,2) not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on public.contas_bancarias (empresa_id);

-- Fluxo de caixa realizado: cada entrada/saida efetiva
create table public.lancamentos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  unidade_id        uuid references public.unidades(id) on delete set null,
  conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null,
  plano_conta_id    uuid references public.plano_contas(id) on delete set null,
  data              date not null,
  tipo              text not null check (tipo in ('entrada','saida')),
  valor             numeric(14,2) not null check (valor > 0),
  descricao         text not null default '',
  contraparte       text,
  documento         text,
  origem            text not null default 'manual' check (origem in ('manual','importacao','integracao')),
  importacao_id     uuid,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.lancamentos (empresa_id, data desc);
create index on public.lancamentos (empresa_id, plano_conta_id);
create trigger set_updated_at before update on public.lancamentos
  for each row execute function public.set_updated_at();

-- Contas a pagar e a receber
create table public.titulos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  unidade_id      uuid references public.unidades(id) on delete set null,
  plano_conta_id  uuid references public.plano_contas(id) on delete set null,
  tipo            text not null check (tipo in ('pagar','receber')),
  contraparte     text not null,           -- fornecedor (pagar) ou cliente (receber)
  documento       text,
  emissao         date,
  vencimento      date not null,
  valor           numeric(14,2) not null check (valor > 0),
  valor_pago      numeric(14,2) not null default 0 check (valor_pago >= 0),
  data_pagamento  date,
  status          text not null default 'aberto'
                    check (status in ('aberto','parcial','pago','cancelado')),
  observacao      text,
  origem          text not null default 'manual' check (origem in ('manual','importacao','integracao')),
  importacao_id   uuid,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.titulos (empresa_id, tipo, vencimento);
create index on public.titulos (empresa_id, status);
create trigger set_updated_at before update on public.titulos
  for each row execute function public.set_updated_at();

-- "vencido" é derivado (status aberto/parcial + vencimento < hoje), nunca armazenado
create view public.titulos_view as
  select t.*,
         (t.valor - t.valor_pago) as saldo,
         case
           when t.status in ('pago','cancelado') then t.status
           when t.vencimento < current_date then 'vencido'
           else t.status
         end as status_efetivo
  from public.titulos t;

-- Orcamento: previsto por conta/mes. O realizado vem dos lancamentos.
create table public.orcamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  plano_conta_id  uuid not null references public.plano_contas(id) on delete cascade,
  competencia     date not null,           -- sempre dia 1 do mes
  valor_previsto  numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, plano_conta_id, competencia)
);
create index on public.orcamentos (empresa_id, competencia);
create trigger set_updated_at before update on public.orcamentos
  for each row execute function public.set_updated_at();

-- Trilha de importacoes de planilha
create table public.importacoes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  tipo          text not null check (tipo in ('lancamentos','titulos','orcamento')),
  arquivo_nome  text not null,
  storage_path  text,
  status        text not null default 'processando'
                  check (status in ('processando','concluido','erro','revertido')),
  linhas_total  integer not null default 0,
  linhas_ok     integer not null default 0,
  erros         jsonb not null default '[]'::jsonb,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.importacoes (empresa_id, created_at desc);

-- =============================================================================
-- 3. Indicadores
-- =============================================================================

-- empresa_id null = indicador template (biblioteca por segmento)
create table public.indicadores (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references public.empresas(id) on delete cascade,
  codigo        text not null,
  nome          text not null,
  descricao     text,
  segmento      text not null default 'geral',
  unidade       text not null default 'numero' check (unidade in ('percentual','moeda','numero','dias')),
  direcao_meta  text not null default 'maior_melhor' check (direcao_meta in ('maior_melhor','menor_melhor')),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table public.indicador_valores (
  id            uuid primary key default gen_random_uuid(),
  indicador_id  uuid not null references public.indicadores(id) on delete cascade,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  competencia   date not null,             -- sempre dia 1 do mes
  valor         numeric(14,4) not null,
  meta          numeric(14,4),
  created_at    timestamptz not null default now(),
  unique (indicador_id, empresa_id, competencia)
);
create index on public.indicador_valores (empresa_id, competencia desc);

-- =============================================================================
-- 4. Consultoria: plano de acao, diagnostico, maturidade
-- =============================================================================

create table public.planos_acao (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  problema      text not null,
  acao          text not null,
  area          text not null default 'financeiro'
                  check (area in ('financeiro','compras','estoque','comercial','rh','processos','tecnologia','gestao')),
  responsavel   text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  prazo         date,
  prioridade    text not null default 'media' check (prioridade in ('baixa','media','alta','critica')),
  status        text not null default 'nao_iniciado'
                  check (status in ('nao_iniciado','em_andamento','concluido','cancelado')),
  percentual    integer not null default 0 check (percentual between 0 and 100),
  impacto_estimado numeric(14,2),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.planos_acao (empresa_id, status);
create trigger set_updated_at before update on public.planos_acao
  for each row execute function public.set_updated_at();

create table public.diagnosticos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  competencia       date not null,
  observacoes       text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (empresa_id, competencia)
);

create table public.diagnostico_itens (
  id              uuid primary key default gen_random_uuid(),
  diagnostico_id  uuid not null references public.diagnosticos(id) on delete cascade,
  categoria       text not null
                    check (categoria in ('financeiro','compras','estoque','comercial','rh','processos','tecnologia','gestao')),
  nota            integer not null check (nota between 0 and 100),
  observacao      text,
  unique (diagnostico_id, categoria)
);

-- Maturidade empresarial: pontuacao 0-100 por area, com historico mensal
create table public.maturidade_avaliacoes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  competencia   date not null,
  pontuacao_geral integer check (pontuacao_geral between 0 and 100),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (empresa_id, competencia)
);

create table public.maturidade_itens (
  id            uuid primary key default gen_random_uuid(),
  avaliacao_id  uuid not null references public.maturidade_avaliacoes(id) on delete cascade,
  categoria     text not null
                  check (categoria in ('financeiro','compras','estoque','comercial','rh','processos','tecnologia','gestao')),
  pontuacao     integer not null check (pontuacao between 0 and 100),
  unique (avaliacao_id, categoria)
);

-- =============================================================================
-- 5. Documentos, reunioes, alertas
-- =============================================================================

create table public.documentos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null,
  categoria     text not null default 'outros'
                  check (categoria in ('contrato','relatorio','demonstrativo','planilha','procedimento','apresentacao','outros')),
  storage_path  text not null,
  tamanho_bytes bigint,
  mime_type     text,
  visivel_cliente boolean not null default true,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.documentos (empresa_id, categoria);

create table public.reunioes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  tipo          text not null default 'reuniao' check (tipo in ('reuniao','treinamento')),
  titulo        text not null,
  data          timestamptz not null,
  participantes text,
  ata           text,
  gravacao_url  text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.reunioes (empresa_id, data desc);

-- Alertas financeiros exibidos no dashboard
create table public.alertas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  tipo        text not null,
  severidade  text not null default 'info' check (severidade in ('info','atencao','critico')),
  titulo      text not null,
  descricao   text,
  resolvido   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.alertas (empresa_id, resolvido);
