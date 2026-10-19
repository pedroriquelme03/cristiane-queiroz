-- Modelos de importação: o "jeito" de ler o relatório de cada cliente
-- (aba, linha do cabeçalho, linhas a ignorar e mapeamento de colunas).
-- empresa_id null = modelo global (ex.: layout padrão de um ERP), visível a todos.
create table public.modelos_importacao (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas(id) on delete cascade,
  tipo        text not null check (tipo in ('lancamentos','titulos')),
  nome        text not null check (length(trim(nome)) between 1 and 80),
  -- { aba, linhaCabecalho, ignorarLinhasQueComecam[], mapa{campo: cabecalho normalizado} }
  config      jsonb not null default '{}'::jsonb,
  -- Cabeçalhos normalizados do relatório de origem; usados para reconhecer o modelo
  assinatura  text[] not null default '{}',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint modelos_importacao_nome_unico unique nulls not distinct (empresa_id, tipo, nome)
);

create index modelos_importacao_empresa_idx
  on public.modelos_importacao (empresa_id, tipo);

create trigger set_updated_at before update on public.modelos_importacao
  for each row execute function public.set_updated_at();

alter table public.modelos_importacao enable row level security;

create policy "modelos_importacao: membros leem"
  on public.modelos_importacao for select
  to authenticated
  using (empresa_id is null or private.has_empresa_access(empresa_id));

create policy "modelos_importacao: editores gerenciam os da empresa"
  on public.modelos_importacao for all
  to authenticated
  using (empresa_id is not null and private.can_edit_empresa(empresa_id))
  with check (empresa_id is not null and private.can_edit_empresa(empresa_id));

create policy "modelos_importacao: admin gerencia globais"
  on public.modelos_importacao for all
  to authenticated
  using (empresa_id is null and private.is_admin())
  with check (empresa_id is null and private.is_admin());

-- Qual modelo foi usado em cada importação (auditoria e reprocessamento)
alter table public.importacoes
  add column modelo_id uuid references public.modelos_importacao(id) on delete set null;

comment on table public.modelos_importacao is
  'Layouts de relatório por empresa (ou globais) aplicados no assistente de importação.';
