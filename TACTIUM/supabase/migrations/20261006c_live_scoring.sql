-- ═════════════════════════════════════════════════════════════════════════
-- Marcador en vivo + enlace público (2026-10-06)
--
-- · live_matches       estado en vivo de UN partido (hoy: una pista de una
--                      jornada de liga; mañana: un partido de torneo, con
--                      kind='tournament' + tournament_match_id).
-- · live_match_events  log de juegos (orden, lado, set, cuándo, quién). Deshacer
--                      marca el último como `undone_at`; el estado se recalcula
--                      siempre desde el log, así que nunca se descuadra.
-- · live_shares        token público por jornada → tactium.io/directo/{token}.
--
-- Escrituras SOLO por RPC (SECURITY DEFINER): live_claim_court,
-- live_release_court, live_score_game, live_undo_game, live_finish_court,
-- live_share_create. Marca cualquier miembro del equipo (pensado para los
-- compañeros que miran desde fuera). Un «marcador activo» por pista con bloqueo
-- suave de 2 min evita dobles marcas; cada toque lleva un uuid (idempotente) y
-- el nº de juegos que veía quien marca (ordenado).
--
-- Lectura del equipo por RLS (y Realtime sobre live_matches) o por
-- live_matchday_state; lectura pública solo por public_live_by_token (anon),
-- que devuelve lo de ESE token y nada más.
--
-- «us/them» = nosotros/rival desde el equipo de la jornada (igual que
-- match_results). En torneo, us = pareja local y them = visitante.
--
-- Formato: 'normal' (3 sets; 6 con 2 de ventaja o 7-5/7-6; el tie-break se
-- apunta como 7-6 sin puntos) o 'super_tb' (3er set = super tie-break a 10
-- con 2 de ventaja; cada toque es un punto). No hay `match_format` en la
-- jornada ni en la temporada, así que por defecto 'normal'.
--
-- Al acabar la pista (2 sets) o con «Terminar pista» (capitán), los sets se
-- vuelcan a match_results en el MISMO formato que la entrada manual (una fila
-- por set, forfeit=false). Si la pista está en W.O. en el acta, no se pisa.
-- ═════════════════════════════════════════════════════════════════════════

-- ── Tablas ───────────────────────────────────────────────────────────────
create table if not exists public.live_matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'league' check (kind in ('league', 'tournament')),
  matchday_id uuid references public.matchdays(id) on delete cascade,
  court_number integer check (court_number between 1 and 12),
  tournament_match_id uuid references public.tournament_matches(id) on delete cascade,
  format text not null default 'normal' check (format in ('normal', 'super_tb')),
  status text not null default 'live' check (status in ('live', 'finished')),
  -- [{us, them}, …] sets cerrados + el set en curso (si no ha terminado).
  sets jsonb not null default '[{"us":0,"them":0}]'::jsonb,
  winner text check (winner in ('us', 'them')),
  games_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  -- «Marcador activo»: quién lleva la pista ahora. Bloqueo SUAVE: pasados 2 min
  -- sin marcar, cualquiera la coge; antes, solo tomando el relevo a propósito.
  scorer_id uuid references auth.users(id) on delete set null,
  scorer_seen_at timestamptz,
  constraint live_matches_ref check (
    (kind = 'league' and matchday_id is not null and court_number is not null and tournament_match_id is null)
    or (kind = 'tournament' and tournament_match_id is not null)
  ),
  constraint live_matches_court_uq unique (matchday_id, court_number),
  constraint live_matches_tmatch_uq unique (tournament_match_id)
);

create table if not exists public.live_match_events (
  id bigint generated always as identity primary key,
  live_match_id uuid not null references public.live_matches(id) on delete cascade,
  seq integer not null,
  side text not null check (side in ('us', 'them')),
  set_number integer not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  undone_at timestamptz,
  undone_by uuid references auth.users(id) on delete set null,
  -- Idempotencia: el cliente manda un uuid por toque; un reintento no suma dos.
  client_event_id uuid unique,
  constraint live_match_events_seq_uq unique (live_match_id, seq)
);

