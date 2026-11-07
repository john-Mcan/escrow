-- =============================================================================
-- 0001_initial_schema.sql
-- Escrow no-custodio por hitos (USDC en Base): esquema inicial, índices y RLS.
--
-- Modelo de acceso
--   * Identidad: Privy (no Supabase Auth). Si el cliente necesita leer vía PostgREST/Realtime, el backend verifica
--     el access token de Privy y emite un JWT de Supabase con `sub = public.users.id` y `role = authenticated`.
--   * Escrituras: SOLO el backend (service_role), después de verificar el token de Privy y/o la transacción
--     on-chain. anon/authenticated no tienen privilegios de escritura (ni GRANT ni políticas).
--   * Lecturas: authenticated ve únicamente los escrows en los que participa (creador, o payer/payee por wallet o
--     email verificado) y sus hitos, actividad y evidencias.
--   * Checkout público (/pay/[id]): anon NO lee tablas. Usa get_public_checkout(), que devuelve solo campos
--     públicos (sin emails ni URLs de entregables).
--
-- Convenciones
--   * Montos: unidades base del token (USDC = 6 decimales). 1 USDC = 1000000.
--   * Direcciones EVM y hashes en minúsculas (el backend normaliza antes de escribir).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
comment on schema private is 'Funciones internas: no expuesto por la Data API.';

-- -----------------------------------------------------------------------------
-- Dominios y enums
-- -----------------------------------------------------------------------------

create domain public.eth_address as text
  check (value ~ '^0x[0-9a-f]{40}$');
comment on domain public.eth_address is 'Dirección EVM de 20 bytes en minúsculas con prefijo 0x.';

create domain public.tx_hash as text
  check (value ~ '^0x[0-9a-f]{64}$');
comment on domain public.tx_hash is 'Hash de transacción de 32 bytes en minúsculas con prefijo 0x.';

create domain public.token_amount as numeric(78, 0)
  check (value > 0);
comment on domain public.token_amount is 'Monto positivo en unidades base del token (uint256). USDC: 6 decimales.';

create type public.escrow_status as enum (
  'draft',
  'funded',
  'in_progress',
  'completed',
  'disputed',
  'cancelled'
);

-- 'resolved' refleja MilestoneStatus.Resolved on-chain (reparto del árbitro, incluido un split parcial).
create type public.milestone_status as enum (
  'pending',
  'funded',
  'delivered_review',
  'released',
  'refunded',
  'disputed',
  'resolved'
);

create type public.escrow_action_type as enum (
  'created',
  'funded',
  'deliverable_submitted',
  'released',
  'refunded',
  'dispute_opened',
  'dispute_resolved'
);

-- -----------------------------------------------------------------------------
-- Funciones utilitarias (schema private)
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabla %.% es append-only: % no está permitido', tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- Código corto para URLs amigables (/pay/<short_code>). Alfabeto sin caracteres ambiguos (0/O, 1/l/I).
create function private.generate_short_code(p_length integer default 10)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  random_bytes bytea := extensions.gen_random_bytes(p_length);
  code text := '';
begin
  for i in 0 .. p_length - 1 loop
    code := code || substr(alphabet, 1 + get_byte(random_bytes, i) % length(alphabet), 1);
  end loop;
  return code;
end;
$$;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  privy_did text not null unique
    check (privy_did ~ '^did:privy:[A-Za-z0-9]+$'),
  email text unique
    check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  wallet_address public.eth_address unique,
  display_name text
    check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Usuarios autenticados con Privy (Email/Google + embedded wallet, o wallet externa).';
comment on column public.users.privy_did is 'DID de Privy (did:privy:...). Identificador estable del usuario.';
comment on column public.users.email is 'Email verificado por Privy, en minúsculas. Se usa para emparejar invitaciones.';
comment on column public.users.wallet_address is 'Wallet principal (embedded wallet de Privy o EOA/smart account conectada).';

create trigger users_set_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- escrows
-- -----------------------------------------------------------------------------

