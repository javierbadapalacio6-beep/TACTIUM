-- ─────────────────────────────────────────────────────────────────────────
-- Social (rama feature/perfiles-sociales): enriquecer el perfil público de
-- jugador con sus EQUIPOS (nombre + rol). Solo campos seguros (sin email).
-- CÓMO APLICAR: SQL Editor → Run. (Aplicada vía MCP 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_public_user_profile(target uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'level_display', p.level_display,
    'is_me', p.id = auth.uid(),
    'followers_count', (select count(*) from public.follows f where f.target_type='user' and f.target_id=p.id),
    'following_count', (select count(*) from public.follows f where f.follower_id=p.id),
    'is_following', exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.target_type='user' and f.target_id=p.id),
    'casual_played', st.played,
    'casual_won', st.won,
    'casual_win_rate', case when st.played > 0 then round(st.won::numeric * 100 / st.played) end,
    'teams', (
      select coalesce(jsonb_agg(
        jsonb_build_object('name', t.name, 'role', tm.role) order by t.name
      ), '[]'::jsonb)
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p.id
    )
  )
  from public.profiles p
  cross join lateral (
    select
      count(*) filter (where cm.winner_side is not null) as played,
      count(*) filter (where cm.winner_side = cp.side)     as won
    from public.casual_match_participants cp
    join public.casual_matches cm on cm.id = cp.match_id
    where cp.user_id = p.id
  ) st
  where p.id = target;
$$;
