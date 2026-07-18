-- =============================================================================
-- Funcoes de agregacao usadas pelo Dashboard e pela tela Financeiro.
--
-- Todas rodam como SECURITY INVOKER (padrao), entao o RLS das tabelas base
-- continua valendo: quem nao enxerga a empresa recebe resultado vazio.
-- =============================================================================

-- Saldo em caixa na data: saldo inicial das contas + entradas - saidas
create or replace function public.saldo_em_caixa(p_empresa_id uuid, p_data date default current_date)
returns numeric
language sql
stable
as $$
  select
    coalesce((select sum(saldo_inicial) from public.contas_bancarias
              where empresa_id = p_empresa_id and ativo), 0)
    + coalesce((select sum(case when tipo = 'entrada' then valor else -valor end)
                from public.lancamentos
                where empresa_id = p_empresa_id and data <= p_data), 0);
$$;

-- KPIs do topo do dashboard, para o mes de p_competencia
create or replace function public.dashboard_kpis(
  p_empresa_id uuid,
  p_competencia date default date_trunc('month', current_date)::date
)
returns json
language sql
stable
as $$
  with periodo as (
    select date_trunc('month', p_competencia)::date as inicio,
           (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date as fim
  ),
  mov as (
    select
      coalesce(sum(l.valor) filter (where l.tipo = 'entrada'), 0) as entradas,
      coalesce(sum(l.valor) filter (where l.tipo = 'saida'), 0)   as saidas
    from public.lancamentos l, periodo p
    where l.empresa_id = p_empresa_id and l.data between p.inicio and p.fim
  ),
  ap as (
    select
      coalesce(sum(valor - valor_pago) filter (where status in ('aberto','parcial')), 0) as total,
      coalesce(sum(valor - valor_pago) filter (where status in ('aberto','parcial')
                                                 and vencimento < current_date), 0)     as vencido
    from public.titulos where empresa_id = p_empresa_id and tipo = 'pagar'
  ),
  ar as (
    select
      coalesce(sum(valor - valor_pago) filter (where status in ('aberto','parcial')), 0) as total,
      coalesce(sum(valor - valor_pago) filter (where status in ('aberto','parcial')
                                                 and vencimento < current_date), 0)     as vencido
    from public.titulos where empresa_id = p_empresa_id and tipo = 'receber'
  )
  select json_build_object(
    'competencia',       (select inicio from periodo),
    'saldo_caixa',       public.saldo_em_caixa(p_empresa_id),
    'faturamento_mes',   mov.entradas,
    'despesas_mes',      mov.saidas,
    'resultado_mes',     mov.entradas - mov.saidas,
    'margem_mes',        case when mov.entradas > 0
                              then round((mov.entradas - mov.saidas) / mov.entradas * 100, 2)
                              else null end,
    'contas_pagar',      ap.total,
    'contas_pagar_vencidas', ap.vencido,
    'contas_receber',    ar.total,
    'inadimplencia',     ar.vencido
  )
  from mov, ap, ar;
$$;

-- Serie diaria de entradas/saidas/saldo acumulado
create or replace function public.fluxo_caixa_diario(
  p_empresa_id uuid,
  p_inicio date,
  p_fim date
)
returns table (
  data           date,
  entradas       numeric,
  saidas         numeric,
  saldo_dia      numeric,
  saldo_acumulado numeric
)
language sql
stable
as $$
  with dias as (
    select generate_series(p_inicio, p_fim, interval '1 day')::date as data
  ),
  mov as (
    select l.data,
           sum(l.valor) filter (where l.tipo = 'entrada') as entradas,
           sum(l.valor) filter (where l.tipo = 'saida')   as saidas
    from public.lancamentos l
    where l.empresa_id = p_empresa_id and l.data between p_inicio and p_fim
    group by l.data
  ),
  base as (
    -- saldo na vespera do periodo, para o acumulado comecar no lugar certo
    select public.saldo_em_caixa(p_empresa_id, p_inicio - 1) as saldo
  )
  select d.data,
         coalesce(m.entradas, 0),
         coalesce(m.saidas, 0),
         coalesce(m.entradas, 0) - coalesce(m.saidas, 0),
         (select saldo from base)
           + sum(coalesce(m.entradas, 0) - coalesce(m.saidas, 0)) over (order by d.data)
  from dias d
  left join mov m on m.data = d.data
  order by d.data;
$$;

-- Projecao: saldo atual + titulos a receber/pagar em aberto, por dia de vencimento
create or replace function public.fluxo_caixa_projetado(
  p_empresa_id uuid,
  p_dias integer default 90
)
returns table (
  data            date,
  a_receber       numeric,
  a_pagar         numeric,
  saldo_projetado numeric
)
language sql
stable
as $$
  with dias as (
    select generate_series(current_date, current_date + p_dias, interval '1 day')::date as data
  ),
  prev as (
    select t.vencimento as data,
           sum(t.valor - t.valor_pago) filter (where t.tipo = 'receber') as a_receber,
           sum(t.valor - t.valor_pago) filter (where t.tipo = 'pagar')   as a_pagar
    from public.titulos t
    where t.empresa_id = p_empresa_id
      and t.status in ('aberto','parcial')
      and t.vencimento between current_date and current_date + p_dias
    group by t.vencimento
  )
  select d.data,
         coalesce(p.a_receber, 0),
         coalesce(p.a_pagar, 0),
         public.saldo_em_caixa(p_empresa_id)
           + sum(coalesce(p.a_receber, 0) - coalesce(p.a_pagar, 0)) over (order by d.data)
  from dias d
  left join prev p on p.data = d.data
  order by d.data;
$$;

-- DRE gerencial: realizado por grupo/conta no periodo, com o previsto do orcamento
create or replace function public.dre_gerencial(
  p_empresa_id uuid,
  p_inicio date,
  p_fim date
)
returns table (
  grupo_dre       text,
  plano_conta_id  uuid,
  codigo          text,
  conta           text,
  tipo            text,
  realizado       numeric,
  previsto        numeric
)
language sql
stable
as $$
  select
    pc.grupo_dre,
    pc.id,
    pc.codigo,
    pc.nome,
    pc.tipo,
    coalesce((
      select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
      from public.lancamentos l
      where l.plano_conta_id = pc.id and l.data between p_inicio and p_fim
    ), 0),
    coalesce((
      select sum(o.valor_previsto)
      from public.orcamentos o
      where o.plano_conta_id = pc.id
        and o.competencia between date_trunc('month', p_inicio)::date and p_fim
    ), 0)
  from public.plano_contas pc
  where pc.empresa_id = p_empresa_id and pc.ativo
  order by pc.codigo;
$$;
