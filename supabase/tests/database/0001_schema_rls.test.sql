-- Tests de esquema y RLS. Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- -----------------------------------------------------------------------------
-- Fixtures (como el backend: rol privilegiado que ignora RLS)
-- -----------------------------------------------------------------------------
insert into public.users (id, privy_did, email, wallet_address, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'did:privy:provider', 'provider@example.com', '0x' || repeat('a', 40), 'Agencia Andes'),
  ('00000000-0000-0000-0000-00000000000b', 'did:privy:client', 'client@example.com', '0x' || repeat('b', 40), 'Cliente SA'),
  ('00000000-0000-0000-0000-00000000000c', 'did:privy:stranger', 'stranger@example.com', '0x' || repeat('c', 40), 'Ajeno');

-- E1: creado por el proveedor; el cliente participa por email.
insert into public.escrows (id, short_code, chain_id, title, creator_id, payer_email, payee_email, payee_address, total_amount)
values ('11111111-1111-1111-1111-111111111111', 'Pay2Test42', 84532, 'Landing page', '00000000-0000-0000-0000-00000000000a',
        'client@example.com', 'provider@example.com', '0x' || repeat('a', 40), 1500000000);

-- E2: creado por "stranger"; el cliente participa por wallet (sin email).
insert into public.escrows (id, chain_id, title, creator_id, payer_address, payee_address, total_amount)
values ('22222222-2222-2222-2222-222222222222', 84532, 'Logo', '00000000-0000-0000-0000-00000000000c',
        '0x' || repeat('b', 40), '0x' || repeat('c', 40), 100000000);

insert into public.milestones (id, escrow_id, milestone_index, title, amount, deliverable_url) values
  ('33333333-3333-3333-3333-333333333330', '11111111-1111-1111-1111-111111111111', 0, 'Diseño', 1000000000, 'https://files.example.com/design.pdf'),
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 1, 'Desarrollo', 500000000, null),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 0, 'Logo final', 100000000, null);

insert into public.escrow_activity_logs (escrow_id, action_type, actor_address) values
  ('11111111-1111-1111-1111-111111111111', 'created', '0x' || repeat('a', 40));
insert into public.escrow_activity_logs (escrow_id, milestone_id, action_type, actor_address, tx_hash, log_index) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333330', 'dispute_opened',
   '0x' || repeat('b', 40), '0x' || repeat('1', 64), 0);

-- -----------------------------------------------------------------------------
-- Integridad de datos
-- -----------------------------------------------------------------------------
select matches(
  (select short_code from public.escrows where id = '22222222-2222-2222-2222-222222222222'),
  '^[A-Za-z0-9]{10}$',
  'short_code se genera automáticamente'
);

select throws_ok(
  $$ update public.escrows set status = 'funded' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'no se puede marcar fondeado sin prueba on-chain'
);

select throws_ok(
  $$ update public.escrows set onchain_escrow_id = 1 where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'los campos on-chain se escriben juntos'
);

select lives_ok(
  $$ update public.escrows
     set status = 'funded', onchain_escrow_id = 1, contract_address = '0x' || repeat('e', 40),
         tx_hash_funded = '0x' || repeat('f', 64), platform_fee_bps = 150, payer_address = '0x' || repeat('b', 40)
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'fondeo completo con prueba on-chain es aceptado'
);

select throws_ok(
  $$ insert into public.escrows (chain_id, title, creator_id, payee_address, total_amount, onchain_escrow_id,
                                 contract_address, tx_hash_funded, platform_fee_bps)
     values (84532, 'Duplicado', '00000000-0000-0000-0000-00000000000a', '0x' || repeat('a', 40), 1,
             1, '0x' || repeat('e', 40), '0x' || repeat('9', 64), 150) $$,
  '23505', null,
  'un escrow on-chain no puede vincularse a dos registros'
);

select throws_ok(
  $$ insert into public.users (privy_did, wallet_address) values ('did:privy:upper', '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD') $$,
  '23514', null,
  'direcciones en mayúsculas son rechazadas'
);

select throws_ok(
  $$ insert into public.escrows (chain_id, title, creator_id, payee_address, total_amount)
     values (84532, 'Monto cero', '00000000-0000-0000-0000-00000000000a', '0x' || repeat('a', 40), 0) $$,
  '23514', null,
  'montos deben ser positivos'
);

select throws_ok(
  $$ update public.milestones set status = 'released' where id = '33333333-3333-3333-3333-333333333331' $$,
  '23514', null,
  'un hito liberado requiere tx_hash_settled'
);

