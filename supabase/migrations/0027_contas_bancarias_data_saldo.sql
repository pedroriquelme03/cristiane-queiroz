-- Data de referência do saldo inicial (contas bancárias / caixa).
-- O saldo atual = saldo_inicial + movimentações da conta com data >= data_saldo_inicial.

alter table public.contas_bancarias
  add column if not exists data_saldo_inicial date not null default current_date;

comment on column public.contas_bancarias.data_saldo_inicial is
  'Data a partir da qual o saldo_inicial vale; lançamentos anteriores não entram no saldo da conta.';

comment on column public.contas_bancarias.saldo_inicial is
  'Saldo na data_saldo_inicial. Movimentações posteriores atualizam o saldo sem alterar este valor.';

-- Saldo em caixa: por conta, saldo_inicial + lançamentos vinculados a partir da data de referência.
-- Lançamentos sem conta_bancaria_id continuam entrando no total (legado).
create or replace function public.saldo_em_caixa(p_empresa_id uuid, p_data date default current_date)
returns numeric
language sql
stable
set search_path = public
as $$
  select
    coalesce((
      select sum(c.saldo_inicial)
      from public.contas_bancarias c
      where c.empresa_id = p_empresa_id and c.ativo
    ), 0)
    + coalesce((
      select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
      from public.lancamentos l
      left join public.contas_bancarias c on c.id = l.conta_bancaria_id
      where l.empresa_id = p_empresa_id
        and l.data <= p_data
        and coalesce(l.impacta_fluxo, true)
        and (
          l.conta_bancaria_id is null
          or (c.id is not null and l.data >= c.data_saldo_inicial)
        )
    ), 0);
$$;
