-- Apuração da Folha: importação do Extrato Mensal (PDF da folha) por competência.
--
-- folha_apuracoes      uma linha por empresa × mês, com totais, encargos, situações,
--                      resumo por rubrica e os valores digitados à mão (FGTS).
-- folha_funcionarios   o bloco de cada funcionário no extrato, com as rubricas.
-- folha_rubricas       configuração da empresa para cada rubrica: se soma ou subtrai
--                      no total da folha e em qual linha do custo ela entra.

create table public.folha_apuracoes (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  competencia       date not null check (extract(day from competencia) = 1),
  arquivo_nome      text not null,
  -- Empresa como impressa no relatório (código no sistema de folha, nome, CNPJ)
  empresa_relatorio jsonb not null default '{}'::jsonb,
  totais            jsonb not null default '{}'::jsonb,
  encargos          jsonb not null default '{}'::jsonb,
  situacoes         jsonb not null default '{}'::jsonb,
  -- [{codigo, descricao, tipo, referencia, valor}]
  resumo_rubricas   jsonb not null default '[]'::jsonb,
  -- Valores que o extrato não traz e o usuário informa: {fgts, fgtsProvFerias, fgtsProv13}
  manuais           jsonb not null default '{}'::jsonb,
  importado_por     uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (empresa_id, competencia)
);

create trigger set_updated_at before update on public.folha_apuracoes
  for each row execute function public.set_updated_at();

