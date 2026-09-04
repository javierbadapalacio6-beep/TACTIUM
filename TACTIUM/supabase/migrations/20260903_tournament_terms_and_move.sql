-- CONDICIONES DEL TORNEO + REUBICAR PAREJAS (petición del gestor de Smash).
--
-- Dos cosas que van juntas: el club quiere avisar de que "la organización se
-- reserva el derecho a reordenar parejas", y para que ese aviso valga algo
-- hacen falta las dos piezas:
--   1. CONDICIONES visibles al inscribirse + constancia de que se aceptaron.
--      · `tournaments.terms` = texto del club (NULL = condiciones estándar).
--      · `tournament_registrations.terms_accepted_at` + `terms_snapshot`:
--        cuándo aceptó y QUÉ texto aceptó. El snapshot es imprescindible: si
--        el club cambia las condiciones en octubre, el que se inscribió en
--        septiembre aceptó otra cosa.
--      · La casilla es OBLIGATORIA en app y web, y la RPC rechaza un `false`.
--        OJO con el tercer valor: `p_terms_accepted` es NULL cuando llama una
--        versión ANTIGUA de la app (las que aún no han recibido el OTA). Esas
--        se dejan pasar —si no, dejaríamos a esa gente sin poder inscribirse—
--        pero se quedan SIN constancia (accepted_at y snapshot a NULL): nunca
--        inventamos un consentimiento que nadie dio. Cuando el OTA esté
--        repartido, cambiar el DEFAULT a `false` cierra también esa puerta.
--   2. MOVER una inscripción de categoría/género sin borrarla y recrearla
--      (que perdía disponibilidad, puntos, estado de pago y código de pareja).
--
-- El texto por defecto vive AQUÍ, no en TS: es el que se guarda como prueba en
-- cada inscripción, así que la fuente de verdad tiene que ser una sola y estar
-- del lado del servidor. El cliente lo recibe ya resuelto en tournament_lookup.

-- ── 1 · Columnas ────────────────────────────────────────────────────────────
alter table public.tournaments
  add column if not exists terms text;

alter table public.tournament_registrations
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_snapshot text;

comment on column public.tournaments.terms is
  'Condiciones de participación del torneo. NULL = se usan las estándar (tournament_default_terms).';
comment on column public.tournament_registrations.terms_snapshot is
  'Texto de las condiciones TAL COMO estaban al aceptarlas (prueba del consentimiento).';

-- ── 2 · Condiciones estándar ────────────────────────────────────────────────
create or replace function public.tournament_default_terms()
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select
'1. La organización puede reubicar una pareja en otra categoría cuando su nivel no se corresponda con el de la categoría elegida.
2. La organización puede agrupar, dividir o suprimir categorías si no se alcanza un número mínimo de parejas inscritas, avisando a los afectados.
3. Los cuadros, los emparejamientos y el orden de juego los establece la organización. Los horarios publicados pueden variar por causas ajenas a ella (climatología, retrasos, bajas).
4. La inscripción no es firme hasta que el pago está confirmado.
5. La pareja debe presentarse a la hora fijada. La incomparecencia supone la eliminación por no presentado.
6. Los datos facilitados se usan únicamente para gestionar el torneo y publicar horarios, resultados y clasificaciones.
7. Al inscribirte aceptas estas condiciones y las decisiones de la organización sobre su interpretación.'::text;
$function$;

grant execute on function public.tournament_default_terms() to anon, authenticated;

-- ── 3 · tournament_lookup: devuelve también las condiciones ─────────────────
-- DROP + CREATE obligatorio: cambia el tipo de retorno.
drop function if exists public.tournament_lookup(text);

