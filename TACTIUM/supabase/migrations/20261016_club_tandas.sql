-- Tandas en los horarios del club.
--
-- Una «tanda» son los partidos que se juegan a la misma hora. La normativa de la Liga Cántabra (VII y XI.3.1) pide
-- que el equipo local ponga fecha, hora, sede Y TANDAS: «3-2» = tres partidos a la hora de inicio y dos a la siguiente.
-- Masculino: 5 partidos y como mucho 3 tandas. Femenino: 4 partidos y como mucho 2.
--
-- `matchdays.tandas` ya existía (texto «N-N-N»). Lo que faltaba:
--   · una tanda HABITUAL por equipo (`teams.preferred_tandas`), para que al poner la hora salga ya marcada;
--   · RPC de puerta estrecha para que el club SEDE ponga las tandas de un equipo invitado (la RLS no le deja);
--   · una lectura con el género de cada equipo (propios e invitados) y su tanda habitual.

alter table public.teams add column if not exists preferred_tandas text;
do $$ begin
  alter table public.teams add constraint teams_preferred_tandas_format
    check (preferred_tandas is null or preferred_tandas ~ '^[1-5](-[1-5]){0,2}$');
exception when duplicate_object then null; end $$;

-- ¿«3-2» vale para este género? Masculino: suma 5 y ≤ 3 tandas. Femenino: suma 4 y ≤ 2 tandas.
create or replace function private.valid_tandas(p_tandas text, p_gender text)
returns boolean
language plpgsql immutable
as $$
declare
  v_parts text[];
  v_sum   int := 0;
  v_p     text;
  v_total int := case when p_gender = 'femenino' then 4 else 5 end;
  v_max   int := case when p_gender = 'femenino' then 2 else 3 end;
begin
  if p_tandas is null then return true; end if;
  if p_tandas !~ '^[1-5](-[1-5]){0,2}$' then return false; end if;
  v_parts := string_to_array(p_tandas, '-');
  if array_length(v_parts, 1) > v_max then return false; end if;
  foreach v_p in array v_parts loop v_sum := v_sum + v_p::int; end loop;
  return v_sum = v_total;
end $$;

-- Género y tanda habitual de varios equipos. Solo para quien gestiona el club propietario o el club sede.
create or replace function public.get_team_tandas_info(p_team_ids uuid[])
returns table(team_id uuid, gender text, preferred_tandas text)
language sql stable security definer set search_path = 'public', 'pg_temp'
as $$
  select t.id, t.gender::text, t.preferred_tandas
    from public.teams t
   where t.id = any(p_team_ids)
     and (private.is_team_admin(t.id)
          or (t.club_id is not null and private.is_club_admin(t.club_id))
          or (t.venue_club_id is not null and private.is_club_admin(t.venue_club_id)));
$$;
revoke all on function public.get_team_tandas_info(uuid[]) from public, anon;
grant execute on function public.get_team_tandas_info(uuid[]) to authenticated;

-- Tanda habitual de un equipo INVITADO (la pone su club sede).
create or replace function public.set_venue_team_tandas(p_team_id uuid, p_tandas text)
returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare v_team public.teams%rowtype;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then raise exception 'Equipo no encontrado'; end if;
  if v_team.venue_club_id is null or v_team.club_id is not distinct from v_team.venue_club_id then
    raise exception 'Ese equipo no es un invitado de tu club';
  end if;
  if not private.is_club_admin(v_team.venue_club_id) then
    raise exception 'Solo el club sede puede editar sus tandas' using errcode = 'insufficient_privilege';
  end if;
  if not private.valid_tandas(nullif(btrim(p_tandas), ''), v_team.gender::text) then
    raise exception 'Tandas no válidas para este equipo: %', p_tandas;
  end if;
  update public.teams set preferred_tandas = nullif(btrim(p_tandas), '') where id = p_team_id;
end $$;
revoke all on function public.set_venue_team_tandas(uuid, text) from public, anon;
grant execute on function public.set_venue_team_tandas(uuid, text) to authenticated;

-- Tandas de un partido de un equipo INVITADO (las pone su club sede, junto con día, hora y pista).
create or replace function public.set_venue_matchday_tandas(p_matchday_id uuid, p_tandas text)
returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_md   public.matchdays%rowtype;
  v_team public.teams%rowtype;
begin
  select * into v_md from public.matchdays where id = p_matchday_id;
  if not found then raise exception 'Jornada no encontrada'; end if;
  select t.* into v_team from public.seasons s join public.teams t on t.id = s.team_id where s.id = v_md.season_id;
  if not found then raise exception 'Equipo no encontrado'; end if;
  if v_team.venue_club_id is null or not private.is_club_admin(v_team.venue_club_id) then
    raise exception 'Solo el club sede puede poner las tandas' using errcode = 'insufficient_privilege';
  end if;
  if not v_md.is_home then raise exception 'Ese partido no se juega en tu club'; end if;
  if not private.valid_tandas(nullif(btrim(p_tandas), ''), v_team.gender::text) then
    raise exception 'Tandas no válidas para este equipo: %', p_tandas;
  end if;
  update public.matchdays set tandas = nullif(btrim(p_tandas), '') where id = p_matchday_id;
end $$;
revoke all on function public.set_venue_matchday_tandas(uuid, text) from public, anon;
grant execute on function public.set_venue_matchday_tandas(uuid, text) to authenticated;
