-- =============================================================================
-- Security advisor hardening
--
-- Resolve avisos do Supabase linter:
-- - Function Search Path Mutable
-- - Public/Signed-In users can execute SECURITY DEFINER functions diretamente
--
-- As policies continuam podendo usar as funcoes; o revoke evita chamada direta
-- por clientes anon/authenticated fora do contexto das policies/triggers.
-- =============================================================================

-- Funcoes sem search_path fixo
alter function public.set_updated_at() set search_path = public;
alter function public.saldo_em_caixa(uuid, date) set search_path = public;
alter function public.dashboard_kpis(uuid, date) set search_path = public;
alter function public.fluxo_caixa_diario(uuid, date, date) set search_path = public;
alter function public.fluxo_caixa_projetado(uuid, integer) set search_path = public;
alter function public.dre_gerencial(uuid, date, date) set search_path = public;

-- Funcoes SECURITY DEFINER usadas por RLS/triggers.
-- Remove execucao publica/anonima, mantendo authenticated onde as policies/RPCs
-- dependem dessas funcoes durante consultas autenticadas.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.has_empresa_access(uuid) from public, anon;
revoke execute on function public.can_edit_empresa(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.empresa_bloqueada(uuid) from public, anon;
revoke execute on function public.recalcular_status_assinatura(uuid) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_empresa_access(uuid) to authenticated;
grant execute on function public.can_edit_empresa(uuid) to authenticated;
grant execute on function public.empresa_bloqueada(uuid) to authenticated;
grant execute on function public.recalcular_status_assinatura(uuid) to authenticated;

-- RPCs que o app chama explicitamente. Mantem acesso apenas para usuarios logados.
revoke execute on function public.saldo_em_caixa(uuid, date) from public, anon;
revoke execute on function public.dashboard_kpis(uuid, date) from public, anon;
revoke execute on function public.fluxo_caixa_diario(uuid, date, date) from public, anon;
revoke execute on function public.fluxo_caixa_projetado(uuid, integer) from public, anon;
revoke execute on function public.dre_gerencial(uuid, date, date) from public, anon;

grant execute on function public.saldo_em_caixa(uuid, date) to authenticated;
grant execute on function public.dashboard_kpis(uuid, date) to authenticated;
grant execute on function public.fluxo_caixa_diario(uuid, date, date) to authenticated;
grant execute on function public.fluxo_caixa_projetado(uuid, integer) to authenticated;
grant execute on function public.dre_gerencial(uuid, date, date) to authenticated;