create table public.escrows (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique default private.generate_short_code()
    check (short_code ~ '^[A-Za-z0-9]{6,16}$'),
  chain_id integer not null
    check (chain_id > 0),
  contract_address public.eth_address,
  onchain_escrow_id numeric(78, 0)
    check (onchain_escrow_id > 0),
  tx_hash_funded public.tx_hash,
  platform_fee_bps smallint
    check (platform_fee_bps between 0 and 500),
  title text not null
    check (char_length(title) between 1 and 140),
  description text
    check (char_length(description) <= 5000),
  creator_id uuid not null references public.users (id) on delete restrict,
  payer_email text
    check (payer_email = lower(payer_email) and payer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  payee_email text
    check (payee_email = lower(payee_email) and payee_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  payer_address public.eth_address,
  payee_address public.eth_address not null,
  total_amount public.token_amount not null,
  status public.escrow_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un escrow on-chain se identifica por (red, contrato, id); evita vincular dos registros al mismo escrow.
  constraint escrows_onchain_identity_key unique (chain_id, contract_address, onchain_escrow_id),
  -- Los datos de fondeo se escriben juntos, solo desde la reconciliación on-chain.
  constraint escrows_onchain_fields_together check (
    (onchain_escrow_id is null) = (tx_hash_funded is null)
    and (onchain_escrow_id is null) = (contract_address is null)
    and (onchain_escrow_id is null) = (platform_fee_bps is null)
  ),
  -- Cualquier estado posterior al borrador exige prueba on-chain del depósito.
  constraint escrows_non_draft_requires_funding check (
    status in ('draft', 'cancelled')
    or (onchain_escrow_id is not null and payer_address is not null)
  ),
  constraint escrows_distinct_parties check (payer_address <> payee_address)
);

comment on table public.escrows is 'Acuerdo de cobro. Contexto humano off-chain + trazabilidad on-chain del fondeo.';
comment on column public.escrows.id is 'UUID usado en /pay/[id]. On-chain viaja como referenceId (bytes32) en EscrowCreated.';
comment on column public.escrows.short_code is 'Código corto para URLs amigables (/pay/<short_code>).';
comment on column public.escrows.onchain_escrow_id is 'escrowId en MilestoneEscrow. NULL hasta que la reconciliación confirma el fondeo.';
comment on column public.escrows.contract_address is 'Dirección de MilestoneEscrow donde vive el escrow.';
comment on column public.escrows.platform_fee_bps is 'Fee fijado on-chain al crear el escrow (snapshot del evento EscrowCreated).';
comment on column public.escrows.total_amount is 'Suma de los hitos en unidades base de USDC (6 decimales).';
comment on column public.escrows.creator_id is 'Proveedor (freelancer/agencia/comercio) que creó el link de cobro.';

create index escrows_creator_id_created_at_idx on public.escrows (creator_id, created_at desc);
create index escrows_payee_address_idx on public.escrows (payee_address);
create index escrows_payer_address_idx on public.escrows (payer_address) where payer_address is not null;
create index escrows_payer_email_idx on public.escrows (payer_email) where payer_email is not null;
create index escrows_payee_email_idx on public.escrows (payee_email) where payee_email is not null;
create index escrows_tx_hash_funded_idx on public.escrows (tx_hash_funded) where tx_hash_funded is not null;
create index escrows_disputed_idx on public.escrows (created_at desc) where status = 'disputed';

create trigger escrows_set_updated_at
  before update on public.escrows
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- milestones
-- -----------------------------------------------------------------------------

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows (id) on delete cascade,
  -- Índice del hito en el contrato (MilestoneEscrow.MAX_MILESTONES = 20).
  milestone_index integer not null
    check (milestone_index between 0 and 19),
  title text not null
    check (char_length(title) between 1 and 140),
  description text
    check (char_length(description) <= 5000),
  deliverable_url text
    check (deliverable_url ~ '^https://' and char_length(deliverable_url) <= 2048),
  deliverable_notes text
    check (char_length(deliverable_notes) <= 5000),
  amount public.token_amount not null,
  due_date date,
  status public.milestone_status not null default 'pending',
  tx_hash_settled public.tx_hash,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint milestones_escrow_index_key unique (escrow_id, milestone_index),
  -- Permite FKs compuestas que garantizan que un hito referenciado pertenece al mismo escrow.
  constraint milestones_id_escrow_key unique (id, escrow_id),
  -- Un hito liquidado siempre tiene su recibo on-chain, y solo los liquidados lo tienen.
  constraint milestones_settlement_requires_tx check (
    (status in ('released', 'refunded', 'resolved')) = (tx_hash_settled is not null)
  )
);

comment on table public.milestones is 'Hitos de un escrow. milestone_index coincide con el índice on-chain.';
comment on column public.milestones.amount is 'Monto del hito en unidades base de USDC (6 decimales).';
comment on column public.milestones.deliverable_url is 'Link/archivo del entregable (solo https). No se expone en el checkout público.';
comment on column public.milestones.tx_hash_settled is 'Tx de liberación, reembolso o resolución del hito (recibo auditable en Basescan).';

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- escrow_activity_logs (historial auditable, append-only)
-- -----------------------------------------------------------------------------

create table public.escrow_activity_logs (
  id bigint generated always as identity primary key,
  escrow_id uuid not null references public.escrows (id) on delete restrict,
  milestone_id uuid,
  actor_address public.eth_address,
  action_type public.escrow_action_type not null,
  tx_hash public.tx_hash,
  log_index integer
    check (log_index >= 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),

  constraint escrow_activity_logs_milestone_fkey foreign key (milestone_id, escrow_id)
    references public.milestones (id, escrow_id) on delete restrict,
  -- Las acciones on-chain llevan (tx_hash, log_index); las off-chain (crear borrador, subir entregable) no.
  constraint escrow_activity_logs_onchain_proof check (
    (action_type in ('created', 'deliverable_submitted')) = (tx_hash is null)
    and (tx_hash is null) = (log_index is null)
  ),
  -- Clave de idempotencia de la reconciliación: un evento on-chain se registra una sola vez.
  constraint escrow_activity_logs_event_key unique (tx_hash, log_index)
);

comment on table public.escrow_activity_logs is 'Historial auditable e inmutable de cada escrow (off-chain + eventos on-chain).';
comment on column public.escrow_activity_logs.log_index is 'logIndex del evento en el recibo; junto con tx_hash identifica el evento de forma única.';
comment on column public.escrow_activity_logs.metadata is 'Datos del evento decodificado (montos, fee, payerShareBps, etc.).';

create index escrow_activity_logs_escrow_id_created_at_idx
  on public.escrow_activity_logs (escrow_id, created_at desc);
create index escrow_activity_logs_milestone_idx
  on public.escrow_activity_logs (milestone_id, escrow_id) where milestone_id is not null;

create trigger escrow_activity_logs_append_only
  before update or delete on public.escrow_activity_logs
  for each row execute function private.forbid_mutation();
create trigger escrow_activity_logs_no_truncate
  before truncate on public.escrow_activity_logs
  for each statement execute function private.forbid_mutation();

-- -----------------------------------------------------------------------------
-- disputes_evidence (append-only)
-- -----------------------------------------------------------------------------

create table public.disputes_evidence (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid not null references public.escrows (id) on delete restrict,
  milestone_id uuid not null,
  submitted_by uuid not null references public.users (id) on delete restrict,
  comment text not null
    check (char_length(comment) between 1 and 5000),
  attachment_url text
    check (attachment_url ~ '^https://' and char_length(attachment_url) <= 2048),
  created_at timestamptz not null default now(),

  constraint disputes_evidence_milestone_fkey foreign key (milestone_id, escrow_id)
    references public.milestones (id, escrow_id) on delete restrict
);

comment on table public.disputes_evidence is 'Evidencia aportada por las partes para el panel de arbitraje. Inmutable.';

create index disputes_evidence_escrow_id_created_at_idx on public.disputes_evidence (escrow_id, created_at);
create index disputes_evidence_milestone_idx on public.disputes_evidence (milestone_id, escrow_id);
create index disputes_evidence_submitted_by_idx on public.disputes_evidence (submitted_by);

create trigger disputes_evidence_append_only
  before update or delete on public.disputes_evidence
  for each row execute function private.forbid_mutation();
create trigger disputes_evidence_no_truncate
  before truncate on public.disputes_evidence
  for each statement execute function private.forbid_mutation();

-- -----------------------------------------------------------------------------
-- Identidad del usuario actual (para RLS)
-- -----------------------------------------------------------------------------

-- SECURITY INVOKER: se ejecutan con los permisos del llamador y respetan la RLS de users (solo su propia fila).
create function private.current_wallet_address()
returns public.eth_address
language sql
stable
set search_path = ''
as $$
  select u.wallet_address from public.users u where u.id = (select auth.uid());
$$;

create function private.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select u.email from public.users u where u.id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Privilegios (defensa en profundidad además de RLS)
-- -----------------------------------------------------------------------------

revoke all on table
  public.users,
  public.escrows,
  public.milestones,
  public.escrow_activity_logs,
  public.disputes_evidence
from public, anon, authenticated;

grant select on table
  public.users,
  public.escrows,
  public.milestones,
  public.escrow_activity_logs,
  public.disputes_evidence
to authenticated;

grant select, insert, update, delete on table public.users, public.escrows, public.milestones to service_role;
-- Tablas append-only: ni siquiera el backend tiene UPDATE/DELETE.
grant select, insert on table public.escrow_activity_logs, public.disputes_evidence to service_role;

revoke all on function
  private.set_updated_at(),
  private.forbid_mutation(),
  private.generate_short_code(integer),
  private.current_wallet_address(),
  private.current_email()
from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;
grant execute on function private.generate_short_code(integer) to service_role;
grant execute on function private.current_wallet_address(), private.current_email() to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.escrows enable row level security;
alter table public.milestones enable row level security;
alter table public.escrow_activity_logs enable row level security;
alter table public.disputes_evidence enable row level security;

-- No se definen políticas INSERT/UPDATE/DELETE: con RLS activo quedan denegadas para anon/authenticated.
-- service_role ignora RLS por diseño (BYPASSRLS) y es el único que escribe.

create policy users_select_own
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy escrows_select_participant
  on public.escrows
  for select
  to authenticated
  using (
    creator_id = (select auth.uid())
    or payee_address = (select private.current_wallet_address())
    or payer_address = (select private.current_wallet_address())
    or payee_email = (select private.current_email())
    or payer_email = (select private.current_email())
  );

-- Las subconsultas sobre escrows heredan su RLS: solo devuelven escrows visibles para el usuario.
create policy milestones_select_participant
  on public.milestones
  for select
  to authenticated
  using (escrow_id in (select e.id from public.escrows e));

create policy escrow_activity_logs_select_participant
  on public.escrow_activity_logs
  for select
  to authenticated
  using (escrow_id in (select e.id from public.escrows e));

create policy disputes_evidence_select_participant
  on public.disputes_evidence
  for select
  to authenticated
  using (escrow_id in (select e.id from public.escrows e));

-- -----------------------------------------------------------------------------
-- Checkout público (/pay/[escrowId] o /pay/[short_code])
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER a propósito: anon no tiene acceso a tablas y solo recibe esta proyección pública.
-- Montos e ids on-chain se devuelven como texto para no perder precisión en JavaScript (uint256).
create function public.get_public_checkout(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_escrow_id uuid;
begin
  if p_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_escrow_id := p_reference::uuid;
  elsif p_reference ~ '^[A-Za-z0-9]{6,16}$' then
    select e.id into v_escrow_id from public.escrows e where e.short_code = p_reference;
  end if;

  if v_escrow_id is null then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'id', e.id,
      'short_code', e.short_code,
      'title', e.title,
      'description', e.description,
      'status', e.status,
      'chain_id', e.chain_id,
      'contract_address', e.contract_address,
      'onchain_escrow_id', e.onchain_escrow_id::text,
      'tx_hash_funded', e.tx_hash_funded,
      'platform_fee_bps', e.platform_fee_bps,
      'total_amount', e.total_amount::text,
      'payer_address', e.payer_address,
      'payee_address', e.payee_address,
      'provider_display_name', creator.display_name,
      'created_at', e.created_at,
      'milestones', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'milestone_index', m.milestone_index,
              'title', m.title,
              'description', m.description,
              'amount', m.amount::text,
              'due_date', m.due_date,
              'status', m.status,
              'has_deliverable', m.deliverable_url is not null,
              'tx_hash_settled', m.tx_hash_settled
            )
            order by m.milestone_index
          )
          from public.milestones m
          where m.escrow_id = e.id
        ),
        '[]'::jsonb
      )
    )
    from public.escrows e
    join public.users creator on creator.id = e.creator_id
    where e.id = v_escrow_id
  );
end;
$$;

comment on function public.get_public_checkout(text) is
  'Vista pública de un link de cobro por UUID o short_code. Sin emails ni URLs de entregables.';

revoke all on function public.get_public_checkout(text) from public;
grant execute on function public.get_public_checkout(text) to anon, authenticated, service_role;
