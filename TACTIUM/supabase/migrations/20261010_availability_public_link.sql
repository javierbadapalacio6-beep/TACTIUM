-- Enlace público de disponibilidad (sin cuenta).
--
-- El capitán pega UN enlace por jornada en el grupo de WhatsApp (tactium.io/d/<token>);
-- cada jugador, sin cuenta, se elige en la lista y marca Voy / Duda / No.
--
-- Mismo patrón que el marcador en directo (`live_shares` + `public_live_by_token`):
-- la tabla de tokens tiene RLS sin ninguna policy y sin grants, así que solo se toca
-- por RPC SECURITY DEFINER. El token (128 bits) es el secreto; se puede rotar.
--
-- Las respuestas del enlace van a la MISMA tabla `availability` que las de la app, con
-- `answered_via = 'link'` (y `updated_by` nulo, como el cierre automático, que se
-- distingue por `auto_resolved`).

-- ── 1. Tabla de tokens ──────────────────────────────────────────────────────
create table if not exists public.availability_links (
  token               text primary key check (token ~ '^[a-f0-9]{32}$'),
  matchday_id         uuid not null references public.matchdays(id) on delete cascade,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  revoked_at          timestamptz,
  -- Freno de abuso: escrituras en la ventana de 1 h (se reinicia sola).
  writes_count        integer not null default 0,
  writes_window_start timestamptz not null default now()
);

-- Un solo enlace vigente por jornada (idempotente al crearlo).
create unique index if not exists availability_links_one_active_per_matchday
  on public.availability_links (matchday_id) where revoked_at is null;

alter table public.availability_links enable row level security;
-- Sin policies a propósito: solo las RPC de abajo (SECURITY DEFINER) leen y escriben.
revoke all on table public.availability_links from public, anon, authenticated;

-- ── 2. Origen de la respuesta ───────────────────────────────────────────────
alter table public.availability add column if not exists answered_via text;
alter table public.availability drop constraint if exists availability_answered_via_chk;
alter table public.availability
  add constraint availability_answered_via_chk check (answered_via is null or answered_via = 'link');

-- Una respuesta posterior desde la app (o el cierre automático de la duda) deja de ser
-- «del enlace». El propio enlace fija `answered_via = 'link'` en su upsert, así que no se limpia.
create or replace function private.availability_clear_via()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.answered_via is not distinct from old.answered_via
     and (new.updated_by is not null or new.auto_resolved) then
    new.answered_via := null;
  end if;
  return new;
end $$;

drop trigger if exists availability_clear_via on public.availability;
create trigger availability_clear_via
  before update on public.availability
  for each row execute function private.availability_clear_via();

