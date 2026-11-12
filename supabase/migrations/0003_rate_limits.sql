-- =============================================================================
-- 0003_rate_limits.sql
-- Límite de solicitudes por cuenta o por IP, sin servicios externos: un contador por ventana fija.
-- =============================================================================

-- Una fila por clave y ventana. `key` identifica la acción y a quién se le cuenta (id de cuenta o hash de IP).
create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (key, window_start)
);

comment on table public.rate_limits is
  'Contadores del límite de solicitudes. Solo los usa el backend; el cron diario borra las ventanas vencidas.';

create index rate_limits_window_start_idx on public.rate_limits (window_start);

-- Suma un intento en la ventana actual y devuelve 0 si está dentro del límite; si no, los segundos que faltan para
-- que la ventana se libere (para el header Retry-After). Es atómica: el upsert serializa los intentos concurrentes.
-- Las ventanas se alinean a la época Unix (p. ej. de hora en hora y de día en día, en UTC).
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_window interval;
  v_start timestamptz;
  v_hits integer;
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit debe ser al menos 1' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'p_window_seconds debe estar entre 1 y 604800' using errcode = '22023';
  end if;

  v_window := make_interval(secs => p_window_seconds);
  v_start := date_bin(v_window, now(), timestamptz '1970-01-01 00:00:00+00');

  insert into public.rate_limits as r (key, window_start)
  values (p_key, v_start)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if v_hits <= p_limit then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_start + v_window - now())))::integer);
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Cuenta un intento; 0 = permitido, > 0 = segundos hasta que se libere la ventana. Uso exclusivo del backend.';

-- Privilegios: ni anon ni authenticated pueden leer ni consumir contadores.
revoke all on table public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.rate_limits to service_role;

alter table public.rate_limits enable row level security;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
