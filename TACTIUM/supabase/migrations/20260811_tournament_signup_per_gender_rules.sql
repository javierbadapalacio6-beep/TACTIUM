-- Reglas de elegibilidad por categoría AHORA por género: la clave de
-- `category_rules->byCategory` puede ser "género|categoría" (cuando el torneo
-- tiene varios géneros y cada uno fija distintos nivel/puntos) con fallback a
-- la clave solo-categoría (torneos antiguos o de un único género).
CREATE OR REPLACE FUNCTION public.tournament_signup(p_code text, p1_name text, p1_email text, p1_phone text, p2_name text, p2_email text, p2_phone text, p_availability text[] DEFAULT '{}'::text[], p_category text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_seed_points numeric DEFAULT NULL::numeric, p_league_sum integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  t public.tournaments%rowtype;
  n int;
  reg_id uuid;
  v_title text;
  v_body text;
begin
  select * into t from public.tournaments where signup_code = p_code;
  if not found then raise exception 'Código de torneo no válido'; end if;
  if t.status <> 'open' then raise exception 'La inscripción no está abierta'; end if;

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
            raise exception 'Indica el nivel de liga de cada jugador para la categoría %', p_category;
          end if;
          if p_league_sum < v_min_niv then
            raise exception 'Necesitáis nivel de liga >= % en la categoría % (sumáis %)', v_min_niv, p_category, p_league_sum;
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
     p2_name, p2_email, p2_phone, availability, seed_points, league_sum)
  values
    (t.id, p_gender, p_category, p1_name, nullif(btrim(p1_email),''), nullif(btrim(p1_phone),''), auth.uid(),
     p2_name, nullif(btrim(p2_email),''), nullif(btrim(p2_phone),''), coalesce(p_availability, '{}'),
     p_seed_points, p_league_sum)
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
