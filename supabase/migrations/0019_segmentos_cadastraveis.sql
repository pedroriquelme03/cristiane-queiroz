-- Segmentos cadastráveis (além dos padrões do sistema)
create table if not exists public.segmentos (
  id uuid primary key default gen_random_uuid(),
  valor text not null,
  rotulo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint segmentos_valor_unique unique (valor)
);

create index if not exists segmentos_ativo_idx
  on public.segmentos (ativo, rotulo);

alter table public.segmentos enable row level security;

drop policy if exists "segmentos: autenticados leem" on public.segmentos;
create policy "segmentos: autenticados leem"
  on public.segmentos for select
  to authenticated
  using (ativo = true or private.is_admin());

drop policy if exists "segmentos: admin gerencia" on public.segmentos;
create policy "segmentos: admin gerencia"
  on public.segmentos for all
  using (private.is_admin())
  with check (private.is_admin());

insert into public.segmentos (valor, rotulo) values
  ('hotelaria', 'Hotelaria'),
  ('comercio', 'Comércio'),
  ('servicos', 'Serviços'),
  ('industria', 'Indústria'),
  ('alimentacao', 'Alimentação')
on conflict (valor) do nothing;

-- Libera o campo empresas.segmento para valores cadastrados (remove check fixo)
alter table public.empresas drop constraint if exists empresas_segmento_check;

comment on table public.segmentos is
  'Opções do campo Segmento no cadastro de empresas; admin pode incluir novos.';
