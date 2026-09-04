-- EQUIPOS INVITADOS: clubes que ponen horario a equipos que NO son suyos.
--
-- El caso (Smash, reunión 2026-09-03): en las pistas de SMASH PADEL CLUB juegan,
-- además de sus equipos, otros con nombre propio (Patata Regato, Pontejos…).
-- El gestor tiene que cuadrar TODAS las pistas, pero hoy el único vínculo
-- equipo↔club es `teams.club_id`, que es todo-o-nada: da gestión completa
-- (plantilla, alineaciones, resultados, temporadas).
--
-- Solución: un SEGUNDO vínculo, más débil.
--   · `teams.club_id`       → PROPIEDAD. Gestión completa. Consume cuota del plan.
--   · `teams.venue_club_id` → SEDE. Solo día/hora/pista y franjas favoritas.
--                             NO consume cuota (la cuota cuenta por club_id).
--
-- Un equipo invitado puede tener club_id NULL (no es de nadie en TACTIUM) o el
-- club_id de SU club, si algún día ese club también usa TACTIUM.

alter table public.teams
  add column if not exists venue_club_id uuid references public.clubs(id) on delete set null;

create index if not exists teams_venue_club_idx on public.teams (venue_club_id)
  where venue_club_id is not null;

comment on column public.teams.venue_club_id is
  'Club en cuyas pistas juega de local. Da permiso SOLO de horario, no de gestión, y no consume cuota del plan.';

-- ── Horario de local de los equipos INVITADOS ──────────────────────────────
-- Deliberadamente NO toco `get_club_home_schedule` (los equipos propios): está
-- en producción pero no en este repositorio, y reescribirla a ciegas es pedir un
-- disgusto. Esta devuelve la misma forma para los invitados y el cliente une las
-- dos listas. `is_guest` sale a true para poder distinguirlos en pantalla.
create or replace function public.get_venue_home_schedule(target_club uuid)
returns table(
  matchday_id uuid,
  team_id uuid,
  team_name text,
  jornada_number integer,
  match_date date,
  match_time time,
  location text,
  opponent text,
  status text,
  preferred_home_slots text[],
  is_guest boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select m.id, t.id, t.name, m.jornada_number, m.match_date, m.match_time,
         m.location, m.opponent, m.status::text,
         coalesce(t.preferred_home_slots, '{}'::text[]), true
    from public.matchdays m
    join public.seasons s on s.id = m.season_id
    join public.teams   t on t.id = s.team_id
   where t.venue_club_id = target_club
     -- Solo lo que el club puede cuadrar: partidos de local sin cerrar. Y solo
     -- si es INVITADO: los propios ya los devuelve get_club_home_schedule.
     and t.club_id is distinct from target_club
     and m.is_home
     and m.status <> 'finished'
     -- Y solo para el admin del club: esta función es SECURITY DEFINER, así que
     -- la comprobación la hace ella, no la RLS.
     and (exists (select 1 from public.clubs c
                   where c.id = target_club and c.owner_id = auth.uid())
       or exists (select 1 from public.club_members cm
                   where cm.club_id = target_club and cm.user_id = auth.uid()
                     and cm.role = 'admin'))
   order by m.match_date nulls last, m.match_time nulls last, t.name;
$function$;

revoke execute on function public.get_venue_home_schedule(uuid) from public, anon;
grant execute on function public.get_venue_home_schedule(uuid) to authenticated;

-- ── Poner hora a un partido de un equipo invitado ──────────────────────────
-- El club no es admin del equipo (esa es la gracia), así que la RLS de
-- `matchdays` le diría que no. Esta función abre una puerta ESTRECHA: solo
-- fecha, hora y pista, solo partidos de local, y solo si el equipo juega en su
-- sede. Ni alineaciones, ni resultados, ni plantilla.
create or replace function public.set_venue_matchday_slot(
  p_matchday_id uuid,
  p_match_date date,
  p_match_time time,
  p_location text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_team public.teams%rowtype;
  v_md   public.matchdays%rowtype;
  v_cap  uuid;
  v_body text;
begin
  select m.* into v_md from public.matchdays m where m.id = p_matchday_id;
  if not found then raise exception 'Jornada no encontrada'; end if;

  select t.* into v_team
    from public.seasons s join public.teams t on t.id = s.team_id
   where s.id = v_md.season_id;
  if not found then raise exception 'Equipo no encontrado'; end if;

  if v_team.venue_club_id is null then
    raise exception 'Ese equipo no juega en tu club';
  end if;
  if not exists (
    select 1 from public.clubs c
     where c.id = v_team.venue_club_id and c.owner_id = auth.uid()
    union
    select 1 from public.club_members cm
     where cm.club_id = v_team.venue_club_id and cm.user_id = auth.uid()
       and cm.role = 'admin'
  ) then
    raise exception 'Solo el club sede puede poner el horario'
      using errcode = 'insufficient_privilege';
  end if;
  if not v_md.is_home then
    raise exception 'Ese partido no se juega en tu club';
  end if;

  update public.matchdays
     set match_date = coalesce(p_match_date, match_date),
         match_time = p_match_time,
         location   = p_location
   where id = p_matchday_id;

  -- Aviso al CAPITÁN del equipo invitado (él ya avisa a los suyos). Va por la
  -- campana, no por push: la edge `send-push` autoriza por club del equipo y
  -- aquí el club no es el suyo.
  v_body := 'Tu partido de la jornada ' || coalesce(v_md.jornada_number::text, '?')
    || ' contra ' || coalesce(v_md.opponent, 'rival') || ' se juega el '
    || coalesce(to_char(coalesce(p_match_date, v_md.match_date), 'DD/MM'), 'día por confirmar')
    || case when p_match_time is not null
            then ' a las ' || to_char(p_match_time, 'HH24:MI') else '' end
    || case when p_location is not null then ' (' || p_location || ')' else '' end || '.';

  for v_cap in
    select tm.user_id from public.team_members tm
     where tm.team_id = v_team.id and tm.role = 'captain' and tm.user_id is not null
    union
    select v_team.owner_id
  loop
    if v_cap is not null and v_cap is distinct from auth.uid() then
      insert into public.notifications (user_id, type, title, body, data)
      values (v_cap, 'schedule_set', 'Horario de tu partido', v_body,
              jsonb_build_object('matchday_id', p_matchday_id, 'team_id', v_team.id));
    end if;
  end loop;
end;
$function$;

revoke execute on function public.set_venue_matchday_slot(uuid, date, time, text)
  from public, anon;
grant execute on function public.set_venue_matchday_slot(uuid, date, time, text)
  to authenticated;