create table if not exists public.live_shares (
  token text primary key check (token ~ '^[a-z0-9-]{6,40}$'),
  kind text not null default 'league' check (kind in ('league', 'tournament')),
  matchday_id uuid unique references public.matchdays(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint live_shares_ref check (kind <> 'league' or matchday_id is not null)
);

alter table public.live_matches enable row level security;
alter table public.live_match_events enable row level security;
alter table public.live_shares enable row level security;

-- Lectura: miembros del equipo de la jornada. Sin políticas de escritura: todo
-- pasa por las RPC de abajo.
drop policy if exists live_matches_member_select on public.live_matches;
create policy live_matches_member_select on public.live_matches
  for select to authenticated
  using (matchday_id is not null and private.is_team_member(private.team_for_matchday(matchday_id)));

drop policy if exists live_match_events_member_select on public.live_match_events;
create policy live_match_events_member_select on public.live_match_events
  for select to authenticated
  using (exists (
    select 1 from public.live_matches lm
    where lm.id = live_match_id
      and lm.matchday_id is not null
      and private.is_team_member(private.team_for_matchday(lm.matchday_id))
  ));

drop policy if exists live_shares_member_select on public.live_shares;
create policy live_shares_member_select on public.live_shares
  for select to authenticated
  using (matchday_id is not null and private.is_team_member(private.team_for_matchday(matchday_id)));

-- Realtime: el equipo ve el tanteo moverse (filtrado por la RLS de arriba).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_matches'
  ) then
    alter publication supabase_realtime add table public.live_matches;
  end if;
end $$;

-- ── Helpers privados ─────────────────────────────────────────────────────

-- ¿Puede marcar? Cualquier miembro del equipo (capitán o jugador de la
-- plantilla, juegue o no esa jornada) y el club del equipo. El directo lo
-- llevan sobre todo los compañeros que miran desde fuera.
create or replace function private.can_score_live(p_matchday uuid, p_court integer)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select private.is_team_member(private.team_for_matchday(p_matchday));
$$;

-- «Iván Rodríguez» → «Iván R.» (nombre público en el directo).
create or replace function private.live_short_name(p_name text)
returns text
language sql immutable
set search_path to ''
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    else
      initcap(split_part(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), ' ', 1))
      || coalesce(
           ' ' || nullif(upper(left(split_part(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), ' ', 2), 1)), '') || '.',
           '')
  end;
$$;

-- Nombre corto de quien marca: su ficha en el equipo o, si no tiene, su perfil.
create or replace function private.live_scorer_name(p_user uuid, p_matchday uuid)
returns text
language sql stable security definer
set search_path to ''
as $$
  select case when p_user is null then null else coalesce(
    (select private.live_short_name(coalesce(nullif(p.alias, ''), p.name))
       from public.players p
      where p.user_id = p_user and p.team_id = private.team_for_matchday(p_matchday)
      limit 1),
    (select private.live_short_name(pr.full_name) from public.profiles pr where pr.id = p_user),
    'Un compañero') end;
$$;

-- Recalcula el estado desde el log (juegos no deshechos, en orden).
create or replace function private.live_recompute(p_live uuid)
returns public.live_matches
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
  ev record;
  cu integer := 0;
  ct integer := 0;
  set_idx integer := 1;
  us_sets integer := 0;
  them_sets integer := 0;
  done boolean;
  is_stb boolean;
  hi integer;
  v_sets jsonb := '[]'::jsonb;
  v_winner text := null;
  n integer := 0;