select throws_ok(
  $$ update public.milestones set deliverable_url = 'javascript:alert(1)' where id = '33333333-3333-3333-3333-333333333331' $$,
  '23514', null,
  'deliverable_url solo acepta https'
);

select throws_ok(
  $$ insert into public.milestones (escrow_id, milestone_index, title, amount)
     values ('11111111-1111-1111-1111-111111111111', 1, 'Índice repetido', 1) $$,
  '23505', null,
  'milestone_index es único por escrow'
);

select throws_ok(
  $$ insert into public.escrow_activity_logs (escrow_id, action_type) values ('11111111-1111-1111-1111-111111111111', 'released') $$,
  '23514', null,
  'acciones on-chain requieren tx_hash y log_index'
);

select throws_ok(
  $$ insert into public.escrow_activity_logs (escrow_id, milestone_id, action_type, tx_hash, log_index)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333330', 'dispute_opened',
             '0x' || repeat('1', 64), 0) $$,
  '23505', null,
  '(tx_hash, log_index) evita registrar dos veces el mismo evento'
);

select throws_ok(
  $$ insert into public.escrow_activity_logs (escrow_id, milestone_id, action_type)
     values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333330', 'deliverable_submitted') $$,
  '23503', null,
  'el hito de un log debe pertenecer al mismo escrow'
);

select throws_ok(
  $$ update public.escrow_activity_logs set metadata = '{"x": 1}' $$,
  '42501', null,
  'escrow_activity_logs es append-only (UPDATE)'
);

select throws_ok(
  $$ delete from public.escrow_activity_logs $$,
  '42501', null,
  'escrow_activity_logs es append-only (DELETE)'
);

-- -----------------------------------------------------------------------------
-- anon: sin acceso a tablas, solo checkout público
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select * from public.escrows $$,
  '42501', null,
  'anon no puede leer escrows directamente'
);

select ok(
  public.get_public_checkout('11111111-1111-1111-1111-111111111111') ->> 'title' = 'Landing page',
  'anon obtiene el checkout por UUID'
);

select ok(
  public.get_public_checkout('Pay2Test42') ->> 'id' = '11111111-1111-1111-1111-111111111111',
  'anon obtiene el checkout por short_code'
);

select ok(
  not (public.get_public_checkout('Pay2Test42') ?| array['payer_email', 'payee_email', 'creator_id']),
  'el checkout público no expone emails ni ids internos'
);

select ok(
  (public.get_public_checkout('Pay2Test42') -> 'milestones' -> 0 ->> 'has_deliverable')::boolean
    and not (public.get_public_checkout('Pay2Test42') -> 'milestones' -> 0 ? 'deliverable_url'),
  'el checkout público oculta la URL del entregable'
);

select is(
  public.get_public_checkout('NoExiste99'),
  null,
  'referencia inexistente devuelve NULL'
);

reset role;

-- -----------------------------------------------------------------------------
-- authenticated: solo escrows donde participa
-- -----------------------------------------------------------------------------
set local role authenticated;

-- Proveedor (creador de E1)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
select results_eq(
  $$ select id from public.escrows order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'el proveedor ve solo su escrow'
);

-- Cliente: E1 por email y E2 por wallet
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
select results_eq(
  $$ select id from public.escrows order by id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid), ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'el cliente ve escrows donde participa por email o wallet'
);
select is(
  (select count(*)::int from public.milestones),
  3,
  'el cliente ve los hitos de sus escrows'
);
select is(
  (select count(*)::int from public.users),
  1,
  'cada usuario solo ve su propia fila en users'
);

-- Tercero: solo E2 (es su creador); nada de E1
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.escrows where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'un tercero no ve escrows ajenos'
);
select is(
  (select count(*)::int from public.milestones where escrow_id = '11111111-1111-1111-1111-111111111111')
    + (select count(*)::int from public.escrow_activity_logs where escrow_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'un tercero no ve hitos ni actividad de escrows ajenos'
);

select throws_ok(
  $$ insert into public.escrows (chain_id, title, creator_id, payee_address, total_amount)
     values (84532, 'Hack', '00000000-0000-0000-0000-00000000000c', '0x' || repeat('c', 40), 1) $$,
  '42501', null,
  'authenticated no puede insertar escrows'
);

select throws_ok(
  $$ update public.escrows set status = 'completed' where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'authenticated no puede modificar escrows (ni siendo el creador)'
);

select throws_ok(
  $$ update public.milestones set status = 'released' $$,
  '42501', null,
  'authenticated no puede modificar hitos'
);

reset role;

select * from finish();
rollback;
