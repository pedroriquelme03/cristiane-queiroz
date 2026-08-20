-- Agrupa parcelas de uma mesma conta fixa (um cadastro → N títulos)
alter table public.titulos
  add column if not exists grupo_fixa_id uuid;

create index if not exists titulos_grupo_fixa_idx
  on public.titulos (empresa_id, grupo_fixa_id)
  where grupo_fixa_id is not null;

comment on column public.titulos.grupo_fixa_id is
  'Identifica o cadastro de conta fixa; todas as parcelas mensais compartilham o mesmo UUID.';
