-- Estrutura organizacional cadastrada por empresa. Estas tabelas são novas e
-- não alteram os cadastros ou lançamentos existentes.
create table public.estrutura_areas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table public.estrutura_cargos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  area_id uuid not null references public.estrutura_areas(id) on delete cascade,
  nome text not null,
  quantidade integer not null default 1 check (quantidade >= 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (area_id, nome)
);

create index estrutura_areas_empresa_idx on public.estrutura_areas (empresa_id, ordem, nome);
create index estrutura_cargos_area_idx on public.estrutura_cargos (area_id, ordem, nome);

alter table public.estrutura_areas enable row level security;
alter table public.estrutura_cargos enable row level security;

create policy "estrutura_areas: membros leem"
  on public.estrutura_areas for select
  using (public.has_empresa_access(empresa_id));

create policy "estrutura_areas: admin gerencia"
  on public.estrutura_areas for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "estrutura_cargos: membros leem"
  on public.estrutura_cargos for select
  using (public.has_empresa_access(empresa_id));

create policy "estrutura_cargos: admin gerencia"
  on public.estrutura_cargos for all
  using (public.is_admin())
  with check (public.is_admin());
