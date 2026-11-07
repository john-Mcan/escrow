-- Tests de las funciones del backend. Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.users (id, privy_did, email, wallet_address) values
  ('00000000-0000-0000-0000-0000000000a1', 'did:privy:payee', 'payee@example.com', '0x' || repeat('a', 40)),
  ('00000000-0000-0000-0000-0000000000b1', 'did:privy:payer', 'payer@example.com', '0x' || repeat('b', 40)),
  ('00000000-0000-0000-0000-0000000000c1', 'did:privy:other', 'other@example.com', '0x' || repeat('c', 40));

set local role service_role;

create temporary table draft on commit drop as
select * from public.create_escrow_draft(
  p_creator_id => '00000000-0000-0000-0000-0000000000a1',
  p_chain_id => 84532,
  p_title => 'Sitio web',
  p_payee_address => '0x' || repeat('a', 40),
  p_milestones => '[{"title": "Diseño", "amount": "1000000000", "due_date": "2026-12-01"},
                    {"title": "Desarrollo", "description": "Next.js", "amount": "500500000"}]'::jsonb,
  p_description => 'Rediseño completo',
  p_payer_email => 'payer@example.com',
  p_payee_email => 'payee@example.com'
);

select is((select total_amount::text from draft), '1500500000', 'total_amount es la suma de los hitos');
select is((select status::text from draft), 'draft', 'el escrow nace como borrador');
select results_eq(
  $$ select milestone_index, title, amount::text from public.milestones
     where escrow_id = (select id from draft) order by milestone_index $$,
  $$ values (0, 'Diseño', '1000000000'), (1, 'Desarrollo', '500500000') $$,
  'los hitos conservan orden e índices on-chain'
);
select is(
  (select count(*)::int from public.escrow_activity_logs where escrow_id = (select id from draft) and action_type = 'created'),
  1,
  'se registra el log created'
);

select throws_ok(
  $$ select public.create_escrow_draft('00000000-0000-0000-0000-0000000000a1', 84532, 'Vacío', '0x' || repeat('a', 40), '[]'::jsonb) $$,
  '22023', null,
  'rechaza escrows sin hitos'
);

select throws_ok(
  $$ select public.create_escrow_draft('00000000-0000-0000-0000-0000000000a1', 84532, 'Monto cero', '0x' || repeat('a', 40),
       '[{"title": "X", "amount": "0"}]'::jsonb) $$,
  '23514', null,
  'rechaza hitos con monto cero (y revierte el escrow)'
);

select is(
  (select count(*)::int from public.list_user_escrows('00000000-0000-0000-0000-0000000000b1')),
  1,
  'el payer invitado por email ve el escrow'
);
select is(
  (select count(*)::int from public.list_user_escrows('00000000-0000-0000-0000-0000000000c1')),
  0,
  'un tercero no ve el escrow'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ select public.list_user_escrows('00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'authenticated no puede ejecutar funciones del backend'
);
reset role;

select * from finish();
rollback;
