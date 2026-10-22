-- Apuração da Folha por unidade (CNPJ), com conferência, fechamento, histórico
-- de versões, controle de acesso a dados pessoais e integração com o DRE.
--
-- Uma competência passa a ter um relatório por unidade (ex.: Cataratas Park,
-- IP Cataratas e Restaurante IP no mesmo mês). Cada importação gera uma versão
-- imutável em folha_importacoes; toda alteração vira um evento em folha_eventos.

-- ---------------------------------------------------------------------------
-- Unidades: CNPJ identifica o relatório importado

alter table public.unidades add column if not exists cnpj text
  check (cnpj is null or cnpj ~ '^\d{14}$');
create unique index if not exists unidades_empresa_cnpj_idx
  on public.unidades (empresa_id, cnpj) where cnpj is not null;

-- ---------------------------------------------------------------------------
-- Acesso aos dados individuais da folha, por usuário da empresa
--   completo    nome, CPF e remuneração individual
--   individual  nome e remuneração individual, sem CPF
--   agregado    apenas totais por unidade e setor

alter table public.empresa_membros add column if not exists acesso_folha text not null
  default 'individual' check (acesso_folha in ('completo','individual','agregado'));
update public.empresa_membros set acesso_folha = 'completo' where papel = 'consultor';

create or replace function private.nivel_acesso_folha(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when private.is_admin() then 'completo'
    else (
      select acesso_folha from public.empresa_membros
      where empresa_id = p_empresa_id and user_id = auth.uid()
      limit 1
    )
  end;
$$;

revoke execute on function private.nivel_acesso_folha(uuid) from public, anon;
grant execute on function private.nivel_acesso_folha(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Apurações: uma por empresa × competência × unidade

alter table public.folha_apuracoes
  add column if not exists unidade_id uuid references public.unidades(id),
  add column if not exists avisos text[] not null default '{}';

alter table public.folha_apuracoes drop constraint if exists folha_apuracoes_empresa_id_competencia_key;
alter table public.folha_apuracoes add constraint folha_apuracoes_empresa_competencia_unidade_key
  unique nulls not distinct (empresa_id, competencia, unidade_id);

alter table public.folha_funcionarios
  add column if not exists unidade_id uuid references public.unidades(id),
  add column if not exists horas_mes numeric(7,2);

create index if not exists folha_funcionarios_unidade_idx
  on public.folha_funcionarios (unidade_id, matricula);

-- Coluna da tabela analítica escolhida para a rubrica (null = automática)
alter table public.folha_rubricas add column if not exists coluna text check (coluna is null or coluna in (
  'salario','he50','he100','adicional_noturno','gratificacoes','comissoes','insalubridade',
  'periculosidade','dsr','ferias','terco_ferias','decimo_terceiro','rescisorias',
  'outros_proventos','nao_remuneratorio',
  'inss','irrf','faltas','atrasos','afastamentos','adiantamento','adiantamento_ferias_13',
  'vale_transporte','emprestimo_consignado','outros_emprestimos','retornos','rescisao_paga',
  'outros_descontos'));

-- CPF fica numa tabela própria, legível só por quem tem acesso completo
create table public.folha_cpfs (
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  unidade_id  uuid not null references public.unidades(id) on delete cascade,
  matricula   text not null,
  cpf         text not null check (cpf ~ '^\d{11}$'),
  updated_at  timestamptz not null default now(),
  primary key (unidade_id, matricula)
);
create index folha_cpfs_empresa_idx on public.folha_cpfs (empresa_id);

-- ---------------------------------------------------------------------------
-- Cadastros da folha por unidade

-- Alíquotas e regras de encargos de cada CNPJ (percentuais: 20 = 20%)
create table public.folha_unidades_config (
  unidade_id     uuid primary key references public.unidades(id) on delete cascade,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  regime         text check (regime in ('simples','presumido','real')),
  inss_empresa   numeric(6,3) not null default 20 check (inss_empresa between 0 and 100),
  rat            numeric(6,3) not null default 0 check (rat between 0 and 100),
  terceiros      numeric(6,3) not null default 0 check (terceiros between 0 and 100),
  fgts           numeric(6,3) not null default 8 check (fgts between 0 and 100),
  fgts_aprendiz  numeric(6,3) not null default 2 check (fgts_aprendiz between 0 and 100),
  provisionar    boolean not null default true,
  updated_at     timestamptz not null default now()
);
create trigger set_updated_at before update on public.folha_unidades_config
  for each row execute function public.set_updated_at();

-- Nome do setor para o código de departamento impresso no relatório
create table public.folha_setores (
  unidade_id  uuid not null references public.unidades(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  codigo      text not null,
  nome        text not null check (length(trim(nome)) > 0),
  primary key (unidade_id, codigo)
);

-- Dados do colaborador que o relatório não traz: escala, jornada, setor
create table public.folha_colaboradores (
  unidade_id       uuid not null references public.unidades(id) on delete cascade,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  matricula        text not null,
  escala           text check (escala is null or length(escala) <= 30),
  jornada_semanal  numeric(5,2) check (jornada_semanal is null or jornada_semanal between 0 and 80),
  setor            text,
  updated_at       timestamptz not null default now(),
  primary key (unidade_id, matricula)
);
create trigger set_updated_at before update on public.folha_colaboradores
  for each row execute function public.set_updated_at();

-- Contratos de empréstimo: instituição e valor liberado não vêm no relatório
create table public.folha_emprestimos_contratos (
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  contrato        text not null,
  instituicao     text,
  valor_liberado  numeric(14,2) check (valor_liberado is null or valor_liberado >= 0),
  updated_at      timestamptz not null default now(),
  primary key (empresa_id, contrato)
);
create trigger set_updated_at before update on public.folha_emprestimos_contratos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Competência: conferência e fechamento

create table public.folha_competencias (
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  competencia        date not null check (extract(day from competencia) = 1),
  status             text not null default 'aberta' check (status in ('aberta','fechada')),
  -- chave da pendência → {texto, usuario_id, em}
  justificativas     jsonb not null default '{}'::jsonb,
  -- Configuração (rubricas, alíquotas, setores) congelada no fechamento
  snapshot           jsonb,
  fechado_por        uuid references public.profiles(id) on delete set null,
  fechado_em         timestamptz,
  reaberto_por       uuid references public.profiles(id) on delete set null,
  reaberto_em        timestamptz,
  motivo_reabertura  text,
  updated_at         timestamptz not null default now(),
  primary key (empresa_id, competencia)
);
create trigger set_updated_at before update on public.folha_competencias
  for each row execute function public.set_updated_at();

create or replace function public.folha_competencia_fechada(p_empresa_id uuid, p_competencia date)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.folha_competencias
    where empresa_id = p_empresa_id and competencia = p_competencia and status = 'fechada'
  );
$$;

-- Defesa no banco: competência fechada não aceita alteração na apuração.
-- (Delete fica de fora: só acontece em cascata, ao excluir a empresa.)
create or replace function public.bloquear_folha_fechada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.folha_competencia_fechada(new.empresa_id, new.competencia) then
    raise exception 'Competência % fechada: reabra antes de alterar.', to_char(new.competencia, 'MM/YYYY')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bloquear_folha_fechada before insert or update on public.folha_apuracoes
  for each row execute function public.bloquear_folha_fechada();

-- ---------------------------------------------------------------------------
-- Histórico: versões importadas e eventos

create table public.folha_importacoes (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  competencia       date not null,
  unidade_id        uuid references public.unidades(id) on delete set null,
  apuracao_id       uuid references public.folha_apuracoes(id) on delete set null,
  versao            integer not null,
  arquivo_nome      text not null,
  cnpj              text,
  empresa_relatorio jsonb not null default '{}'::jsonb,
  totais            jsonb not null default '{}'::jsonb,
  encargos          jsonb not null default '{}'::jsonb,
  qtd_funcionarios  integer not null default 0,
  -- Funcionários como importados nesta versão (sem CPF)
  funcionarios      jsonb not null default '[]'::jsonb,
  importado_por     uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index folha_importacoes_competencia_idx
  on public.folha_importacoes (empresa_id, competencia, unidade_id, versao desc);

create table public.folha_eventos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  competencia  date,
  unidade_id   uuid references public.unidades(id) on delete set null,
  tipo         text not null check (tipo in (
                 'importacao','rubrica','ajuste','cadastro','justificativa',
                 'fechamento','reabertura','exportacao','acesso')),
  descricao    text not null,
  detalhes     jsonb not null default '{}'::jsonb,
  usuario_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index folha_eventos_competencia_idx on public.folha_eventos (empresa_id, competencia, created_at desc);

-- ---------------------------------------------------------------------------
-- Integração com o DRE: custo apurado, gravado no fechamento da competência

create table public.folha_dre_contas (
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  natureza        text not null,
  plano_conta_id  uuid not null references public.plano_contas(id) on delete cascade,
  primary key (empresa_id, natureza)
);

create table public.folha_dre_lancamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  competencia     date not null,
  unidade_id      uuid references public.unidades(id) on delete set null,
  setor           text not null,
  centro_custo    text,
  natureza        text not null,
  tipo_custo      text not null check (tipo_custo in ('folha','encargos','provisoes','beneficios')),
  valor           numeric(14,2) not null,
  plano_conta_id  uuid references public.plano_contas(id) on delete set null,
  gerado_em       timestamptz not null default now()
);
create index folha_dre_lancamentos_competencia_idx on public.folha_dre_lancamentos (empresa_id, competencia);

-- ---------------------------------------------------------------------------
-- RLS

alter table public.folha_cpfs                  enable row level security;
alter table public.folha_unidades_config       enable row level security;
alter table public.folha_setores               enable row level security;
alter table public.folha_colaboradores         enable row level security;
alter table public.folha_emprestimos_contratos enable row level security;
alter table public.folha_competencias          enable row level security;
alter table public.folha_importacoes           enable row level security;
alter table public.folha_eventos               enable row level security;
alter table public.folha_dre_contas            enable row level security;
alter table public.folha_dre_lancamentos       enable row level security;

-- Dados individuais: só quem tem acesso completo ou individual
drop policy if exists "folha_funcionarios: membros leem" on public.folha_funcionarios;
create policy "folha_funcionarios: acesso individual" on public.folha_funcionarios
  for select to authenticated
  using (private.nivel_acesso_folha(empresa_id) in ('completo','individual'));

create policy "folha_importacoes: acesso individual" on public.folha_importacoes
  for select to authenticated
  using (private.nivel_acesso_folha(empresa_id) in ('completo','individual'));

create policy "folha_colaboradores: acesso individual" on public.folha_colaboradores
  for select to authenticated
  using (private.nivel_acesso_folha(empresa_id) in ('completo','individual'));

create policy "folha_emprestimos_contratos: acesso individual" on public.folha_emprestimos_contratos
  for select to authenticated
  using (private.nivel_acesso_folha(empresa_id) in ('completo','individual'));

create policy "folha_cpfs: acesso completo" on public.folha_cpfs
  for select to authenticated
  using (private.nivel_acesso_folha(empresa_id) = 'completo');

-- Configuração, fechamento, eventos e DRE: membros leem
create policy "folha_unidades_config: membros leem" on public.folha_unidades_config
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_setores: membros leem" on public.folha_setores
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_competencias: membros leem" on public.folha_competencias
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_eventos: membros leem" on public.folha_eventos
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_dre_contas: membros leem" on public.folha_dre_contas
  for select to authenticated using (private.has_empresa_access(empresa_id));
create policy "folha_dre_lancamentos: membros leem" on public.folha_dre_lancamentos
  for select to authenticated using (private.has_empresa_access(empresa_id));

-- As escritas dessas tabelas passam pelas server actions (service_role), que
-- conferem papel, competência fechada e registram o evento.

-- ---------------------------------------------------------------------------
-- Importação de um relatório (uma unidade) numa transação só

drop function if exists public.importar_folha_extrato(uuid, date, jsonb, jsonb, uuid);

create or replace function public.importar_folha_relatorio(
  p_empresa_id   uuid,
  p_competencia  date,
  p_unidade_id   uuid,
  p_apuracao     jsonb,
  p_funcionarios jsonb,
  p_cpfs         jsonb,
  p_usuario      uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id     uuid;
  v_versao integer;
begin
  if public.folha_competencia_fechada(p_empresa_id, p_competencia) then
    raise exception 'Competência % fechada: reabra antes de importar.', to_char(p_competencia, 'MM/YYYY')
      using errcode = 'P0001';
  end if;

  insert into public.folha_apuracoes as a (
    empresa_id, competencia, unidade_id, arquivo_nome, empresa_relatorio, totais,
    encargos, situacoes, resumo_rubricas, manuais, avisos, importado_por
  ) values (
    p_empresa_id,
    p_competencia,
    p_unidade_id,
    p_apuracao->>'arquivo_nome',
    coalesce(p_apuracao->'empresa_relatorio', '{}'::jsonb),
    coalesce(p_apuracao->'totais', '{}'::jsonb),
    coalesce(p_apuracao->'encargos', '{}'::jsonb),
    coalesce(p_apuracao->'situacoes', '{}'::jsonb),
    coalesce(p_apuracao->'resumo_rubricas', '[]'::jsonb),
    coalesce(p_apuracao->'manuais', '{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(p_apuracao->'avisos')), '{}'),
    p_usuario
  )
  on conflict on constraint folha_apuracoes_empresa_competencia_unidade_key do update set
    arquivo_nome      = excluded.arquivo_nome,
    empresa_relatorio = excluded.empresa_relatorio,
    totais            = excluded.totais,
    encargos          = excluded.encargos,
    situacoes         = excluded.situacoes,
    resumo_rubricas   = excluded.resumo_rubricas,
    -- Mantém o que foi digitado; só preenche o que ainda não existe
    manuais           = excluded.manuais || a.manuais,
    avisos            = excluded.avisos,
    importado_por     = excluded.importado_por
  returning id into v_id;

  -- Substitui os funcionários da unidade no mês: reimportar nunca duplica
  delete from public.folha_funcionarios where apuracao_id = v_id;

  insert into public.folha_funcionarios (
    apuracao_id, empresa_id, unidade_id, matricula, nome, situacao, vinculo, admissao,
    centro_custo, departamento, cargo_codigo, cargo, cbo, filial, horas_mes, salario,
    proventos, descontos, informativa, liquido, base_inss, excedente_inss,
    base_fgts, valor_fgts, base_irrf, rubricas, observacoes
  )
  select
    v_id, p_empresa_id, p_unidade_id, f.matricula, f.nome, coalesce(f.situacao, ''), f.vinculo, f.admissao,
    f.centro_custo, f.departamento, f.cargo_codigo, f.cargo, f.cbo, f.filial, f.horas_mes, f.salario,
    coalesce(f.proventos, 0), coalesce(f.descontos, 0), coalesce(f.informativa, 0),
    coalesce(f.liquido, 0), coalesce(f.base_inss, 0), coalesce(f.excedente_inss, 0),
    coalesce(f.base_fgts, 0), coalesce(f.valor_fgts, 0), coalesce(f.base_irrf, 0),
    coalesce(f.rubricas, '[]'::jsonb), coalesce(f.observacoes, '{}')
  from jsonb_to_recordset(p_funcionarios) as f(
    matricula text, nome text, situacao text, vinculo text, admissao date,
    centro_custo text, departamento text, cargo_codigo text, cargo text, cbo text,
    filial text, horas_mes numeric, salario numeric, proventos numeric, descontos numeric,
    informativa numeric, liquido numeric, base_inss numeric, excedente_inss numeric,
    base_fgts numeric, valor_fgts numeric, base_irrf numeric, rubricas jsonb,
    observacoes text[]
  );

  if p_unidade_id is not null then
    insert into public.folha_cpfs (empresa_id, unidade_id, matricula, cpf)
    select p_empresa_id, p_unidade_id, c.matricula, c.cpf
    from jsonb_to_recordset(coalesce(p_cpfs, '[]'::jsonb)) as c(matricula text, cpf text)
    where c.cpf ~ '^\d{11}$'
    on conflict (unidade_id, matricula) do update set cpf = excluded.cpf, updated_at = now();
  end if;

  select coalesce(max(versao), 0) + 1 into v_versao
  from public.folha_importacoes
  where empresa_id = p_empresa_id and competencia = p_competencia
    and unidade_id is not distinct from p_unidade_id;

  insert into public.folha_importacoes (
    empresa_id, competencia, unidade_id, apuracao_id, versao, arquivo_nome, cnpj,
    empresa_relatorio, totais, encargos, qtd_funcionarios, funcionarios, importado_por
  ) values (
    p_empresa_id, p_competencia, p_unidade_id, v_id, v_versao, p_apuracao->>'arquivo_nome',
    p_apuracao->'empresa_relatorio'->>'cnpj',
    coalesce(p_apuracao->'empresa_relatorio', '{}'::jsonb),
    coalesce(p_apuracao->'totais', '{}'::jsonb),
    coalesce(p_apuracao->'encargos', '{}'::jsonb),
    jsonb_array_length(p_funcionarios),
    p_funcionarios,
    p_usuario
  );

  insert into public.folha_eventos (empresa_id, competencia, unidade_id, tipo, descricao, detalhes, usuario_id)
  values (
    p_empresa_id, p_competencia, p_unidade_id, 'importacao',
    case when v_versao = 1 then 'Importação do relatório ' else 'Reimportação (versão ' || v_versao || ') do relatório ' end
      || (p_apuracao->>'arquivo_nome'),
    jsonb_build_object(
      'versao', v_versao,
      'arquivo', p_apuracao->>'arquivo_nome',
      'cnpj', p_apuracao->'empresa_relatorio'->>'cnpj',
      'funcionarios', jsonb_array_length(p_funcionarios),
      'totais', p_apuracao->'totais'
    ),
    p_usuario
  );

  return jsonb_build_object('apuracao_id', v_id, 'versao', v_versao);
end;
$$;

-- Fecha a competência: congela a configuração e grava o custo para o DRE
create or replace function public.fechar_folha_competencia(
  p_empresa_id   uuid,
  p_competencia  date,
  p_snapshot     jsonb,
  p_lancamentos  jsonb,
  p_resumo       jsonb,
  p_usuario      uuid
) returns void
language plpgsql
set search_path = public
as $$
begin
  if public.folha_competencia_fechada(p_empresa_id, p_competencia) then
    raise exception 'Competência % já está fechada.', to_char(p_competencia, 'MM/YYYY')
      using errcode = 'P0001';
  end if;

  insert into public.folha_competencias as c (empresa_id, competencia, status, snapshot, fechado_por, fechado_em)
  values (p_empresa_id, p_competencia, 'fechada', p_snapshot, p_usuario, now())
  on conflict (empresa_id, competencia) do update set
    status = 'fechada', snapshot = excluded.snapshot,
    fechado_por = excluded.fechado_por, fechado_em = excluded.fechado_em;

  -- Idempotente: o fechamento substitui o que houver da competência
  delete from public.folha_dre_lancamentos where empresa_id = p_empresa_id and competencia = p_competencia;
  insert into public.folha_dre_lancamentos (
    empresa_id, competencia, unidade_id, setor, centro_custo, natureza, tipo_custo, valor, plano_conta_id
  )
  select p_empresa_id, p_competencia, l.unidade_id, l.setor, l.centro_custo, l.natureza, l.tipo_custo, l.valor,
         (select plano_conta_id from public.folha_dre_contas d
          where d.empresa_id = p_empresa_id and d.natureza = l.natureza)
  from jsonb_to_recordset(p_lancamentos) as l(
    unidade_id uuid, setor text, centro_custo text, natureza text, tipo_custo text, valor numeric
  );

  insert into public.folha_eventos (empresa_id, competencia, tipo, descricao, detalhes, usuario_id)
  values (p_empresa_id, p_competencia, 'fechamento', 'Fechamento da competência', coalesce(p_resumo, '{}'::jsonb), p_usuario);
end;
$$;

create or replace function public.reabrir_folha_competencia(
  p_empresa_id   uuid,
  p_competencia  date,
  p_motivo       text,
  p_usuario      uuid
) returns void
language plpgsql
set search_path = public
as $$
begin
  update public.folha_competencias set
    status = 'aberta', reaberto_por = p_usuario, reaberto_em = now(), motivo_reabertura = p_motivo
  where empresa_id = p_empresa_id and competencia = p_competencia and status = 'fechada';
  if not found then
    raise exception 'Competência % não está fechada.', to_char(p_competencia, 'MM/YYYY')
      using errcode = 'P0001';
  end if;

  -- O DRE deixa de receber a competência até o novo fechamento
  delete from public.folha_dre_lancamentos where empresa_id = p_empresa_id and competencia = p_competencia;

  insert into public.folha_eventos (empresa_id, competencia, tipo, descricao, detalhes, usuario_id)
  values (p_empresa_id, p_competencia, 'reabertura', 'Reabertura da competência',
          jsonb_build_object('motivo', p_motivo), p_usuario);
end;
$$;

revoke execute on function public.importar_folha_relatorio(uuid, date, uuid, jsonb, jsonb, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.fechar_folha_competencia(uuid, date, jsonb, jsonb, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.reabrir_folha_competencia(uuid, date, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.folha_competencia_fechada(uuid, date) from public, anon;
grant execute on function public.importar_folha_relatorio(uuid, date, uuid, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.fechar_folha_competencia(uuid, date, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.reabrir_folha_competencia(uuid, date, text, uuid) to service_role;
grant execute on function public.folha_competencia_fechada(uuid, date) to authenticated, service_role;

comment on table public.folha_importacoes is
  'Versões imutáveis de cada relatório da folha importado (por unidade e competência).';
comment on table public.folha_eventos is
  'Trilha de auditoria da Apuração da Folha: importações, ajustes, fechamento, exportações.';
comment on table public.folha_dre_lancamentos is
  'Custo da folha apurado por unidade, setor, centro de custo e natureza; gravado no fechamento.';
