-- Vista previa de una invitación de equipo (mejora n.º 2, 2026-10-02).
-- Dado un código, devuelve SOLO lo público del equipo para enseñarlo antes de
-- unirse (app: hoja de canje; web: página pública tactium.io/i/CÓDIGO) y la
-- plantilla para que el invitado se reconozca. No une a nadie ni escribe nada.
-- Accesible sin sesión (anon) porque la página del enlace es pública; quien no
-- tiene el código no puede listar nada.
create or replace function public.preview_team_invitation(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  i public.team_invitations;
  t public.teams;
begin
  select * into i from public.team_invitations
   where code = upper(btrim(coalesce(p_code, '')))
   limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not (i.multi_use or i.used_at is null) then
    return jsonb_build_object('valid', false, 'reason', 'used');
  end if;
  if i.expires_at is not null and i.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select * into t from public.teams where id = i.team_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'valid', true,
    'role', i.role,
    'team', jsonb_build_object(
      'id', t.id, 'name', t.name, 'logo_url', t.logo_url, 'league', t.league,
      'category', t.category, 'group_name', t.group_name, 'federation', t.federation),
    'club_name', (select c.name from public.clubs c where c.id = t.club_id),
    'captain_name', (select pr.full_name from public.profiles pr where pr.id = t.owner_id),
    'players_count', (select count(*) from public.players p where p.team_id = t.id and p.active),
    'next_matchday', (
      select jsonb_build_object('jornada', m.jornada_number, 'date', m.match_date, 'opponent', m.opponent)
        from public.matchdays m join public.seasons s on s.id = m.season_id
       where s.team_id = t.id and m.status = 'upcoming' and m.match_date >= current_date
       order by m.match_date, m.match_time nulls last limit 1),
    -- Solo para invitaciones de jugador: la plantilla para «¿quién eres?».
    'roster', case when i.role = 'player' then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'position', p.position, 'pts', p.pts,
               'claimed', p.user_id is not null) order by p.pts desc), '[]'::jsonb)
        from public.players p where p.team_id = t.id and p.active) else '[]'::jsonb end
  );
end $$;

revoke execute on function public.preview_team_invitation(text) from public;
grant execute on function public.preview_team_invitation(text) to anon, authenticated;
