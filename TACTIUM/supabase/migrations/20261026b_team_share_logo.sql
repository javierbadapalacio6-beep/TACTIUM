-- Logo para las tarjetas de compartir (foto del partido y fotos por pareja): el del CLUB del equipo si lo
-- tiene y, si no, el del equipo. `clubs` solo es legible por el dueño y los gestores del club, así que un
-- capitán o un jugador no podían leerlo: esta función lo entrega solo a los miembros del equipo.

create or replace function public.team_share_logo(p_team_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_logo text;
begin
  if not private.is_team_member(p_team_id) then
    return null;
  end if;
  select coalesce(nullif(btrim(c.logo_url), ''), nullif(btrim(t.logo_url), ''))
    into v_logo
    from public.teams t
    left join public.clubs c on c.id = t.club_id
   where t.id = p_team_id;
  return v_logo;
end $$;

revoke execute on function public.team_share_logo(uuid) from public, anon;
grant execute on function public.team_share_logo(uuid) to authenticated;
