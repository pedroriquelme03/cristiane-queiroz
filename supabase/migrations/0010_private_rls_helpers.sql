-- =============================================================================
-- Move RLS helpers para schema privado
--
-- Remove os ultimos avisos de SECURITY DEFINER em public:
-- - public.is_admin()
-- - public.has_empresa_access(uuid)
-- - public.can_edit_empresa(uuid)
--
-- As policies passam a chamar private.*. O schema private nao fica exposto como
-- RPC publica pelo PostgREST/Supabase API.
-- =============================================================================

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function private.has_empresa_access(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin() or exists (
    select 1
    from public.empresa_membros
    where empresa_id = p_empresa_id
      and user_id = auth.uid()
  );
$$;

create or replace function private.can_edit_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin() or exists (
    select 1
    from public.empresa_membros
    where empresa_id = p_empresa_id
      and user_id = auth.uid()
      and papel = 'consultor'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.has_empresa_access(uuid) from public, anon;
revoke execute on function private.can_edit_empresa(uuid) from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_empresa_access(uuid) to authenticated;
grant execute on function private.can_edit_empresa(uuid) to authenticated;

-- profiles
alter policy "profiles: le o proprio ou admin le todos"
  on public.profiles
  using (id = auth.uid() or private.is_admin());

alter policy "profiles: admin gerencia"
  on public.profiles
  using (private.is_admin())
  with check (private.is_admin());

-- empresas e vinculos
alter policy "empresas: membros leem"
  on public.empresas
  using (private.has_empresa_access(id));

alter policy "empresas: consultor edita"
  on public.empresas
  using (private.can_edit_empresa(id))
  with check (private.can_edit_empresa(id));

alter policy "empresas: admin cria e remove"
  on public.empresas
  using (private.is_admin())
  with check (private.is_admin());

alter policy "empresa_membros: membros leem"
  on public.empresa_membros
  using (private.has_empresa_access(empresa_id));

alter policy "empresa_membros: admin gerencia"
  on public.empresa_membros
  using (private.is_admin())
  with check (private.is_admin());

-- Tabelas com empresa_id direto
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
    execute format(
      'alter policy %I on public.%I using (private.has_empresa_access(empresa_id))',
      t || ': membros leem',
      t
    );

    execute format(
      'alter policy %I on public.%I using (private.can_edit_empresa(empresa_id)) with check (private.can_edit_empresa(empresa_id))',
      t || ': consultor escreve',
      t
    );
  end loop;
end;
$$;

-- indicadores
alter policy "indicadores: templates e proprios"
  on public.indicadores
  using (empresa_id is null or private.has_empresa_access(empresa_id));

alter policy "indicadores: consultor escreve"
  on public.indicadores
  using (empresa_id is not null and private.can_edit_empresa(empresa_id))
  with check (empresa_id is not null and private.can_edit_empresa(empresa_id));

alter policy "indicadores: admin gerencia templates"
  on public.indicadores
  using (private.is_admin())
  with check (private.is_admin());

-- tabelas filhas
alter policy "diagnostico_itens: membros leem"
  on public.diagnostico_itens
  using (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id
      and private.has_empresa_access(d.empresa_id)
  ));

alter policy "diagnostico_itens: consultor escreve"
  on public.diagnostico_itens
  using (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id
      and private.can_edit_empresa(d.empresa_id)
  ))
  with check (exists (
    select 1 from public.diagnosticos d
    where d.id = diagnostico_id
      and private.can_edit_empresa(d.empresa_id)
  ));

alter policy "maturidade_itens: membros leem"
  on public.maturidade_itens
  using (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id
      and private.has_empresa_access(a.empresa_id)
  ));

alter policy "maturidade_itens: consultor escreve"
  on public.maturidade_itens
  using (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id
      and private.can_edit_empresa(a.empresa_id)
  ))
  with check (exists (
    select 1 from public.maturidade_avaliacoes a
    where a.id = avaliacao_id
      and private.can_edit_empresa(a.empresa_id)
  ));

-- assinaturas
alter policy "planos: admin le todos"
  on public.planos
  using (private.is_admin());

alter policy "planos: admin gerencia"
  on public.planos
  using (private.is_admin())
  with check (private.is_admin());

alter policy "assinaturas: membros leem a propria"
  on public.assinaturas
  using (private.has_empresa_access(empresa_id));

alter policy "assinaturas: admin gerencia"
  on public.assinaturas
  using (private.is_admin())
  with check (private.is_admin());

alter policy "faturas: membros leem"
  on public.faturas
  using (private.has_empresa_access(empresa_id));

alter policy "faturas: admin gerencia"
  on public.faturas
  using (private.is_admin())
  with check (private.is_admin());

-- estrutura organizacional
alter policy "estrutura_areas: membros leem"
  on public.estrutura_areas
  using (private.has_empresa_access(empresa_id));

alter policy "estrutura_areas: admin gerencia"
  on public.estrutura_areas
  using (private.is_admin())
  with check (private.is_admin());

alter policy "estrutura_cargos: membros leem"
  on public.estrutura_cargos
  using (private.has_empresa_access(empresa_id));

alter policy "estrutura_cargos: admin gerencia"
  on public.estrutura_cargos
  using (private.is_admin())
  with check (private.is_admin());

-- Remove as funcoes publicas depois que as policies foram atualizadas.
drop function if exists public.can_edit_empresa(uuid);
drop function if exists public.has_empresa_access(uuid);
drop function if exists public.is_admin();
