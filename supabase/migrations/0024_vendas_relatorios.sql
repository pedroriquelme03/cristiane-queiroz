-- Relatórios de vendas do PDV (ex.: "Receita Ipê", "Rel. Hospedagem") por mês.
--
-- Os itens mudam todo mês (produtos novos, departamentos, usuários), então os
-- seis resumos ficam em jsonb: {categoria|departamento|data|usuario|produto|familia:
-- [{nome, quantidade, valor}]}. Uma linha por empresa × mês × origem.
create table public.vendas_relatorios (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  competencia       date not null check (extract(day from competencia) = 1),
  -- Ponto de venda / unidade: "Restaurante Ipê", "Hospedagem"...
  origem            text not null check (length(trim(origem)) between 1 and 80),
  arquivo_nome      text not null,
  periodo_inicio    date,
  periodo_fim       date,
  total_valor       numeric(14,2) not null default 0,
  total_quantidade  numeric(14,2) not null default 0,
  resumos           jsonb not null default '{}'::jsonb,
  importado_por     uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (empresa_id, competencia, origem)
);

create index vendas_relatorios_empresa_idx on public.vendas_relatorios (empresa_id, competencia);

create trigger set_updated_at before update on public.vendas_relatorios
  for each row execute function public.set_updated_at();

alter table public.vendas_relatorios enable row level security;

create policy "vendas_relatorios: membros leem" on public.vendas_relatorios
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "vendas_relatorios: consultor escreve" on public.vendas_relatorios
  for all to authenticated
  using (private.can_edit_empresa(empresa_id)) with check (private.can_edit_empresa(empresa_id));

comment on table public.vendas_relatorios is
  'Resumos do relatório de vendas do PDV por empresa, mês e origem (ponto de venda).';
