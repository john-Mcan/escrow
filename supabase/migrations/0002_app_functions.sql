-- =============================================================================
-- 0002_app_functions.sql
-- Funciones transaccionales del backend. Solo service_role puede ejecutarlas.
-- =============================================================================

-- Crea un borrador de escrow con sus hitos y el log 'created' en una sola transacción.
-- p_milestones: [{"title": text, "description": text|null, "amount": "<entero en unidades base>", "due_date": "YYYY-MM-DD"|null}]
create function public.create_escrow_draft(
  p_creator_id uuid,
  p_chain_id integer,
  p_title text,
  p_payee_address text,
  p_milestones jsonb,
  p_description text default null,
  p_payer_email text default null,
  p_payee_email text default null
)
returns public.escrows
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_escrow public.escrows;
  v_count integer;
  v_total numeric(78, 0);
begin
  if jsonb_typeof(p_milestones) is distinct from 'array' then
    raise exception 'p_milestones debe ser un arreglo JSON' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_milestones);
  if v_count < 1 or v_count > 20 then
    raise exception 'Un escrow debe tener entre 1 y 20 hitos (recibidos: %)', v_count using errcode = '22023';
  end if;

  select sum((m.value ->> 'amount')::numeric(78, 0))
  into v_total
  from jsonb_array_elements(p_milestones) as m(value);

  insert into public.escrows (
    chain_id, title, description, creator_id, payer_email, payee_email, payee_address, total_amount
  )
  values (
    p_chain_id, p_title, nullif(p_description, ''), p_creator_id, p_payer_email, p_payee_email, p_payee_address, v_total
  )
  returning * into v_escrow;

  insert into public.milestones (escrow_id, milestone_index, title, description, amount, due_date)
  select
    v_escrow.id,
    (m.ordinality - 1)::integer,
    m.value ->> 'title',
    nullif(m.value ->> 'description', ''),
    (m.value ->> 'amount')::numeric(78, 0),
    (m.value ->> 'due_date')::date
  from jsonb_array_elements(p_milestones) with ordinality as m(value, ordinality);

  insert into public.escrow_activity_logs (escrow_id, actor_address, action_type, metadata)
  values (
    v_escrow.id,
    p_payee_address,
    'created',
    jsonb_build_object('milestones', v_count, 'total_amount', v_total::text)
  );

  return v_escrow;
end;
$$;

comment on function public.create_escrow_draft(uuid, integer, text, text, jsonb, text, text, text) is
  'Crea escrow + hitos + log created de forma atómica. Uso exclusivo del backend.';

-- Escrows donde participa un usuario (misma regla que la política RLS escrows_select_participant).
create function public.list_user_escrows(p_user_id uuid)
returns setof public.escrows
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.escrows e
  join public.users u on u.id = p_user_id
  where e.creator_id = u.id
     or e.payee_address = u.wallet_address
     or e.payer_address = u.wallet_address
     or e.payee_email = u.email
     or e.payer_email = u.email
  order by e.created_at desc
  limit 200;
$$;

comment on function public.list_user_escrows(uuid) is
  'Escrows en los que participa el usuario (creador, payer o payee). Uso exclusivo del backend.';

revoke all on function
  public.create_escrow_draft(uuid, integer, text, text, jsonb, text, text, text),
  public.list_user_escrows(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_escrow_draft(uuid, integer, text, text, jsonb, text, text, text),
  public.list_user_escrows(uuid)
to service_role;
