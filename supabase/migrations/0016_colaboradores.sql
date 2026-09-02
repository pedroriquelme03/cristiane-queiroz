-- Colaboradores da empresa (para aniversariantes e quadro de pessoal)
create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  data_nascimento date not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index colaboradores_empresa_idx
  on public.colaboradores (empresa_id, ativo);

create index colaboradores_aniversario_idx
  on public.colaboradores (empresa_id, (extract(month from data_nascimento)), (extract(day from data_nascimento)))
  where ativo = true;

alter table public.colaboradores enable row level security;

create policy "colaboradores: membros leem"
  on public.colaboradores for select
  using (private.has_empresa_access(empresa_id));

create policy "colaboradores: admin gerencia"
  on public.colaboradores for all
  using (private.is_admin())
  with check (private.is_admin());

comment on table public.colaboradores is
  'Pessoas da empresa; data_nascimento alimenta aniversariantes na tela de início.';
