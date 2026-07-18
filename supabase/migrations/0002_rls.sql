-- =============================================================================
-- Row Level Security
--
-- Regra geral:
--   admin     -> tudo, em qualquer empresa
--   consultor -> leitura e escrita nas empresas em que é membro
--   cliente   -> apenas leitura nas empresas em que é membro
-- =============================================================================

-- A view herda o RLS da tabela base em vez de rodar como o dono
alter view public.titulos_view set (security_invoker = true);

-- -----------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER para nao recursar nas policies de empresa_membros.
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Qualquer nivel de acesso (leitura) a empresa
create or replace function public.has_empresa_access(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.empresa_membros
    where empresa_id = p_empresa_id and user_id = auth.uid()
  );
$$;

-- Permissao de escrita: admin ou consultor daquela empresa
create or replace function public.can_edit_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.empresa_membros
    where empresa_id = p_empresa_id
      and user_id = auth.uid()
      and papel = 'consultor'
  );
$$;

-- -----------------------------------------------------------------------------
-- Habilita RLS em tudo
-- -----------------------------------------------------------------------------

alter table public.empresas              enable row level security;
alter table public.unidades              enable row level security;
alter table public.profiles              enable row level security;
alter table public.empresa_membros       enable row level security;
alter table public.plano_contas          enable row level security;
alter table public.contas_bancarias      enable row level security;
alter table public.lancamentos           enable row level security;
alter table public.titulos               enable row level security;
alter table public.orcamentos            enable row level security;
alter table public.importacoes           enable row level security;
alter table public.indicadores           enable row level security;
alter table public.indicador_valores     enable row level security;
alter table public.planos_acao           enable row level security;
alter table public.diagnosticos          enable row level security;
alter table public.diagnostico_itens     enable row level security;
alter table public.maturidade_avaliacoes enable row level security;
alter table public.maturidade_itens      enable row level security;
alter table public.documentos            enable row level security;
alter table public.reunioes              enable row level security;
alter table public.alertas               enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy "profiles: le o proprio ou admin le todos"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: atualiza o proprio"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: admin gerencia"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- empresas e vinculos
-- -----------------------------------------------------------------------------

create policy "empresas: membros leem"
  on public.empresas for select
  using (public.has_empresa_access(id));

create policy "empresas: consultor edita"
  on public.empresas for update
  using (public.can_edit_empresa(id))
  with check (public.can_edit_empresa(id));

create policy "empresas: admin cria e remove"
  on public.empresas for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "empresa_membros: membros leem"
  on public.empresa_membros for select
  using (public.has_empresa_access(empresa_id));

create policy "empresa_membros: admin gerencia"
  on public.empresa_membros for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Tabelas com empresa_id direto: mesmo par de policies para todas
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'unidades','plano_contas','contas_bancarias','lancamentos','titulos',
    'orcamentos','importacoes','indicador_valores','planos_acao','diagnosticos',
    'maturidade_avaliacoes','documentos','reunioes','alertas'
  ]
  loop
    execute format($f$
      create policy "%1$s: membros leem"
        on public.%1$I for select
        using (public.has_empresa_access(empresa_id));
    $f$, t);

    execute format($f$
      create policy "%1$s: consultor escreve"
        on public.%1$I for all
        using (public.can_edit_empresa(empresa_id))
        with check (public.can_edit_empresa(empresa_id));
    $f$, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- indicadores: empresa_id nulo = template visivel para todos os autenticados
-- -----------------------------------------------------------------------------

create policy "indicadores: templates e proprios"
  on public.indicadores for select
  using (empresa_id is null or public.has_empresa_access(empresa_id));

create policy "indicadores: consultor escreve"
  on public.indicadores for all
  using (empresa_id is not null and public.can_edit_empresa(empresa_id))
  with check (empresa_id is not null and public.can_edit_empresa(empresa_id));

create policy "indicadores: admin gerencia templates"
  on public.indicadores for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Tabelas filhas: herdam o acesso pelo pai
-- -----------------------------------------------------------------------------

create policy "diagnostico_itens: membros leem"
  on public.diagnostico_itens for select
  using (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id and public.has_empresa_access(d.empresa_id)
  ));

create policy "diagnostico_itens: consultor escreve"
  on public.diagnostico_itens for all
  using (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id and public.can_edit_empresa(d.empresa_id)
  ))
  with check (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id and public.can_edit_empresa(d.empresa_id)
  ));

create policy "maturidade_itens: membros leem"
  on public.maturidade_itens for select
  using (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id and public.has_empresa_access(a.empresa_id)
  ));

create policy "maturidade_itens: consultor escreve"
  on public.maturidade_itens for all
  using (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id and public.can_edit_empresa(a.empresa_id)
  ))
  with check (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id and public.can_edit_empresa(a.empresa_id)
  ));
