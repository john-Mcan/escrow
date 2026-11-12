-- Tests del límite de solicitudes. Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

set local role service_role;

select is(public.consume_rate_limit('test:a', 2, 3600), 0, 'primer intento: permitido');
select is(public.consume_rate_limit('test:a', 2, 3600), 0, 'segundo intento: permitido (justo en el límite)');
select cmp_ok(public.consume_rate_limit('test:a', 2, 3600), '>', 0, 'tercer intento: bloqueado');
select cmp_ok(
  public.consume_rate_limit('test:a', 2, 3600), '<=', 3600,
  'los segundos de espera no superan la ventana'
);
select is(public.consume_rate_limit('test:b', 2, 3600), 0, 'cada clave lleva su propia cuenta');
select is(
  (select hits from public.rate_limits where key = 'test:a'),
  4,
  'los intentos bloqueados también suman'
);

select throws_ok(
  $$ select public.consume_rate_limit('test:c', 0, 3600) $$,
  '22023', null,
  'rechaza un límite menor que 1'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.consume_rate_limit('test:d', 10, 60) $$,
  '42501', null,
  'authenticated no puede consumir contadores'
);
reset role;

select * from finish();
rollback;
