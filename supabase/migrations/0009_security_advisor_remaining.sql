-- =============================================================================
-- Security advisor follow-up
--
-- Complementa 0008_security_lints.sql para os avisos remanescentes.
-- =============================================================================

-- Funcao auxiliar criada fora das migrations iniciais. Nao deve ser chamada por
-- clientes da API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Trigger de signup: executada pelo trigger em auth.users, nao pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Funcao operacional de manutencao de assinatura. Hoje o app ainda nao chama
-- esta RPC diretamente; quando houver baixa de pagamento/webhook, chamar via
-- service role ou criar RPC propria com validacao de admin.
revoke execute on function public.recalcular_status_assinatura(uuid) from public, anon, authenticated;

-- Helper de bloqueio: atualmente usado como regra interna. Se precisar expor
-- ao app, crie uma RPC especifica que valide public.has_empresa_access().
revoke execute on function public.empresa_bloqueada(uuid) from public, anon, authenticated;
