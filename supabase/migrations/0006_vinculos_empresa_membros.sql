-- Centraliza o vínculo usuário → empresa em empresa_membros.
-- Em bancos que receberam a coluna legada profiles.empresa_id manualmente,
-- aproveita os vínculos existentes sem falhar nos bancos do schema atual.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'empresa_id'
  ) then
    execute $sql$
      insert into public.empresa_membros (empresa_id, user_id, papel)
      select empresa_id::uuid, id, 'cliente'
      from public.profiles
      where empresa_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      on conflict (empresa_id, user_id) do nothing
    $sql$;
  end if;
end;
$$;