begin
  select * into lm from public.live_matches where id = p_live for update;
  if not found then
    raise exception 'Directo no encontrado';
  end if;

  for ev in
    select side from public.live_match_events
    where live_match_id = p_live and undone_at is null
    order by seq
  loop
    exit when v_winner is not null;
    n := n + 1;
    if ev.side = 'us' then cu := cu + 1; else ct := ct + 1; end if;
    is_stb := lm.format = 'super_tb' and set_idx = 3;
    hi := greatest(cu, ct);
    if is_stb then
      done := hi >= 10 and abs(cu - ct) >= 2;
    else
      -- 6 con 2 de ventaja, o 7 (7-5 o 7-6: el tie-break sin puntos).
      done := (hi >= 6 and abs(cu - ct) >= 2) or hi = 7;
    end if;
    if done then
      v_sets := v_sets || jsonb_build_array(jsonb_build_object('us', cu, 'them', ct));
      if cu > ct then us_sets := us_sets + 1; else them_sets := them_sets + 1; end if;
      if us_sets = 2 then v_winner := 'us';
      elsif them_sets = 2 then v_winner := 'them';
      else
        set_idx := set_idx + 1;
        cu := 0;
        ct := 0;
      end if;
    end if;
  end loop;

  if v_winner is null then
    v_sets := v_sets || jsonb_build_array(jsonb_build_object('us', cu, 'them', ct));
  end if;

  update public.live_matches
     set sets = v_sets,
         winner = v_winner,
         games_count = n,
         updated_at = now()
   where id = p_live
  returning * into lm;
  return lm;
end;
$$;

-- Vuelca los sets al acta (match_results) en el formato de la entrada manual.
-- Se descartan sets sin juegos (0-0). Si la pista está en W.O., no toca nada.
create or replace function private.live_flush_results(p_live uuid)
returns void
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
  s jsonb;
  i integer := 0;
begin
  select * into lm from public.live_matches where id = p_live;
  if not found or lm.kind <> 'league' then return; end if;
  if exists (
    select 1 from public.match_results
    where matchday_id = lm.matchday_id and court_number = lm.court_number and forfeit
  ) then
    return;
  end if;
  for s in select value from jsonb_array_elements(lm.sets) loop
    if coalesce((s->>'us')::int, 0) + coalesce((s->>'them')::int, 0) = 0 then
      continue;
    end if;
    i := i + 1;
    insert into public.match_results (matchday_id, court_number, set_number, us, them, forfeit, forfeit_us)
    values (lm.matchday_id, lm.court_number, i, (s->>'us')::int, (s->>'them')::int, false, false)
    on conflict (matchday_id, court_number, set_number)
    do update set us = excluded.us, them = excluded.them, forfeit = false, forfeit_us = false;
  end loop;
  delete from public.match_results
   where matchday_id = lm.matchday_id and court_number = lm.court_number and set_number > i;
end;
$$;

-- Comprobaciones comunes antes de escribir en una pista.
create or replace function private.live_guard(p_matchday uuid, p_court integer)
returns void
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  select status::text into v_status from public.matchdays where id = p_matchday;
  if v_status is null then
    raise exception 'Jornada no encontrada';
  end if;
  if v_status = 'finished' then
    raise exception 'El acta ya está cerrada';
  end if;
  if p_court is null or p_court < 1 or p_court > 12 then
    raise exception 'Pista no válida';
  end if;
  if not private.can_score_live(p_matchday, p_court) then
    raise exception 'Solo los miembros del equipo pueden marcar';
  end if;
end;
$$;

-- Estado de una pista en JSON (lo que devuelven las RPC del equipo).
create or replace function private.live_json(lm public.live_matches)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', lm.id,
    'court_number', lm.court_number,
    'format', lm.format,
    'status', lm.status,
    'sets', lm.sets,
    'winner', lm.winner,
    'games_count', lm.games_count,
    'started_at', lm.started_at,
    'finished_at', lm.finished_at,
    'updated_at', lm.updated_at,
    'scorer_id', lm.scorer_id,
    'scorer_name', private.live_scorer_name(lm.scorer_id, lm.matchday_id),
    'scorer_seen_at', lm.scorer_seen_at,
    'scorer_active', lm.scorer_id is not null and lm.scorer_seen_at > now() - interval '2 minutes'
  );
$$;