create function public.tournament_lookup(p_code text)
 returns table(id uuid, name text, genders text[], categories text[], pair_based boolean,
               starts_on date, ends_on date, entry_fee numeric, entry_fee_2 numeric,
               fee_currency text, category_rules jsonb, start_time text, end_time text,
               max_removable_hours integer, terms text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select id, name, genders, categories, coalesce(pair_based, true), starts_on, ends_on,
    entry_fee, entry_fee_2, fee_currency, category_rules, start_time, end_time,
    max_removable_hours,
    -- Ya resueltas: el cliente enseña exactamente lo que se va a guardar.
    coalesce(nullif(btrim(terms), ''), public.tournament_default_terms())
  from public.tournaments
  where signup_code = p_code and status = 'open';
$function$;

grant execute on function public.tournament_lookup(text) to anon, authenticated;

-- ── 4 · tournament_signup: exige la aceptación y la deja por escrito ────────
-- DROP + CREATE (no OR REPLACE): añadir un parámetro con DEFAULT crearía una
-- SOBRECARGA y las llamadas de 12 argumentos quedarían ambiguas.
drop function if exists public.tournament_signup(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer);

create function public.tournament_signup(
  p_code text, p1_name text, p1_email text, p1_phone text,
  p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}'::text[], p_category text default null,
  p_gender text default null, p_seed_points numeric default null,
  p_league_sum integer default null, p_terms_accepted boolean default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  t public.tournaments%rowtype;
  n int;
  reg_id uuid;
  v_title text;
  v_body text;
  v_terms text;
  v_accepted_at timestamptz;
begin
  select * into t from public.tournaments where signup_code = p_code;
  if not found then raise exception 'Código de torneo no válido'; end if;
  if t.status <> 'open' then raise exception 'La inscripción no está abierta'; end if;

  -- Condiciones. false = dijo que no (se rechaza). NULL = cliente antiguo que
  -- ni siquiera manda el dato (pasa, pero sin constancia). true = aceptó, y se
  -- guarda el texto TAL COMO está en este momento.
  if p_terms_accepted is false then
    raise exception 'Debes aceptar las condiciones del torneo para inscribirte';
  end if;
  if p_terms_accepted then
    v_accepted_at := now();
    v_terms := coalesce(nullif(btrim(t.terms), ''), public.tournament_default_terms());
  end if;

  if coalesce(array_length(t.genders, 1), 0) > 0 then
    if p_gender is null or not (p_gender = any(t.genders)) then
      raise exception 'Elige un género válido';
    end if;
  end if;
  if coalesce(array_length(t.categories, 1), 0) > 0 then
    if p_category is null or not (p_category = any(t.categories)) then
      raise exception 'Elige una categoría válida';
    end if;
  end if;

  -- Elegibilidad por reglas de categoría (nivel/puntos), si el torneo las define.
  -- Las reglas pueden ser por género ("género|categoría") con fallback a la
  -- clave solo-categoría (torneos antiguos o de un único género).
  if t.category_rules is not null and p_category is not null then
    declare
      v_mode text := coalesce(t.category_rules->>'mode', 'both');
      v_rule jsonb := coalesce(
        case when p_gender is not null
          then t.category_rules->'byCategory'->(p_gender || '|' || p_category)
          else null end,
        t.category_rules->'byCategory'->p_category
      );
      v_max_pts int;
      v_min_niv int;
    begin
      if v_rule is not null and v_rule <> 'null'::jsonb then
        v_max_pts := nullif(v_rule->>'puntos','')::int;
        v_min_niv := nullif(v_rule->>'nivel','')::int;
        if (v_mode in ('points','both')) and v_max_pts is not null then
          if p_seed_points is null then
            raise exception 'Indica los puntos de la pareja para la categoría %', p_category;
          end if;
          if p_seed_points > v_max_pts then
            raise exception 'Superáis el máximo de % puntos de la categoría % (sumáis %)', v_max_pts, p_category, p_seed_points::int;
          end if;
        end if;
        if (v_mode in ('nivel','both')) and v_min_niv is not null then
          if p_league_sum is null then
            raise exception 'Indica el nivel de cada jugador para la categoría %', p_category;
          end if;
          if p_league_sum < v_min_niv then
            raise exception 'Necesitáis nivel >= % en la categoría % (sumáis %)', v_min_niv, p_category, p_league_sum;
          end if;
        end if;
      end if;
    end;
  end if;

  if auth.uid() is not null and exists (
    select 1 from public.tournament_registrations r
    where r.tournament_id = t.id and r.status <> 'withdrawn'
      and (r.p1_user_id = auth.uid() or r.p2_user_id = auth.uid())
      and r.category is not distinct from p_category
      and r.gender is not distinct from p_gender
  ) then
    raise exception 'Ya estás inscrito en este torneo';
  end if;

  if t.max_pairs is not null then
    select count(*) into n from public.tournament_registrations
      where tournament_id = t.id and status <> 'withdrawn'
        and category is not distinct from p_category
        and gender is not distinct from p_gender;
    if n >= t.max_pairs then raise exception 'La división está completa'; end if;
  end if;

  insert into public.tournament_registrations
    (tournament_id, gender, category, p1_name, p1_email, p1_phone, p1_user_id,
     p2_name, p2_email, p2_phone, availability, seed_points, league_sum,
     terms_accepted_at, terms_snapshot)
  values
    (t.id, p_gender, p_category, p1_name, nullif(btrim(p1_email),''), nullif(btrim(p1_phone),''), auth.uid(),
     p2_name, nullif(btrim(p2_email),''), nullif(btrim(p2_phone),''), coalesce(p_availability, '{}'),
     p_seed_points, p_league_sum, v_accepted_at, v_terms)
  returning id into reg_id;

  v_title := 'Nueva inscripción 🎾';
  v_body := coalesce(p1_name, 'Alguien')
    || case when nullif(btrim(p2_name), '') is not null then ' / ' || p2_name else '' end
    || ' se ha apuntado a "' || t.name || '"'
    || case when p_category is not null then ' (' || p_category || ')' else '' end || '.';

  insert into public.notifications (user_id, type, title, body, data)
  select distinct a.u, 'tournament_signup', v_title, v_body,
         jsonb_build_object('tournament_id', t.id, 'registration_id', reg_id)
  from (
    select club.owner_id as u from public.clubs club where club.id = t.club_id
    union
    select cm.user_id from public.club_members cm
      where cm.club_id = t.club_id and cm.role = 'admin'
  ) a
  where a.u is not null and a.u is distinct from auth.uid();

  return reg_id;
end;
$function$;

grant execute on function public.tournament_signup(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer, boolean)
  to anon, authenticated;

-- ── 5 · Los dos wrappers, con el nuevo parámetro ────────────────────────────
-- Mismo motivo para el DROP: si no, la llamada de 12 argumentos sería ambigua.
drop function if exists public.tournament_signup_paid(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer);

create function public.tournament_signup_paid(
  p_code text, p1_name text, p1_email text, p1_phone text,
  p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}'::text[], p_category text default null,
  p_gender text default null, p_seed_points numeric default null,
  p_league_sum integer default null, p_terms_accepted boolean default null
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
begin
  perform set_config('tactium.paid_signup', 'on', true);  -- transaccional
  return public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum,
    p_terms_accepted
  );
