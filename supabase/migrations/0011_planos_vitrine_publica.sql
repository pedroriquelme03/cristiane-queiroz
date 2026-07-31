-- 0011: a landing page publica (/apresentacao) precisa ler os planos publicos
-- sem autenticacao. As policies de admin de public.planos chamam
-- private.is_admin(), cuja execucao foi revogada de anon em 0010. Como as
-- policies permissivas de SELECT sao avaliadas para o papel da requisicao, a
-- policy "planos: admin le todos" derrubava a leitura anonima inteira com
-- "permission denied for function is_admin".
--
-- Correcao: escopar as policies de admin ao papel authenticated (o admin e
-- sempre autenticado). Assim uma requisicao anonima avalia apenas a policy
-- "planos: vitrine para autenticados" (publico and ativo), que nao chama
-- is_admin() e ja vale para o papel public (inclui anon).

alter policy "planos: admin le todos"
  on public.planos
  to authenticated;

alter policy "planos: admin gerencia"
  on public.planos
  to authenticated;
