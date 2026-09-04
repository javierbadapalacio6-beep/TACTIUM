-- AGRUPAR CATEGORÍAS (petición Smash, 2026-09-03).
-- Va en su propia migración porque la de las condiciones
-- (20260903_tournament_terms_and_move.sql) YA ESTÁ APLICADA y no es
-- re-ejecutable: sus `create function` fallarían al existir ya.
--
-- El caso real: la categoría que se queda con tres parejas. Mover de una en
-- una con tournament_move_registration es un suplicio con 40 inscripciones.

-- ── 7 · Agrupar categorías (la que se queda con 3 parejas) ──────────────────
-- Mueve DE GOLPE todas las inscripciones de una división a otra y, si la de
-- origen queda vacía del todo (en cualquier género) y sin cuadro, la quita de
-- las categorías del torneo para que no siga abierta a inscripción.
-- Mismo criterio que mover una sola pareja: si ya hay cuadro, no se toca nada.
create or replace function public.tournament_merge_division(
  p_tournament_id uuid,
  p_from_gender text, p_from_category text,
  p_to_gender text, p_to_category text,
  p_close_source boolean default true)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  t public.tournaments%rowtype;
  v_ids uuid[];
  v_n int;
  v_body text;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'Torneo no encontrado'; end if;

  if not exists (
    select 1 from public.clubs c where c.id = t.club_id and c.owner_id = auth.uid()
    union
    select 1 from public.club_members cm
     where cm.club_id = t.club_id and cm.user_id = auth.uid() and cm.role = 'admin'
  ) then
    raise exception 'Solo el organizador puede agrupar categorías'
      using errcode = 'insufficient_privilege';
  end if;

  if p_from_gender is not distinct from p_to_gender
     and p_from_category is not distinct from p_to_category then
    raise exception 'El destino tiene que ser otra categoría';
  end if;
  if coalesce(array_length(t.genders, 1), 0) > 0
     and (p_to_gender is null or not (p_to_gender = any(t.genders))) then
    raise exception 'Ese género no es del torneo';
  end if;
  if coalesce(array_length(t.categories, 1), 0) > 0
     and (p_to_category is null or not (p_to_category = any(t.categories))) then
    raise exception 'Esa categoría no es del torneo';
  end if;

  -- Con cuadro generado en cualquiera de las dos, esto no es agrupar: es
  -- rehacer el cuadro. Mejor un no claro que dejarlo a medias.
  if exists (
    select 1 from public.tournament_matches m
     where m.tournament_id = t.id
       and ((m.gender is not distinct from p_from_gender
             and m.category is not distinct from p_from_category)
         or (m.gender is not distinct from p_to_gender
             and m.category is not distinct from p_to_category))
  ) then
    raise exception 'Alguna de las dos categorías ya tiene cuadro: bórralo antes de agruparlas';
  end if;

  select array_agg(id) into v_ids
    from public.tournament_registrations
   where tournament_id = t.id
     and gender is not distinct from p_from_gender
     and category is not distinct from p_from_category
     and status <> 'withdrawn';

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n > 0 then
    update public.tournament_registrations
       set gender = p_to_gender, category = p_to_category
     where id = any(v_ids);

    v_body := 'Tu categoría se ha agrupado: juegas en '
      || coalesce(p_to_category, 'otra categoría')
      || case when p_to_gender is not null then ' (' || p_to_gender || ')' else '' end
      || ' en "' || t.name || '".';

    insert into public.notifications (user_id, type, title, body, data)
    select distinct u, 'tournament_moved', 'Cambio de categoría', v_body,
           jsonb_build_object('tournament_id', t.id)
    from (
      select p1_user_id as u from public.tournament_registrations where id = any(v_ids)
      union
      select p2_user_id from public.tournament_registrations where id = any(v_ids)
    ) x
    where u is not null and u is distinct from auth.uid();
  end if;

  -- La categoría de origen sale del torneo solo si ya no la usa NADIE (ojo:
  -- las categorías son comunes a todos los géneros, así que "femenina 2ª"
  -- vacía no quita la 2ª si la masculina sigue teniendo parejas).
  if p_close_source and p_from_category is not null
     and not exists (
       select 1 from public.tournament_registrations r
        where r.tournament_id = t.id and r.category = p_from_category
          and r.status <> 'withdrawn')
     and not exists (
       select 1 from public.tournament_matches m
        where m.tournament_id = t.id and m.category = p_from_category)
  then
    update public.tournaments
       set categories = array_remove(categories, p_from_category)
     where id = t.id;
  end if;

  return v_n;
end;
$function$;

revoke execute on function public.tournament_merge_division(uuid, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.tournament_merge_division(uuid, text, text, text, text, boolean)
  to authenticated;
