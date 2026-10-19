-- Datas efetivas de início e conclusão do plano de ação.
-- Complementam o prazo planejado; não substituem os demais campos nem o vínculo com a empresa.

alter table public.planos_acao
  add column if not exists data_inicio_efetiva date,
  add column if not exists data_conclusao_efetiva date;

comment on column public.planos_acao.data_inicio_efetiva is
  'Data em que a ação foi efetivamente iniciada (quando passa a em_andamento).';
comment on column public.planos_acao.data_conclusao_efetiva is
  'Data em que a ação foi efetivamente concluída.';

alter table public.planos_acao
  drop constraint if exists planos_acao_datas_efetivas_chk;

alter table public.planos_acao
  add constraint planos_acao_datas_efetivas_chk
  check (
    data_conclusao_efetiva is null
    or data_inicio_efetiva is null
    or data_conclusao_efetiva >= data_inicio_efetiva
  );
