-- DRE gerencial: realizado pela emissão dos títulos (competência)
-- + lançamentos manuais/importados. Baixas (origem integração) não entram
-- para evitar duplicar o valor já reconhecido na emissão do título.

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
set search_path = public
as $$
  select
    pc.grupo_dre,
    pc.id,
    pc.codigo,
    pc.nome,
    pc.tipo,
    coalesce((
      select sum(case when t.tipo = 'receber' then t.valor else -t.valor end)
      from public.titulos t
      where t.plano_conta_id = pc.id
        and t.status <> 'cancelado'
        and coalesce(t.emissao, t.vencimento) between p_inicio and p_fim
    ), 0)
    + coalesce((
      select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
      from public.lancamentos l
      where l.plano_conta_id = pc.id
        and l.data between p_inicio and p_fim
        and l.origem <> 'integracao'
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

comment on function public.dre_gerencial(uuid, date, date) is
  'DRE: realizado por emissão de títulos (pagar/receber) + lançamentos manuais; exclui baixas.';