create table public.folha_funcionarios (
  id              uuid primary key default gen_random_uuid(),
  apuracao_id     uuid not null references public.folha_apuracoes(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  matricula       text not null,
  nome            text not null,
  situacao        text not null default '',
  vinculo         text,
  admissao        date,
  centro_custo    text,
  departamento    text,
  cargo_codigo    text,
  cargo           text,
  cbo             text,
  filial          text,
  salario         numeric(14,2),
  proventos       numeric(14,2) not null default 0,
  descontos       numeric(14,2) not null default 0,
  informativa     numeric(14,2) not null default 0,
  liquido         numeric(14,2) not null default 0,
  base_inss       numeric(14,2) not null default 0,
  excedente_inss  numeric(14,2) not null default 0,
  base_fgts       numeric(14,2) not null default 0,
  valor_fgts      numeric(14,2) not null default 0,
  base_irrf       numeric(14,2) not null default 0,
  -- [{codigo, descricao, tipo, referencia, valor}]
  rubricas        jsonb not null default '[]'::jsonb,
  observacoes     text[] not null default '{}'
);

create index folha_funcionarios_apuracao_idx on public.folha_funcionarios (apuracao_id);
create index folha_funcionarios_empresa_idx on public.folha_funcionarios (empresa_id, matricula);

create table public.folha_rubricas (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  codigo      text not null,
  tipo        text not null check (tipo in ('P','D')),
  descricao   text not null default '',
  efeito      text not null default 'soma' check (efeito in ('soma','subtrai','ignora')),
  categoria   text not null default 'proventos' check (categoria in (
                'proventos','comissao','produtividade','retornos',
                'decimo_terceiro','ferias','terco_ferias',
                'inss','inss_13','inss_ferias','ignorar')),
  updated_at  timestamptz not null default now(),
  primary key (empresa_id, codigo, tipo)
);

create trigger set_updated_at before update on public.folha_rubricas
  for each row execute function public.set_updated_at();

-- RLS: mesmo padrão das demais tabelas do tenant
alter table public.folha_apuracoes    enable row level security;
alter table public.folha_funcionarios enable row level security;
alter table public.folha_rubricas     enable row level security;

create policy "folha_apuracoes: membros leem" on public.folha_apuracoes
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_apuracoes: consultor escreve" on public.folha_apuracoes
  for all to authenticated
  using (private.can_edit_empresa(empresa_id)) with check (private.can_edit_empresa(empresa_id));

create policy "folha_funcionarios: membros leem" on public.folha_funcionarios
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_funcionarios: consultor escreve" on public.folha_funcionarios
  for all to authenticated
  using (private.can_edit_empresa(empresa_id)) with check (private.can_edit_empresa(empresa_id));

create policy "folha_rubricas: membros leem" on public.folha_rubricas
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_rubricas: consultor escreve" on public.folha_rubricas
  for all to authenticated
  using (private.can_edit_empresa(empresa_id)) with check (private.can_edit_empresa(empresa_id));

-- Grava (ou substitui) a apuração de um mês numa transação só: reimportar o
-- extrato nunca deixa o mês pela metade. Os valores manuais (FGTS) são
-- preservados na reimportação. Chamada apenas pelo servidor (service_role).
create or replace function public.importar_folha_extrato(
  p_empresa_id   uuid,
  p_competencia  date,
  p_apuracao     jsonb,
  p_funcionarios jsonb,
  p_usuario      uuid
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.folha_apuracoes as a (
    empresa_id, competencia, arquivo_nome, empresa_relatorio, totais,
    encargos, situacoes, resumo_rubricas, manuais, importado_por
  ) values (
    p_empresa_id,
    p_competencia,
    p_apuracao->>'arquivo_nome',
    coalesce(p_apuracao->'empresa_relatorio', '{}'::jsonb),
    coalesce(p_apuracao->'totais', '{}'::jsonb),
    coalesce(p_apuracao->'encargos', '{}'::jsonb),
    coalesce(p_apuracao->'situacoes', '{}'::jsonb),
    coalesce(p_apuracao->'resumo_rubricas', '[]'::jsonb),
    coalesce(p_apuracao->'manuais', '{}'::jsonb),
    p_usuario
  )
  on conflict (empresa_id, competencia) do update set
    arquivo_nome      = excluded.arquivo_nome,
    empresa_relatorio = excluded.empresa_relatorio,
    totais            = excluded.totais,
    encargos          = excluded.encargos,
    situacoes         = excluded.situacoes,
    resumo_rubricas   = excluded.resumo_rubricas,
    -- Mantém o que foi digitado; só preenche o que ainda não existe
    manuais           = excluded.manuais || a.manuais,
    importado_por     = excluded.importado_por
  returning id into v_id;

  delete from public.folha_funcionarios where apuracao_id = v_id;

  insert into public.folha_funcionarios (
    apuracao_id, empresa_id, matricula, nome, situacao, vinculo, admissao,
    centro_custo, departamento, cargo_codigo, cargo, cbo, filial, salario,
    proventos, descontos, informativa, liquido, base_inss, excedente_inss,
    base_fgts, valor_fgts, base_irrf, rubricas, observacoes
  )
  select
    v_id, p_empresa_id, f.matricula, f.nome, coalesce(f.situacao, ''), f.vinculo, f.admissao,
    f.centro_custo, f.departamento, f.cargo_codigo, f.cargo, f.cbo, f.filial, f.salario,
    coalesce(f.proventos, 0), coalesce(f.descontos, 0), coalesce(f.informativa, 0),
    coalesce(f.liquido, 0), coalesce(f.base_inss, 0), coalesce(f.excedente_inss, 0),
    coalesce(f.base_fgts, 0), coalesce(f.valor_fgts, 0), coalesce(f.base_irrf, 0),
    coalesce(f.rubricas, '[]'::jsonb), coalesce(f.observacoes, '{}')
  from jsonb_to_recordset(p_funcionarios) as f(
    matricula text, nome text, situacao text, vinculo text, admissao date,
    centro_custo text, departamento text, cargo_codigo text, cargo text, cbo text,
    filial text, salario numeric, proventos numeric, descontos numeric,
    informativa numeric, liquido numeric, base_inss numeric, excedente_inss numeric,
    base_fgts numeric, valor_fgts numeric, base_irrf numeric, rubricas jsonb,
    observacoes text[]
  );

  return v_id;
end;
$$;

revoke execute on function public.importar_folha_extrato(uuid, date, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.importar_folha_extrato(uuid, date, jsonb, jsonb, uuid)
  to service_role;

comment on table public.folha_apuracoes is
  'Apuração mensal da folha importada do Extrato Mensal (PDF).';
comment on table public.folha_rubricas is
  'Por empresa: efeito (soma/subtrai) e categoria de custo de cada rubrica da folha.';
