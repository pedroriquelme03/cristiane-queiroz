-- Histórico de baixas (pagamentos/recebimentos parciais ou totais) com chave
-- de idempotência para impedir duplicar por clique/requisição repetida.

create table if not exists public.titulos_baixas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  titulo_id        uuid not null references public.titulos(id) on delete cascade,
  -- Preenchido após criar o lançamento; null só durante a reserva da chave.
  lancamento_id    uuid references public.lancamentos(id) on delete restrict,
  data             date not null,
  valor            numeric(14,2) not null check (valor > 0),
  idempotency_key  text not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (titulo_id, idempotency_key)
);

create index if not exists titulos_baixas_titulo_idx
  on public.titulos_baixas (titulo_id, created_at desc);

create index if not exists titulos_baixas_empresa_idx
  on public.titulos_baixas (empresa_id, data desc);

comment on table public.titulos_baixas is
  'Cada pagamento/recebimento de um título; idempotency_key evita baixas duplicadas.';

alter table public.titulos_baixas enable row level security;

create policy "titulos_baixas: membros leem"
  on public.titulos_baixas for select
  using (public.has_empresa_access(empresa_id));

create policy "titulos_baixas: consultor escreve"
  on public.titulos_baixas for all
  using (public.can_edit_empresa(empresa_id))
  with check (public.can_edit_empresa(empresa_id));
