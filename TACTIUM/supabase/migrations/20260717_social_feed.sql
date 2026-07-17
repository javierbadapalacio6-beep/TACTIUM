-- ─────────────────────────────────────────────────────────────────────────
-- Social (rama feature/perfiles-sociales): FEED de novedades de a quién
-- sigues. Amistosos PÚBLICOS de los jugadores que sigues + jornadas jugadas
-- de los clubes que sigues. SECURITY DEFINER; usa auth.uid() del llamante.
-- CÓMO APLICAR: SQL Editor → Run. (Aplicada vía MCP 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.social_feed(p_limit int default 30)
returns table (
  kind text, ref_id uuid, occurred_on date,
  actor_id uuid, actor_name text, avatar_url text,
  title text, subtitle text, positive boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with casual as (
    select
      'casual'::text as kind,
      cm.id as ref_id,
      cm.played_on as occurred_on,
      cp.user_id as actor_id,
      private.display_name(cp.user_id) as actor_name,
      (select avatar_url from public.profiles where id = cp.user_id) as avatar_url,
      private.display_name(cp.user_id)
        || (case when cm.winner_side = cp.side then ' ganó un amistoso' else ' jugó un amistoso' end) as title,
      coalesce((select string_agg(p2.name, ' / ' order by p2.slot)
                from public.casual_match_participants p2
                where p2.match_id = cm.id and p2.side = cp.side), '—')
        || '   '
        || coalesce((select string_agg(
              case when cp.side = 0 then (e->>0) || '-' || (e->>1)
                   else (e->>1) || '-' || (e->>0) end, ' ')
              from jsonb_array_elements(cm.sets) e), '')
        || '   vs   '
        || coalesce((select string_agg(p2.name, ' / ' order by p2.slot)
                from public.casual_match_participants p2
                where p2.match_id = cm.id and p2.side <> cp.side), '—') as subtitle,
      (cm.winner_side = cp.side) as positive
    from public.follows f
    join public.casual_match_participants cp on cp.user_id = f.target_id
    join public.casual_matches cm on cm.id = cp.match_id
    where f.follower_id = auth.uid()
      and f.target_type = 'user'
      and cm.winner_side is not null
      and cm.visibility = 'public'
  ),
  league as (
    select
      'league'::text as kind,
      m.id as ref_id,
      m.match_date as occurred_on,
      t.club_id as actor_id,
      t.name as actor_name,
      null::text as avatar_url,
      t.name || '  ' || coalesce(m.score_for::text, '·') || '–'
        || coalesce(m.score_against::text, '·')
        || coalesce('  ' || m.opponent, '') as title,
      'Jornada ' || coalesce('J' || m.jornada_number, '')
        || coalesce(' · ' || to_char(m.match_date, 'DD/MM'), '') as subtitle,
      (m.outcome = 'win') as positive
    from public.follows f
    join public.teams t on t.club_id = f.target_id
    join public.seasons s on s.team_id = t.id
    join public.matchdays m on m.season_id = s.id
    where f.follower_id = auth.uid()
      and f.target_type = 'club'
      and m.status = 'finished'
  )
  select kind, ref_id, occurred_on, actor_id, actor_name, avatar_url, title, subtitle, positive
  from (select * from casual union all select * from league) x
  order by occurred_on desc nulls last
  limit p_limit;
$$;

grant execute on function public.social_feed(int) to authenticated;
