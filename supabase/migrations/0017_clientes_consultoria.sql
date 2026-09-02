-- Clientes de consultoria (cadastro manual pelo admin)
create table public.clientes_consultoria (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_documento text not null check (tipo_documento in ('cpf', 'cnpj')),
  documento text not null,
  valor_mensal numeric(12, 2) not null check (valor_mensal >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_consultoria_documento_unique unique (documento)
);

create index clientes_consultoria_ativo_idx
  on public.clientes_consultoria (ativo, created_at desc);

alter table public.clientes_consultoria enable row level security;

create policy "clientes_consultoria: admin gerencia"
  on public.clientes_consultoria for all
  using (private.is_admin())
  with check (private.is_admin());

comment on table public.clientes_consultoria is
  'Clientes de consultoria cadastrados manualmente pelo admin (CPF/CNPJ e valor mensal).';