-- Bloqueo suave: si otro marcó hace menos de 2 min, solo se entra tomando el
-- relevo (p_force). Si se puede, la pista pasa a ser de quien llama.
create or replace function private.live_take(p_live uuid, p_force boolean)
returns void
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
begin
  select * into lm from public.live_matches where id = p_live for update;
  if lm.scorer_id is not null
     and lm.scorer_id <> auth.uid()
     and lm.scorer_seen_at > now() - interval '2 minutes'
     and not coalesce(p_force, false) then
    raise exception 'Ahora la marca %: toma el relevo para seguir tú',
      private.live_scorer_name(lm.scorer_id, lm.matchday_id)
      using hint = 'live_locked';
  end if;
  update public.live_matches
     set scorer_id = auth.uid(), scorer_seen_at = now()
   where id = p_live;
end;
$$;

-- ── RPC de escritura (authenticated) ─────────────────────────────────────

-- «Marcar esta pista» / «Tomar el relevo»: pasa a ser quien marca. Crea el
-- directo (0-0) si no existía. p_force = tomar el relevo aunque otro marque.
create or replace function public.live_claim_court(
  p_matchday_id uuid,
  p_court integer,
  p_force boolean default false
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
begin
  perform private.live_guard(p_matchday_id, p_court);
  if exists (
    select 1 from public.match_results
    where matchday_id = p_matchday_id and court_number = p_court and forfeit
  ) then
    raise exception 'Esta pista está como W.O. en el acta';
  end if;
  insert into public.live_matches (kind, matchday_id, court_number, updated_by)
  values ('league', p_matchday_id, p_court, auth.uid())
  on conflict (matchday_id, court_number) do nothing;
  select * into lm from public.live_matches
   where matchday_id = p_matchday_id and court_number = p_court;
  perform private.live_take(lm.id, p_force);
  update public.live_matches set updated_at = now() where id = lm.id returning * into lm;
  return private.live_json(lm);
end;
$$;

-- Dejar de marcar (al salir del marcador): libera la pista si era mía.
create or replace function public.live_release_court(p_matchday_id uuid, p_court integer)
returns void
language sql security definer
set search_path to ''
as $$
  update public.live_matches
     set scorer_id = null, scorer_seen_at = null, updated_at = now()
   where matchday_id = p_matchday_id and court_number = p_court
     and scorer_id = auth.uid();
$$;

create or replace function public.live_score_game(
  p_matchday_id uuid,
  p_court integer,
  p_side text,
  p_event_id uuid default null,
  p_expected_games integer default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
  v_seq integer;
  v_set integer;
begin
  perform private.live_guard(p_matchday_id, p_court);
  if p_side not in ('us', 'them') then
    raise exception 'Lado no válido';
  end if;
  if exists (
    select 1 from public.match_results
    where matchday_id = p_matchday_id and court_number = p_court and forfeit
  ) then
    raise exception 'Esta pista está como W.O. en el acta';
  end if;

  insert into public.live_matches (kind, matchday_id, court_number, updated_by)
  values ('league', p_matchday_id, p_court, auth.uid())
  on conflict (matchday_id, court_number) do nothing;

  select * into lm from public.live_matches
   where matchday_id = p_matchday_id and court_number = p_court
   for update;

  -- Reintento del mismo toque: no suma otra vez.
  if p_event_id is not null and exists (
    select 1 from public.live_match_events where client_event_id = p_event_id
  ) then
    return private.live_json(lm);
  end if;

  perform private.live_take(lm.id, false);

  if lm.status = 'finished' then
    raise exception 'La pista ya ha terminado. Deshaz el último juego para seguir';
  end if;
  -- Ordenado: si el tanteo cambió desde que lo vio quien marca, no se suma a
  -- ciegas (dos personas a la vez).
  if p_expected_games is not null and p_expected_games <> lm.games_count then
    raise exception 'El tanteo acaba de cambiar. Revísalo y vuelve a marcar'
      using hint = 'live_stale';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.live_match_events where live_match_id = lm.id;
  v_set := greatest(jsonb_array_length(lm.sets), 1);
  insert into public.live_match_events (live_match_id, seq, side, set_number, created_by, client_event_id)
  values (lm.id, v_seq, p_side, v_set, auth.uid(), p_event_id);

  lm := private.live_recompute(lm.id);
  update public.live_matches set updated_by = auth.uid() where id = lm.id;

  if lm.winner is not null then
    update public.live_matches
       set status = 'finished', finished_at = now()
     where id = lm.id;
    perform private.live_flush_results(lm.id);
  end if;
  select * into lm from public.live_matches where id = lm.id;
  return private.live_json(lm);
end;
$$;

create or replace function public.live_undo_game(
  p_matchday_id uuid,
  p_court integer,
  p_expected_games integer default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
  v_ev bigint;
  was_finished boolean;
begin
  perform private.live_guard(p_matchday_id, p_court);
  select * into lm from public.live_matches
   where matchday_id = p_matchday_id and court_number = p_court
   for update;
  if not found then
    raise exception 'No hay nada que deshacer';
  end if;
  -- Deshace el último juego de la pista, lo marcara quien lo marcara; pero
  -- respeta al marcador activo (bloqueo suave) y el orden.
  perform private.live_take(lm.id, false);
  if p_expected_games is not null and p_expected_games <> lm.games_count then
    raise exception 'El tanteo acaba de cambiar. Revísalo antes de deshacer'
      using hint = 'live_stale';
  end if;
  select id into v_ev from public.live_match_events
   where live_match_id = lm.id and undone_at is null
   order by seq desc limit 1;
  if v_ev is null then
    raise exception 'No hay nada que deshacer';
  end if;
  update public.live_match_events set undone_at = now(), undone_by = auth.uid() where id = v_ev;

  was_finished := lm.status = 'finished';
  lm := private.live_recompute(lm.id);
  update public.live_matches
     set status = 'live', finished_at = null, updated_by = auth.uid()
   where id = lm.id
  returning * into lm;

  -- Si la pista estaba terminada, su resultado volcado deja de valer: se quita
  -- del acta (salvo W.O.) y se volverá a volcar al terminar.
  if was_finished then
    delete from public.match_results
     where matchday_id = p_matchday_id and court_number = p_court and not forfeit;
  end if;
  return private.live_json(lm);
end;
$$;

-- «Terminar pista»: capitán. Vuelca lo que haya (sets con juegos) al acta.
create or replace function public.live_finish_court(p_matchday_id uuid, p_court integer)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  lm public.live_matches;
begin
  perform private.live_guard(p_matchday_id, p_court);
  if not private.is_team_admin(private.team_for_matchday(p_matchday_id)) then
    raise exception 'Solo el capitán puede terminar una pista';
  end if;
  select * into lm from public.live_matches
   where matchday_id = p_matchday_id and court_number = p_court
   for update;
  if not found then
    raise exception 'Esta pista no tiene directo';
  end if;
  update public.live_matches
     set status = 'finished', finished_at = coalesce(finished_at, now()),
         scorer_id = null, scorer_seen_at = null,
         updated_at = now(), updated_by = auth.uid()
   where id = lm.id
  returning * into lm;
  perform private.live_flush_results(lm.id);
  return private.live_json(lm);
end;
$$;

-- «Compartir directo»: capitán. Devuelve el token de la jornada (lo crea si no
-- existe). Es estable: compartirlo dos veces da el mismo enlace.
create or replace function public.live_share_create(p_matchday_id uuid)
returns text
language plpgsql security definer
set search_path to ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if not private.is_team_admin(private.team_for_matchday(p_matchday_id)) then
    raise exception 'Solo el capitán puede compartir el directo';
  end if;
  select token into v_token from public.live_shares where matchday_id = p_matchday_id;
  if v_token is not null then
    return v_token;
  end if;
  loop
    v_token := encode(extensions.gen_random_bytes(8), 'hex');
    begin
      insert into public.live_shares (token, kind, matchday_id, created_by)
      values (v_token, 'league', p_matchday_id, auth.uid());
      exit;
    exception when unique_violation then
      -- ¿Otro capitán lo creó a la vez? Devolver ese.
      select token into v_token from public.live_shares where matchday_id = p_matchday_id;
      if v_token is not null then return v_token; end if;
    end;
  end loop;
  return v_token;
end;
$$;

-- ── Lectura del equipo ───────────────────────────────────────────────────
-- Todo lo que pinta el marcador del equipo en una sola llamada: pistas con su
-- pareja (alineación activa), el W.O. del acta y el estado en vivo (con quién
-- marca). Las pistas sin alineación ni directo no salen: el cliente rellena
-- hasta las que exige la liga.
create or replace function public.live_matchday_state(p_matchday_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_team uuid;
  v_admin boolean;
begin
  v_team := private.team_for_matchday(p_matchday_id);
  if v_team is null or not private.is_team_member(v_team) then
    raise exception 'No tienes acceso a esta jornada';
  end if;
  v_admin := private.is_team_admin(v_team);

  return (
    select jsonb_build_object(
      'matchday_id', m.id,
      'matchday_status', m.status::text,
      'is_admin', v_admin,
      'can_score', private.can_score_live(m.id, 1),
      'share_token', (select s.token from public.live_shares s where s.matchday_id = m.id),
      'courts', coalesce((
        select jsonb_agg(x.j order by x.court_number)
        from (
          select cn.court_number,
            jsonb_build_object(
              'court_number', cn.court_number,
              'player_a', (select jsonb_build_object('id', lp.player_a_id, 'name', lp.player_a_name)
                           from public.lineup_pairs lp join public.lineup_variants v on v.id = lp.variant_id and v.is_active
                           where lp.matchday_id = m.id and lp.court_number = cn.court_number and lp.player_a_id is not null limit 1),
              'player_b', (select jsonb_build_object('id', lp.player_b_id, 'name', lp.player_b_name)
                           from public.lineup_pairs lp join public.lineup_variants v on v.id = lp.variant_id and v.is_active
                           where lp.matchday_id = m.id and lp.court_number = cn.court_number and lp.player_b_id is not null limit 1),
              'forfeit', coalesce((select bool_or(r.forfeit) from public.match_results r
                                   where r.matchday_id = m.id and r.court_number = cn.court_number), false),
              'forfeit_us', coalesce((select bool_or(r.forfeit_us) from public.match_results r
                                      where r.matchday_id = m.id and r.court_number = cn.court_number and r.forfeit), false),
              'live', (select private.live_json(lm) from public.live_matches lm
                       where lm.matchday_id = m.id and lm.court_number = cn.court_number)
            ) as j
          from (
            select l.court_number from public.lineups l
              join public.lineup_variants v on v.id = l.variant_id and v.is_active
             where l.matchday_id = m.id
            union
            select lm.court_number from public.live_matches lm where lm.matchday_id = m.id
          ) cn
        ) x
      ), '[]'::jsonb)
    )
    from public.matchdays m
    where m.id = p_matchday_id
  );
end;
$$;

-- ── Lectura pública por token (anon) ─────────────────────────────────────
-- Solo lo de ESE token: equipos, jornada, pistas con parejas en formato
-- «Nombre A.» y el tanteo. Ni ids de jugador ni de usuario, ni emails, ni
-- teléfonos, ni quién marca.
create or replace function public.public_live_by_token(p_token text)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'token', s.token,
    'team_name', t.name,
    'opponent', m.opponent,
    'is_home', m.is_home,
    'jornada_number', m.jornada_number,
    'match_date', m.match_date,
    'match_time', m.match_time,
    'location', m.location,
    'category', t.category,
    'team_logo_url', t.logo_url,
    'matchday_status', m.status::text,
    'score_for', m.score_for,
    'score_against', m.score_against,
    'updated_at', greatest(
      (select max(lm.updated_at) from public.live_matches lm where lm.matchday_id = m.id),
      (select max(r.updated_at) from public.match_results r where r.matchday_id = m.id),
      m.updated_at),
    'courts', coalesce((
      select jsonb_agg(x.j order by x.court_number)
      from (
        select cn.court_number,
          jsonb_build_object(
            'court_number', cn.court_number,
            'pair', (select nullif(concat_ws(' / ',
                               private.live_short_name(pa.name),
                               private.live_short_name(pb.name)), '')
                     from public.lineups l
                     join public.lineup_variants v on v.id = l.variant_id and v.is_active
                     left join public.players pa on pa.id = l.player_a_id
                     left join public.players pb on pb.id = l.player_b_id
                     where l.matchday_id = m.id and l.court_number = cn.court_number limit 1),
            'forfeit', coalesce((select bool_or(r.forfeit) from public.match_results r
                                 where r.matchday_id = m.id and r.court_number = cn.court_number), false),
            'forfeit_us', coalesce((select bool_or(r.forfeit_us) from public.match_results r
                                    where r.matchday_id = m.id and r.court_number = cn.court_number and r.forfeit), false),
            'result_sets', coalesce((select jsonb_agg(jsonb_build_object('us', r.us, 'them', r.them) order by r.set_number)
                                     from public.match_results r
                                     where r.matchday_id = m.id and r.court_number = cn.court_number
                                       and not r.forfeit and r.us is not null and r.them is not null), '[]'::jsonb),
            'live', (select jsonb_build_object(
                              'status', lm.status, 'format', lm.format, 'sets', lm.sets,
                              'winner', lm.winner, 'started_at', lm.started_at,
                              'finished_at', lm.finished_at, 'updated_at', lm.updated_at)
                     from public.live_matches lm
                     where lm.matchday_id = m.id and lm.court_number = cn.court_number)
          ) as j
        from (
          select l.court_number from public.lineups l
            join public.lineup_variants v on v.id = l.variant_id and v.is_active
           where l.matchday_id = m.id
          union
          select lm.court_number from public.live_matches lm where lm.matchday_id = m.id
          union
          select r.court_number from public.match_results r where r.matchday_id = m.id
        ) cn
      ) x
    ), '[]'::jsonb)
  )
  from public.live_shares s
  join public.matchdays m on m.id = s.matchday_id
  join public.seasons se on se.id = m.season_id
  join public.teams t on t.id = se.team_id
  where s.token = lower(btrim(p_token))
    and s.kind = 'league';
$$;

-- ── Permisos ─────────────────────────────────────────────────────────────
revoke all on function public.live_claim_court(uuid, integer, boolean) from public, anon;
revoke all on function public.live_release_court(uuid, integer) from public, anon;
revoke all on function public.live_score_game(uuid, integer, text, uuid, integer) from public, anon;
revoke all on function public.live_undo_game(uuid, integer, integer) from public, anon;
revoke all on function public.live_finish_court(uuid, integer) from public, anon;
revoke all on function public.live_share_create(uuid) from public, anon;
revoke all on function public.live_matchday_state(uuid) from public, anon;
grant execute on function public.live_claim_court(uuid, integer, boolean) to authenticated;
grant execute on function public.live_release_court(uuid, integer) to authenticated;
grant execute on function public.live_score_game(uuid, integer, text, uuid, integer) to authenticated;
grant execute on function public.live_undo_game(uuid, integer, integer) to authenticated;
grant execute on function public.live_finish_court(uuid, integer) to authenticated;
grant execute on function public.live_share_create(uuid) to authenticated;
grant execute on function public.live_matchday_state(uuid) to authenticated;

revoke all on function public.public_live_by_token(text) from public;
grant execute on function public.public_live_by_token(text) to anon, authenticated;

revoke all on function private.can_score_live(uuid, integer) from public, anon;
revoke all on function private.live_scorer_name(uuid, uuid) from public, anon;
revoke all on function private.live_recompute(uuid) from public, anon, authenticated;
revoke all on function private.live_flush_results(uuid) from public, anon, authenticated;
revoke all on function private.live_guard(uuid, integer) from public, anon;
revoke all on function private.live_take(uuid, boolean) from public, anon;
grant execute on function private.can_score_live(uuid, integer) to authenticated;
grant execute on function private.live_scorer_name(uuid, uuid) to authenticated;
grant execute on function private.live_guard(uuid, integer) to authenticated;
grant execute on function private.live_take(uuid, boolean) to authenticated;
