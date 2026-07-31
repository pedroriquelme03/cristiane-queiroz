-- Histórico permanente das mudanças no plano de ação.
create table if not exists public.plano_acao_historico (
  id              uuid primary key default gen_random_uuid(),
  plano_acao_id   uuid references public.planos_acao(id) on delete set null,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('criada','alterada','progresso','comentario','excluida')),
  descricao       text not null,
  alteracoes      jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles(id) on delete set null,
  autor_nome      text not null,
  created_at      timestamptz not null default now()
);

create index if not exists plano_acao_historico_empresa_data_idx
  on public.plano_acao_historico (empresa_id, created_at desc);
create index if not exists plano_acao_historico_acao_data_idx
  on public.plano_acao_historico (plano_acao_id, created_at desc);

alter table public.plano_acao_historico enable row level security;

create policy "plano_acao_historico: membros leem"
  on public.plano_acao_historico for select
  using (private.has_empresa_access(empresa_id));

create policy "plano_acao_historico: membros registram"
  on public.plano_acao_historico for insert
  with check (
    private.has_empresa_access(empresa_id)
    and created_by = auth.uid()
  );

create policy "plano_acao_historico: admin remove"
  on public.plano_acao_historico for delete
  using (private.is_admin());
