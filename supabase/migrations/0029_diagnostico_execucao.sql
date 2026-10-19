-- Execução do diagnóstico por área: separado da avaliação (nota/observação).
-- Preserva notas e histórico de competências; registra o que foi feito e o andamento.

alter table public.diagnosticos
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.diagnosticos;
create trigger set_updated_at
  before update on public.diagnosticos
  for each row execute function public.set_updated_at();

alter table public.diagnostico_itens
  add column if not exists realizado text,
  add column if not exists data_realizacao date,
  add column if not exists progresso smallint not null default 0
    check (progresso in (0, 30, 50, 100)),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

comment on column public.diagnostico_itens.realizado is
  'O que foi realizado na área (execução), distinto da observação da avaliação.';
comment on column public.diagnostico_itens.data_realizacao is
  'Data efetiva da realização / última execução registrada.';
comment on column public.diagnostico_itens.progresso is
  'Andamento da execução: 0 não iniciado, 30 iniciado, 50 em andamento, 100 concluído.';

drop trigger if exists set_updated_at on public.diagnostico_itens;
create trigger set_updated_at
  before update on public.diagnostico_itens
  for each row execute function public.set_updated_at();

create table if not exists public.diagnostico_historico (
  id                   uuid primary key default gen_random_uuid(),
  diagnostico_id       uuid not null references public.diagnosticos(id) on delete cascade,
  diagnostico_item_id  uuid references public.diagnostico_itens(id) on delete set null,
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  tipo                 text not null check (tipo in ('avaliacao', 'execucao')),
  descricao            text not null,
  alteracoes           jsonb not null default '{}'::jsonb,
  created_by           uuid references public.profiles(id) on delete set null,
  autor_nome           text not null default '',
  created_at           timestamptz not null default now()
);

create index if not exists diagnostico_historico_empresa_idx
  on public.diagnostico_historico (empresa_id, created_at desc);
create index if not exists diagnostico_historico_diagnostico_idx
  on public.diagnostico_historico (diagnostico_id, created_at desc);

alter table public.diagnostico_historico enable row level security;

drop policy if exists "diagnostico_historico: membros leem" on public.diagnostico_historico;
create policy "diagnostico_historico: membros leem"
  on public.diagnostico_historico for select
  using (public.has_empresa_access(empresa_id));

drop policy if exists "diagnostico_historico: autenticado registra" on public.diagnostico_historico;
create policy "diagnostico_historico: autenticado registra"
  on public.diagnostico_historico for insert
  with check (public.has_empresa_access(empresa_id));

drop policy if exists "diagnostico_historico: admin apaga" on public.diagnostico_historico;
create policy "diagnostico_historico: admin apaga"
  on public.diagnostico_historico for delete
  using (public.is_admin());
