-- «No soy federado» con comprobación (petición de Smash, 14-10-2026).
-- Quien se inscribe en un torneo puede marcar a un jugador como NO federado (cuenta 0 puntos y 0 de nivel). Era una
-- puerta a hacer trampa: un federado escrito como «no federado» entraba en una categoría que no le toca. Ahora el
-- nombre se cruza con la Federación (plantillas de liga + rankings de liga y circuito) y, si coincide, se rechaza.
--
-- Coincidencia: nombres normalizados (sin tildes ni mayúsculas, sin «de/del/la…») y los apellidos+nombre de uno
-- contenidos en el otro, con al menos 2 palabras en el más corto. Vale en cualquier orden («Bada Palacio, Javier»).

create or replace function private.name_tokens(p_name text)
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(distinct t order by t), '{}')
    from unnest(string_to_array(
           btrim(regexp_replace(
             translate(lower(coalesce(p_name, '')), 'áéíóúüñàèìòùâêîôûç', 'aeiouunaeiouaeiouc'),
             '[^a-z0-9]+', ' ', 'g')), ' ')) as t
   where t <> '' and t not in ('de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'do', 'di');
$$;

-- Coincidencias en la Federación (hasta 3 nombres). Sin 2 palabras útiles no se puede comprobar → vacío.
create or replace function public.fcp_federated_matches(p_name text)
returns text[]
language plpgsql stable security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_tok text[] := private.name_tokens(p_name);
  v_out text[];
begin
  if cardinality(v_tok) < 2 then return '{}'; end if;
  select coalesce(array_agg(x.nombre), '{}') into v_out
    from (
      select distinct c.nombre
        from (
          select j.nombre, private.name_tokens(coalesce(nullif(btrim(coalesce(j.nombre_pila, '') || ' ' || coalesce(j.apellido1, '') || ' ' || coalesce(j.apellido2, '')), ''), j.nombre)) as tk
            from public.fcp_jugadores j
          union
          select r.nombre, private.name_tokens(r.nombre) from public.fcp_rankings r
        ) c
       where least(cardinality(c.tk), cardinality(v_tok)) >= 2
         and (v_tok <@ c.tk or c.tk <@ v_tok)
       limit 3
    ) x;
  return v_out;
end $$;

-- Para que el cliente avise al momento (antes de enviar). Devuelve [{name, federated, fcp_name}].
create or replace function public.check_not_federated(p_names text[])
returns jsonb
language plpgsql stable security definer set search_path = 'public', 'pg_temp'
as $$
declare
  n text;
  m text[];
  out jsonb := '[]'::jsonb;
begin
  foreach n in array coalesce(p_names, '{}') loop
    m := public.fcp_federated_matches(n);
    out := out || jsonb_build_array(jsonb_build_object(
      'name', n, 'federated', cardinality(m) > 0, 'fcp_name', m[1]));
  end loop;
  return out;
end $$;

revoke all on function public.fcp_federated_matches(text) from public, anon, authenticated;
revoke all on function public.check_not_federated(text[]) from public;
grant execute on function public.check_not_federated(text[]) to anon, authenticated;

-- ── tournament_signup: dos parámetros nuevos (al final, con valor por defecto) ──
do $$
declare
  def text;
  nw  text;
begin
  select pg_get_functiondef('public.tournament_signup(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean)'::regprocedure) into def;
  nw := replace(def, 'p_terms_accepted boolean DEFAULT NULL::boolean)', 'p_terms_accepted boolean DEFAULT NULL::boolean, p1_not_fed boolean DEFAULT NULL::boolean, p2_not_fed boolean DEFAULT NULL::boolean)');
  nw := replace(nw,
    E'if t.status <> ''open'' then raise exception ''La inscripción no está abierta''; end if;',
    E'if t.status <> ''open'' then raise exception ''La inscripción no está abierta''; end if;\r\n\r\n  -- «No federado» con comprobación: si el nombre figura en la Federación, no vale.\r\n  if coalesce(p1_not_fed, false) and cardinality(public.fcp_federated_matches(p1_name)) > 0 then\r\n    raise exception ''% figura como jugador federado en la Federación Cántabra: no puede inscribirse como no federado. Indica sus puntos y su nivel.'', p1_name;\r\n  end if;\r\n  if coalesce(p2_not_fed, false) and cardinality(public.fcp_federated_matches(p2_name)) > 0 then\r\n    raise exception ''% figura como jugador federado en la Federación Cántabra: no puede inscribirse como no federado. Indica sus puntos y su nivel.'', p2_name;\r\n  end if;');
  if nw = def or position('fcp_federated_matches' in nw) = 0 then
    raise exception 'No se pudo parchear tournament_signup';
  end if;
  drop function public.tournament_signup(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean);
  execute nw;
end $$;

grant execute on function public.tournament_signup(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean,boolean,boolean) to anon, authenticated, service_role;

-- ── Los dos envoltorios pasan los nuevos parámetros ───────────────────────
drop function if exists public.tournament_signup_offline(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean);
create or replace function public.tournament_signup_offline(
  p_code text, p1_name text, p1_email text, p1_phone text, p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}', p_category text default null, p_gender text default null,
  p_seed_points numeric default null, p_league_sum integer default null, p_terms_accepted boolean default null,
  p1_not_fed boolean default null, p2_not_fed boolean default null
) returns uuid
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  perform set_config('tactium.paid_signup', 'on', true);
  v_id := public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum,
    p_terms_accepted, p1_not_fed, p2_not_fed
  );
  update public.tournament_registrations
     set payment_status = 'pending_club', payment_method = 'offline'
   where id = v_id;
  return v_id;
end $$;
grant execute on function public.tournament_signup_offline(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean,boolean,boolean) to anon, authenticated, service_role;

drop function if exists public.tournament_signup_paid(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean);
create or replace function public.tournament_signup_paid(
  p_code text, p1_name text, p1_email text, p1_phone text, p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}', p_category text default null, p_gender text default null,
  p_seed_points numeric default null, p_league_sum integer default null, p_terms_accepted boolean default null,
  p1_not_fed boolean default null, p2_not_fed boolean default null
) returns uuid
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
begin
  perform set_config('tactium.paid_signup', 'on', true);  -- transaccional
  return public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum,
    p_terms_accepted, p1_not_fed, p2_not_fed
  );
end $$;
revoke all on function public.tournament_signup_paid(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean,boolean,boolean) from public, anon, authenticated;
grant execute on function public.tournament_signup_paid(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean,boolean,boolean) to service_role;
