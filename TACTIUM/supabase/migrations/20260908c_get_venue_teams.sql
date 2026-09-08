-- Equipos INVITADOS de un club sede, vengan o no con partidos pendientes.
--
-- La pantalla de Horarios los deducía de los PARTIDOS de local pendientes, así
-- que un invitado recién dado de alta, o cuya temporada ya había terminado, no
-- aparecía por ningún lado: ni para comprobar que estaba, ni para ponerle sus
-- franjas. Además la lectura directa no vale: en cuanto su capitán reclama el
-- equipo, la RLS se lo oculta al club. De ahí este RPC, hermano de
-- `get_venue_home_schedule`.

create or replace function public.get_venue_teams(target_club uuid)
returns table (
  team_id uuid,
  team_name text,
  gender text,
  category text,
  preferred_home_slots text[],
  claimed boolean
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not exists (
    select 1 from public.clubs c
     where c.id = target_club and c.owner_id = auth.uid()
    union
    select 1 from public.club_members cm
     where cm.club_id = target_club and cm.user_id = auth.uid() and cm.role = 'admin'
  ) then
    raise exception 'No administras ese club'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select t.id,
         t.name,
         t.gender::text,
         t.category,
         coalesce(t.preferred_home_slots, '{}'::text[]),
         exists (
           select 1 from public.clubs c
            where c.id = target_club and c.owner_id = t.owner_id
         ) is false
    from public.teams t
   where t.venue_club_id = target_club
     and t.club_id is distinct from target_club
   order by t.name;
end;
$function$;

revoke execute on function public.get_venue_teams(uuid) from public, anon;
grant  execute on function public.get_venue_teams(uuid) to authenticated;
