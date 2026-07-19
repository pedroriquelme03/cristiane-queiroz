/**
 * Enquanto o projeto Supabase não é provisionado a plataforma roda com dados
 * de exemplo e sem autenticação. Este sinalizador é o que as telas consultam
 * para explicar isso ao usuário em vez de falhar de forma obscura.
 */
export const supabaseConfigurado = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
