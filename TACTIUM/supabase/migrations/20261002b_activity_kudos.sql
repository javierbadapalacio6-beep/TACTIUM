-- Kudos en los resultados del feed (mejora n.º 10, 2026-10-02).
-- Un «kudos» = un toque de reconocimiento a un amistoso (casual_matches) o a
-- una jornada de liga (matchdays) que aparece en el feed. Distinto de
-- `post_kudos` (publicaciones de la capa social aparcada).
--   · Uno por usuario y resultado (toggle).
--   · Avisa a quien lo recibe (tipo de notificación 'kudos'):
--       amistoso → el jugador al que sigues (target_user_id);
--       jornada  → el dueño del equipo.
--   · social_feed devuelve el nº de kudos y si ya diste el tuyo.

create table if not exists public.activity_kudos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_kind    text not null check (target_kind in ('casual', 'league')),
  target_id      uuid not null,
  target_user_id uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, target_kind, target_id)
);
create index if not exists activity_kudos_target_idx on public.activity_kudos (target_kind, target_id);
alter table public.activity_kudos enable row level security;

drop policy if exists activity_kudos_select on public.activity_kudos;
create policy activity_kudos_select on public.activity_kudos
  for select to authenticated using (true);
-- Escritura solo por la RPC (security definer).

-- Toggle: da o quita tu kudos. Devuelve {given, count}.
create or replace function public.toggle_activity_kudos(
  p_kind text, p_target_id uuid, p_target_user_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_given boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_kind not in ('casual', 'league') then
    raise exception 'Tipo no válido' using errcode = '22023';
  end if;
  if p_kind = 'casual' and not exists (
       select 1 from public.casual_matches where id = p_target_id and visibility = 'public') then
    raise exception 'Resultado no encontrado' using errcode = 'P0002';
  end if;
  if p_kind = 'league' and not exists (
       select 1 from public.matchdays where id = p_target_id and status = 'finished') then
    raise exception 'Resultado no encontrado' using errcode = 'P0002';
  end if;

  delete from public.activity_kudos
   where user_id = v_uid and target_kind = p_kind and target_id = p_target_id;
  if found then
    v_given := false;
  else
    insert into public.activity_kudos (user_id, target_kind, target_id, target_user_id)
    values (v_uid, p_kind, p_target_id,
            case when p_kind = 'casual' then p_target_user_id end);
    v_given := true;
  end if;

  return jsonb_build_object(
    'given', v_given,
    'count', (select count(*) from public.activity_kudos
               where target_kind = p_kind and target_id = p_target_id));
end $$;
revoke execute on function public.toggle_activity_kudos(text, uuid, uuid) from public, anon;
grant execute on function public.toggle_activity_kudos(text, uuid, uuid) to authenticated;

-- Aviso al que recibe el kudos (no a uno mismo; no se repite si quita y vuelve a dar el mismo día).
create or replace function private.notify_activity_kudos()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_to uuid;
  v_title text;
  v_giver text := private.display_name(new.user_id);
  v_team text;
begin
  if new.target_kind = 'casual' then
    v_to := new.target_user_id;
    v_title := v_giver || ' ha dado kudos a tu amistoso';
  else
    select t.owner_id, t.name into v_to, v_team
      from public.matchdays m
      join public.seasons s on s.id = m.season_id
      join public.teams t on t.id = s.team_id
     where m.id = new.target_id;
    v_title := v_giver || ' ha dado kudos a la jornada de ' || coalesce(v_team, 'tu equipo');
  end if;

  if v_to is null or v_to = new.user_id then return new; end if;
  if exists (
    select 1 from public.notifications n
     where n.user_id = v_to and n.type = 'kudos'
       and n.data->>'actor_id' = new.user_id::text
       and n.data->>'target_id' = new.target_id::text
       and n.created_at > now() - interval '1 day') then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_to, 'kudos', v_title, null,
          jsonb_build_object('type', 'kudos', 'actor_id', new.user_id,
                             'target_kind', new.target_kind, 'target_id', new.target_id));
  return new;
exception when others then
  raise warning 'notify_activity_kudos: %', sqlerrm;
  return new;
end $$;

drop trigger if exists activity_kudos_notify on public.activity_kudos;
create trigger activity_kudos_notify
  after insert on public.activity_kudos
  for each row execute function private.notify_activity_kudos();

-- Feed con kudos: dos columnas nuevas al final (kudos_count, i_gave_kudos).
-- Cambiar el tipo de retorno obliga a recrear la función; los clientes leen
-- por nombre de columna, así que las columnas extra no les afectan.
drop function if exists public.social_feed(int);
create function public.social_feed(p_limit int default 30)
returns table (
  kind text, ref_id uuid, occurred_on date,
  actor_id uuid, actor_name text, avatar_url text,
  title text, subtitle text, positive boolean,
  kudos_count int, i_gave_kudos boolean
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
  select x.kind, x.ref_id, x.occurred_on, x.actor_id, x.actor_name, x.avatar_url,
         x.title, x.subtitle, x.positive,
         (select count(*)::int from public.activity_kudos k
           where k.target_kind = x.kind and k.target_id = x.ref_id) as kudos_count,
         exists (select 1 from public.activity_kudos k
                  where k.target_kind = x.kind and k.target_id = x.ref_id
                    and k.user_id = auth.uid()) as i_gave_kudos
  from (select * from casual union all select * from league) x
  order by x.occurred_on desc nulls last
  limit p_limit;
$$;

revoke execute on function public.social_feed(int) from public, anon;
grant execute on function public.social_feed(int) to authenticated;
