-- =============================================================================
-- Rate limiting compartilhado (Postgres)
--
-- Em ambiente serverless não há estado compartilhado entre instâncias, então um
-- contador em memória não segura brute force. Este contador vive no banco: uma
-- linha por "chave" (ex.: login:<ip>), com janela deslizante e incremento
-- atômico sob lock de linha (o próprio UPSERT ... RETURNING serializa).
--
-- A TABELA fica no schema private (nunca legível via API). As FUNÇÕES ficam em
-- public porque o PostgREST/Supabase só expõe RPC de schemas expostos — mas o
-- EXECUTE é revogado de anon/authenticated, então só o servidor (service_role)
-- consegue chamá-las. Ver src/lib/rate-limit.ts.
-- =============================================================================

create table if not exists private.rate_limit (
  chave          text primary key,
  contagem       integer     not null default 0,
  inicio_janela  timestamptz not null default now()
);

-- Registra uma tentativa e diz se ela está dentro do limite.
--   p_chave           identificador do balde (ex.: 'login:203.0.113.7')
--   p_max             tentativas permitidas dentro da janela
--   p_janela_segundos duração da janela
-- Retorna a decisão e quantas tentativas ainda restam.
create or replace function public.rate_limit_hit(
  p_chave text,
  p_max integer,
  p_janela_segundos integer
)
returns table (permitido boolean, restantes integer)
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_agora    timestamptz := now();
  v_limite   timestamptz := v_agora - make_interval(secs => p_janela_segundos);
  v_contagem integer;
begin
  insert into private.rate_limit as rl (chave, contagem, inicio_janela)
  values (p_chave, 1, v_agora)
  on conflict (chave) do update
    set contagem = case
          when rl.inicio_janela < v_limite then 1
          else rl.contagem + 1
        end,
        inicio_janela = case
          when rl.inicio_janela < v_limite then v_agora
          else rl.inicio_janela
        end
  returning rl.contagem into v_contagem;

  return query
    select v_contagem <= p_max, greatest(0, p_max - v_contagem);
end;
$$;

-- Só o servidor (service_role) executa. Nunca anon/authenticated, mesmo estando
-- em public: sem EXECUTE, a função não aparece como RPC utilizável pelo cliente.
revoke all on function public.rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer)
  to service_role;

-- Higiene: remove baldes expirados. Sem cron, roda oportunisticamente a partir
-- do helper (1% das chamadas) para a tabela não crescer sem limite.
create or replace function public.rate_limit_limpar(p_janela_segundos integer)
returns void
language sql
security definer
set search_path = private, public
as $$
  delete from private.rate_limit
  where inicio_janela < now() - make_interval(secs => p_janela_segundos);
$$;

revoke all on function public.rate_limit_limpar(integer)
  from public, anon, authenticated;
grant execute on function public.rate_limit_limpar(integer) to service_role;