end;
$function$;

-- Sigue siendo SOLO para el webhook (ver 20260902_revoke_definer_execute.sql):
-- una función nueva en `public` nace con EXECUTE para PUBLIC, así que hay que
-- quitárselo otra vez y devolvérselo a service_role.
revoke execute on function public.tournament_signup_paid(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.tournament_signup_paid(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer, boolean)
  to service_role;

drop function if exists public.tournament_signup_offline(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer);

create function public.tournament_signup_offline(
  p_code text, p1_name text, p1_email text, p1_phone text,
  p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}'::text[], p_category text default null,
  p_gender text default null, p_seed_points numeric default null,
  p_league_sum integer default null, p_terms_accepted boolean default null
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  perform set_config('tactium.paid_signup', 'on', true);
  v_id := public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum,
    p_terms_accepted
  );
  update public.tournament_registrations
     set payment_status = 'pending_club', payment_method = 'offline'
   where id = v_id;
  return v_id;
end;
$function$;

grant execute on function public.tournament_signup_offline(
  text, text, text, text, text, text, text, text[], text, text, numeric, integer, boolean)
  to anon, authenticated;

-- ── 6 · Reubicar una inscripción (el derecho que se reserva el club) ────────
-- Cambia género/categoría CONSERVANDO todo lo demás (disponibilidad, puntos,
-- estado de pago, código de compañero) y avisa a los jugadores por la campana.
-- Se niega si la pareja ya está colocada en un cuadro: ahí no es un movimiento,
-- es rehacer el cuadro.
create or replace function public.tournament_move_registration(
  p_reg_id uuid, p_gender text, p_category text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.tournament_registrations%rowtype;
  t public.tournaments%rowtype;
  v_body text;
begin
  select * into r from public.tournament_registrations where id = p_reg_id;
  if not found then raise exception 'Inscripción no encontrada'; end if;
  select * into t from public.tournaments where id = r.tournament_id;
  if not found then raise exception 'Torneo no encontrado'; end if;

  -- Solo el organizador (dueño del club o admin del club).
  if not exists (
    select 1 from public.clubs c where c.id = t.club_id and c.owner_id = auth.uid()
    union
    select 1 from public.club_members cm
     where cm.club_id = t.club_id and cm.user_id = auth.uid() and cm.role = 'admin'
  ) then
    raise exception 'Solo el organizador puede mover una inscripción'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(array_length(t.genders, 1), 0) > 0
     and (p_gender is null or not (p_gender = any(t.genders))) then
    raise exception 'Ese género no es del torneo';
  end if;
  if coalesce(array_length(t.categories, 1), 0) > 0
     and (p_category is null or not (p_category = any(t.categories))) then
    raise exception 'Esa categoría no es del torneo';
  end if;

  if r.gender is not distinct from p_gender
     and r.category is not distinct from p_category then
    return;  -- ya está donde se pide
  end if;

  if exists (
    select 1 from public.tournament_matches m
     where m.tournament_id = t.id
       and (m.home_reg = r.id or m.away_reg = r.id
            or m.home_reg2 = r.id or m.away_reg2 = r.id)
  ) then
    raise exception 'Esta pareja ya está en un cuadro: bórralo o regenéralo antes de moverla';
  end if;

  update public.tournament_registrations
     set gender = p_gender, category = p_category
   where id = r.id;

  v_body := 'La organización te ha movido a '
    || coalesce(p_category, 'otra categoría')
    || case when p_gender is not null then ' (' || p_gender || ')' else '' end
    || ' en "' || t.name || '".';

  insert into public.notifications (user_id, type, title, body, data)
  select distinct u, 'tournament_moved', 'Cambio de categoría', v_body,
         jsonb_build_object('tournament_id', t.id, 'registration_id', r.id)
  from (select r.p1_user_id as u union select r.p2_user_id) x
  where u is not null and u is distinct from auth.uid();
end;
$function$;

revoke execute on function public.tournament_move_registration(uuid, text, text)
  from public, anon;
grant execute on function public.tournament_move_registration(uuid, text, text)
  to authenticated;
