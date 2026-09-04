-- BLINDAJE: quitar de la API pública las funciones SECURITY DEFINER que nunca
-- debieron ser llamables por REST.
--
-- El agujero que motiva esta migración: `tournament_signup_paid` es el WRAPPER
-- que pone el flag `tactium.paid_signup='on'` para saltarse el trigger
-- `tournament_registration_paid_gate`. Existe SOLO para que el webhook de
-- Stripe cree la inscripción una vez cobrada. Pero se creó
-- (20260818_tournament_signup_paid_gate.sql) sin revocar nada, y en Postgres
-- una función nueva en `public` nace con EXECUTE para PUBLIC — es decir, para
-- `anon`. Como la clave anon es pública (viaja en el JS de la web), cualquiera
-- podía inscribirse en un torneo de pago sin pagar:
--
--   POST /rest/v1/rpc/tournament_signup_paid  { p_code: "...", ... }
--
-- y encima la fila quedaba con payment_status NULL (el 'paid' lo pone el
-- webhook DESPUÉS), así que ni siquiera aparecía como pendiente de cobro.
--
-- OJO al patrón de los revoke: hay que quitarlo de PUBLIC, no de `anon`. Si
-- revocas solo de anon, el privilegio le sigue llegando por PUBLIC y no has
-- hecho nada. Y como revocar de PUBLIC también deja fuera a `service_role`,
-- hay que devolvérselo explícitamente o rompes el webhook.

-- ── 1. El bypass de pago ────────────────────────────────────────────────────
-- Cubre todas las sobrecargas por si algún día se añade otra firma.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'tournament_signup_paid'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    -- El webhook la llama con service_role: ese sí la necesita.
    execute format('grant execute on function %s to service_role', f.sig);
    raise notice 'revocada de anon/authenticated: %', f.sig;
  end loop;
end $$;

-- ── 2. Funciones de TRIGGER ─────────────────────────────────────────────────
-- Una función que devuelve `trigger` no es una API: PostgREST no debería
-- exponerla y ejecutar el trigger NO requiere EXECUTE sobre ella (el motor la
-- invoca por cuenta de la tabla). Revocar aquí es inocuo y calla un buen
-- puñado de los avisos del linter de Supabase.
do $$
declare f record; n int := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prorettype = 'pg_catalog.trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    n := n + 1;
  end loop;
  raise notice 'funciones de trigger cerradas: %', n;
end $$;

-- ── 3. Helper interno ───────────────────────────────────────────────────────
-- `_tpd_is_club_admin` (el `_` ya lo delata) solo se usa DENTRO de otras
-- funciones SECURITY DEFINER, que se ejecutan como su propietario y por tanto
-- no pierden el acceso. Ningún cliente la llama.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = '_tpd_is_club_admin'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ── Comprobación ────────────────────────────────────────────────────────────
-- Debe devolver 0 filas. Si devuelve alguna, el revoke no ha surtido efecto.
do $$
declare v_left int;
begin
  select count(*) into v_left
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'tournament_signup_paid'
     and (has_function_privilege('anon', p.oid, 'EXECUTE')
       or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_left > 0 then
    raise exception 'tournament_signup_paid SIGUE siendo ejecutable por anon/authenticated';
  end if;
  raise notice 'OK: el bypass de pago ya no es alcanzable desde la API pública';
end $$;