-- ── 3. Estado de un token ───────────────────────────────────────────────────
-- El enlace vale desde que se crea hasta 3 h después del inicio, y solo con la jornada
-- pendiente. `reason` null = vigente.
create or replace function private.availability_link_state(p_token text)
returns table (matchday_id uuid, reason text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_t    text := lower(btrim(coalesce(p_token, '')));
  v_link public.availability_links;
  v_st   text;
begin
  if v_t !~ '^[a-f0-9]{32}$' then
    return query select null::uuid, 'not_found'::text; return;
  end if;
  select * into v_link from public.availability_links l where l.token = v_t;
  if not found then
    return query select null::uuid, 'not_found'::text; return;
  end if;
  if v_link.revoked_at is not null then
    return query select v_link.matchday_id, 'revoked'::text; return;
  end if;
  select m.status::text into v_st from public.matchdays m where m.id = v_link.matchday_id;
  if v_st is distinct from 'upcoming'
     or now() > private.matchday_starts_at(v_link.matchday_id) + interval '3 hours' then
    return query select v_link.matchday_id, 'expired'::text; return;
  end if;
  return query select v_link.matchday_id, null::text;
end $$;

-- ── 4. Crear / rotar el enlace (capitán) ────────────────────────────────────
create or replace function public.availability_link_create(p_matchday_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_team  uuid := private.team_for_matchday(p_matchday_id);
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_team is null or not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede crear el enlace' using errcode = '42501';
  end if;

  select l.token into v_token from public.availability_links l
   where l.matchday_id = p_matchday_id and l.revoked_at is null;
  if v_token is not null then return v_token; end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');
  begin
    insert into public.availability_links (token, matchday_id, created_by)
    values (v_token, p_matchday_id, auth.uid());
  exception when unique_violation then
    -- Carrera con otra petición: se devuelve el que ganó.
    select l.token into v_token from public.availability_links l
     where l.matchday_id = p_matchday_id and l.revoked_at is null;
  end;
  return v_token;
end $$;

-- Si el enlace se filtra: el viejo deja de valer y se crea otro.
create or replace function public.availability_link_rotate(p_matchday_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_team  uuid := private.team_for_matchday(p_matchday_id);
  v_token text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_team is null or not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede cambiar el enlace' using errcode = '42501';
  end if;

  update public.availability_links set revoked_at = now()
   where matchday_id = p_matchday_id and revoked_at is null;
  insert into public.availability_links (token, matchday_id, created_by)
  values (v_token, p_matchday_id, auth.uid());
  return v_token;
end $$;

-- ── 5. Lectura pública por token (anon) ─────────────────────────────────────
-- Solo lo de ESE token: equipo, jornada y la plantilla activa con nombre corto
-- («Iván R.») y su respuesta. Ni emails, ni teléfonos, ni ids de usuario.
create or replace function public.public_availability_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_md    uuid;
  v_why   text;
  v_team  uuid;
  v_t     public.teams;
  v_m     public.matchdays;
  v_pl    jsonb;
begin
  select s.matchday_id, s.reason into v_md, v_why from private.availability_link_state(p_token) s;
  if v_md is null then
    return jsonb_build_object('valid', false, 'reason', coalesce(v_why, 'not_found'));
  end if;

  v_team := private.team_for_matchday(v_md);
  select * into v_t from public.teams where id = v_team;
  select * into v_m from public.matchdays where id = v_md;

  if v_why is not null then
    -- Caducado o rotado: solo lo mínimo para el mensaje «esta jornada ya pasó».
    return jsonb_build_object(
      'valid', false, 'reason', v_why,
      'team_name', v_t.name, 'opponent', v_m.opponent, 'match_date', v_m.match_date);
  end if;

  with base as (
    select p.id,
           coalesce(nullif(p.alias, ''), p.name) as full_name,
           private.live_short_name(coalesce(nullif(p.alias, ''), p.name)) as short_name,
           a.status, a.reason
      from public.players p
      left join public.availability a on a.matchday_id = v_md and a.player_id = p.id
     where p.team_id = v_team and p.active
  ), dup as (
    select b.*,
           count(*) over (partition by b.short_name) as n_short
      from base b
  ), final as (
    select d.id, d.status, d.reason,
           -- Si dos jugadores comparten «Nombre A.», se alarga a las dos palabras.
           case when d.n_short > 1
                then initcap(btrim(split_part(btrim(regexp_replace(d.full_name, '\s+', ' ', 'g')), ' ', 1)
                       || ' ' || split_part(btrim(regexp_replace(d.full_name, '\s+', ' ', 'g')), ' ', 2)))
                else d.short_name end as name
      from dup d
  ), numerado as (
    select f.*, row_number() over (partition by f.name order by f.id) as rn,
           count(*) over (partition by f.name) as n_name
      from final f
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           'name', case when x.n_name > 1 then x.name || ' (' || x.rn || ')' else x.name end,
           'status', x.status, 'reason', x.reason)
         order by x.name, x.rn), '[]'::jsonb)
    into v_pl
    from numerado x;

  return jsonb_build_object(
    'valid', true,
    'team_name', v_t.name,
    'team_logo_url', v_t.logo_url,
    'category', v_t.category,
    'opponent', v_m.opponent,
    'is_home', v_m.is_home,
    'jornada_number', v_m.jornada_number,
    'match_date', v_m.match_date,
    'match_time', v_m.match_time,
    'location', v_m.location,
    'maybe_deadline', public.availability_maybe_deadline(v_md),
    'counts', jsonb_build_object(
      'yes',     (select count(*) from jsonb_array_elements(v_pl) e where e->>'status' = 'yes'),
      'maybe',   (select count(*) from jsonb_array_elements(v_pl) e where e->>'status' = 'maybe'),
      'no',      (select count(*) from jsonb_array_elements(v_pl) e where e->>'status' = 'no'),
      'pending', (select count(*) from jsonb_array_elements(v_pl) e where e->>'status' is null)),
    'players', v_pl
  );
end $$;

-- ── 6. Responder desde el enlace (anon) ─────────────────────────────────────
-- Siempre devuelve jsonb {ok, reason?}: los fallos esperados no son excepciones.
create or replace function public.public_respond_availability(
  p_token     text,
  p_player_id uuid,
  p_status    text,
  p_reason    text default null,
  p_note      text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_md   uuid;
  v_why  text;
  v_team uuid;
  v_cnt  integer;
  v_t    text := lower(btrim(coalesce(p_token, '')));
begin
  select s.matchday_id, s.reason into v_md, v_why from private.availability_link_state(p_token) s;
  if v_why is not null then
    return jsonb_build_object('ok', false, 'reason', v_why);
  end if;

  if p_status is null or p_status not in ('yes', 'maybe', 'no') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  if p_status = 'maybe' and p_reason is not null
     and p_reason not in ('trabajo', 'molestias', 'viaje', 'pendiente') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;

  v_team := private.team_for_matchday(v_md);
  if p_player_id is null or not exists (
       select 1 from public.players p
        where p.id = p_player_id and p.team_id = v_team and p.active) then
    return jsonb_build_object('ok', false, 'reason', 'no_player');
  end if;

  if p_status = 'maybe' and now() >= public.availability_maybe_deadline(v_md) then
    return jsonb_build_object('ok', false, 'reason', 'maybe_closed');
  end if;

  -- Freno: máximo 300 escrituras por enlace y hora.
  update public.availability_links l
     set writes_count = case when now() - l.writes_window_start > interval '1 hour' then 1 else l.writes_count + 1 end,
         writes_window_start = case when now() - l.writes_window_start > interval '1 hour' then now() else l.writes_window_start end
   where l.token = v_t
  returning l.writes_count into v_cnt;
  if v_cnt > 300 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into public.availability
    (matchday_id, player_id, status, reason, note, updated_by, updated_at, auto_resolved, answered_via)
  values (v_md, p_player_id, p_status,
          case when p_status = 'maybe' then p_reason end,
          nullif(left(btrim(coalesce(p_note, '')), 140), ''),
          null, now(), false, 'link')
  on conflict (matchday_id, player_id) do update
    set status = excluded.status, reason = excluded.reason, note = excluded.note,
        updated_by = null, updated_at = now(), auto_resolved = false, answered_via = 'link';

  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

-- ── 7. Permisos ─────────────────────────────────────────────────────────────
revoke all on function private.availability_link_state(text) from public, anon, authenticated;

revoke all on function public.availability_link_create(uuid) from public, anon;
grant execute on function public.availability_link_create(uuid) to authenticated;
revoke all on function public.availability_link_rotate(uuid) from public, anon;
grant execute on function public.availability_link_rotate(uuid) to authenticated;

revoke all on function public.public_availability_by_token(text) from public;
grant execute on function public.public_availability_by_token(text) to anon, authenticated;
revoke all on function public.public_respond_availability(text, uuid, text, text, text) from public;
grant execute on function public.public_respond_availability(text, uuid, text, text, text) to anon, authenticated;
