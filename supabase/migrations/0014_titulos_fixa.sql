-- Contas fixas (recorrentes) em títulos a pagar/receber
alter table public.titulos
  add column if not exists fixa boolean not null default false;

create index if not exists titulos_empresa_fixa_idx
  on public.titulos (empresa_id, tipo, fixa)
  where fixa = true;

comment on column public.titulos.fixa is
  'Marca título como conta fixa/recorrente (ex.: aluguel, energia).';
