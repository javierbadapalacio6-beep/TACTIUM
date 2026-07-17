-- ─────────────────────────────────────────────────────────────────────────
-- Social (rama feature/perfiles-sociales): descripción/bio del perfil y
-- galería de fotos de amistosos en el perfil público.
--   · profiles.bio (≤160), editable en Perfil, mostrada en el perfil público.
--   · get_public_user_profile devuelve `bio` + `photos` (últimos 12 amistosos
--     PÚBLICOS con foto donde el jugador participó, con la marca de victoria).
-- CÓMO APLICAR: SQL Editor → Run. (Aplicada vía MCP 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);

create or replace function public.get_public_user_profile(target uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
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
    ),
    'photos', (
      select coalesce(jsonb_agg(x.obj), '[]'::jsonb) from (
        select jsonb_build_object(
          'match_id', cm.id,
          'photo_url', cm.photo_url,
          'played_on', cm.played_on,
          'positive', (cm.winner_side = cp.side)
        ) as obj
        from public.casual_match_participants cp
        join public.casual_matches cm on cm.id = cp.match_id
        where cp.user_id = p.id
          and cm.photo_url is not null
          and cm.visibility = 'public'
        order by cm.played_on desc nulls last
        limit 12
      ) x
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
