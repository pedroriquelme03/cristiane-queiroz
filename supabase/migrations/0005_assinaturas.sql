-- =============================================================================
-- Assinaturas: planos, assinatura por tenant, faturas e bloqueio por atraso
--
-- O papel 'admin' (controle total da plataforma) e o super admin da CQ: so ele
-- cria planos e gerencia as assinaturas dos tenants. Cada empresa tem no maximo
-- uma assinatura; as faturas sao o historico de cobrancas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Planos de assinatura (globais, definidos pelo super admin)
-- -----------------------------------------------------------------------------

create table public.planos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descricao      text,
  preco_mensal   numeric(12,2) not null default 0 check (preco_mensal >= 0),
  -- preco anual cheio (12x). Nulo = plano nao oferece ciclo anual.
  preco_anual    numeric(12,2) check (preco_anual is null or preco_anual >= 0),
  trial_dias     integer not null default 0 check (trial_dias >= 0),
  -- Recursos exibidos na tela do cliente (lista de textos)
  recursos       jsonb not null default '[]'::jsonb,
  -- Limites do plano. Nulo = ilimitado.
  limite_usuarios  integer check (limite_usuarios is null or limite_usuarios >= 0),
  limite_empresas  integer check (limite_empresas is null or limite_empresas >= 0),
  -- publico: aparece para o cliente escolher. Um plano pode existir so para
  -- contratos sob medida sem ficar visivel na vitrine.
  publico        boolean not null default true,
  ativo          boolean not null default true,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger set_updated_at before update on public.planos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assinatura do tenant (uma por empresa)
-- -----------------------------------------------------------------------------

create table public.assinaturas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null unique references public.empresas(id) on delete cascade,
  plano_id         uuid not null references public.planos(id) on delete restrict,
  ciclo            text not null default 'mensal' check (ciclo in ('mensal','anual')),
  status           text not null default 'trial'
                     check (status in ('trial','ativa','inadimplente','bloqueada','cancelada')),
  -- Dia do mes usado para gerar o vencimento das faturas (1-28)
  dia_vencimento   integer not null default 5 check (dia_vencimento between 1 and 28),
  -- Dias de tolerancia entre o vencimento e o bloqueio do acesso
  carencia_dias    integer not null default 7 check (carencia_dias >= 0),
  inicio           date not null default current_date,
  trial_fim        date,
  -- Bloqueio manual pelo super admin, independente das faturas
  bloqueio_manual  boolean not null default false,
  cancelada_em     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.assinaturas (plano_id);
create index on public.assinaturas (status);
create trigger set_updated_at before update on public.assinaturas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Faturas (cobrancas geradas para a assinatura)
-- -----------------------------------------------------------------------------

create table public.faturas (
  id               uuid primary key default gen_random_uuid(),
  assinatura_id    uuid not null references public.assinaturas(id) on delete cascade,
  -- Desnormalizado de proposito: simplifica o RLS e as consultas do tenant
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  competencia      date not null,               -- dia 1 do mes de referencia
  emissao          date not null default current_date,
  vencimento       date not null,
  valor            numeric(12,2) not null check (valor >= 0),
  valor_pago       numeric(12,2) not null default 0 check (valor_pago >= 0),
  status           text not null default 'aberta'
                     check (status in ('aberta','paga','cancelada')),
  pago_em          date,
  metodo_pagamento text check (metodo_pagamento in ('pix','boleto','cartao','transferencia','outro')),
  -- Referencia da cobranca no gateway (Mercado Pago/Asaas/Stripe), quando houver
  referencia_externa text,
  observacao       text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.faturas (empresa_id, vencimento desc);
create index on public.faturas (assinatura_id, competencia desc);
create trigger set_updated_at before update on public.faturas
  for each row execute function public.set_updated_at();

-- "vencida" e derivado (aberta + vencimento no passado), nunca armazenado
create view public.faturas_view as
  select f.*,
         (f.valor - f.valor_pago) as saldo,
         case
           when f.status in ('paga','cancelada') then f.status
           when f.vencimento < current_date then 'vencida'
           else f.status
         end as status_efetivo,
         greatest(0, current_date - f.vencimento) as dias_atraso
  from public.faturas f;

-- -----------------------------------------------------------------------------
-- Estado de bloqueio: uma empresa esta bloqueada quando o super admin a
-- bloqueou manualmente, ou quando existe fatura em aberto vencida ha mais dias
-- do que a carencia da assinatura.
-- -----------------------------------------------------------------------------

create or replace function public.empresa_bloqueada(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select a.bloqueio_manual
        or a.status = 'cancelada'
        or exists (
          select 1 from public.faturas f
          where f.assinatura_id = a.id
            and f.status = 'aberta'
            and f.vencimento < current_date - a.carencia_dias
        )
    from public.assinaturas a
    where a.empresa_id = p_empresa_id
  ), false);
$$;

-- Recalcula o status da assinatura a partir das faturas. Chamada apos registrar
-- pagamento ou pela rotina diaria de cobranca.
create or replace function public.recalcular_status_assinatura(p_assinatura_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assinaturas%rowtype;
  v_vencida_grave boolean;
  v_vencida boolean;
begin
  select * into a from public.assinaturas where id = p_assinatura_id;
  if not found or a.status = 'cancelada' then
    return;
  end if;

  select
    bool_or(f.status = 'aberta' and f.vencimento < current_date),
    bool_or(f.status = 'aberta' and f.vencimento < current_date - a.carencia_dias)
    into v_vencida, v_vencida_grave
  from public.faturas f where f.assinatura_id = a.id;

  update public.assinaturas set status =
    case
      when a.bloqueio_manual then 'bloqueada'
      when coalesce(v_vencida_grave, false) then 'bloqueada'
      when coalesce(v_vencida, false) then 'inadimplente'
      when a.trial_fim is not null and a.trial_fim >= current_date then 'trial'
      else 'ativa'
    end
  where id = p_assinatura_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter view public.faturas_view set (security_invoker = true);

alter table public.planos       enable row level security;
alter table public.assinaturas  enable row level security;
alter table public.faturas      enable row level security;

-- Planos: qualquer autenticado le os planos publicos e ativos (vitrine).
-- O admin le todos e e o unico que escreve.
create policy "planos: vitrine para autenticados"
  on public.planos for select
  using (publico and ativo);

create policy "planos: admin le todos"
  on public.planos for select
  using (public.is_admin());

create policy "planos: admin gerencia"
  on public.planos for all
  using (public.is_admin())
  with check (public.is_admin());

-- Assinaturas: membros da empresa leem a propria; so o admin escreve
-- (contratar/trocar/pagar sao operacoes da consultoria nesta fase).
create policy "assinaturas: membros leem a propria"
  on public.assinaturas for select
  using (public.has_empresa_access(empresa_id));

create policy "assinaturas: admin gerencia"
  on public.assinaturas for all
  using (public.is_admin())
  with check (public.is_admin());

-- Faturas: membros leem as da propria empresa; so o admin escreve.
create policy "faturas: membros leem"
  on public.faturas for select
  using (public.has_empresa_access(empresa_id));

create policy "faturas: admin gerencia"
  on public.faturas for all
  using (public.is_admin())
  with check (public.is_admin());
