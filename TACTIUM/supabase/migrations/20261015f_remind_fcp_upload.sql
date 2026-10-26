-- «Recordar a los capitanes»: el club avisa al momento de los horarios que aún no están subidos a la Federación.
--
-- Los avisos automáticos solo salen los lunes (09:00 y 13:30). Esto deja al club empujarlo cuando quiera, partido
-- a partido: manda un aviso a los capitanes de los partidos de LOCAL todavía sin marcar como subidos.
--
--   · Quién: gestor del club propietario del equipo o del club sede (los equipos invitados juegan en su pista).
--   · A quién: capitanes del equipo (rol captain/admin en team_members), un aviso por partido. Mismo tipo y categoría
--     que el aviso del lunes, para que respete lo que cada capitán tenga configurado.
--   · Tope: un partido no se puede recordar más de una vez cada 3 horas (no se acosa al capitán).
--   · `p_dry` devuelve los mensajes sin mandarlos (pruebas).

create table if not exists public.fcp_manual_reminder_log (
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);
create index if not exists fcp_manual_reminder_log_md_idx on public.fcp_manual_reminder_log (matchday_id, created_at desc);
alter table public.fcp_manual_reminder_log enable row level security;
revoke all on public.fcp_manual_reminder_log from anon, authenticated;

create or replace function public.remind_fcp_upload(p_matchday_ids uuid[], p_dry boolean default false)
returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid     uuid := auth.uid();
  v_msgs    jsonb := '[]'::jsonb;
  v_ids     uuid[] := '{}';
  v_recent  int := 0;
  v_sent    int := 0;
  r         record;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;

  for r in
    select m.id, m.jornada_number, m.opponent, m.match_time, t.id as team_id, t.name as team_name
      from public.matchdays m
      join public.seasons s on s.id = m.season_id
      join public.teams t on t.id = s.team_id
     where m.id = any(p_matchday_ids)
       and m.is_home
       and m.status = 'upcoming'
       and m.fcp_uploaded_at is null
       and (private.is_club_admin(t.club_id) or (t.venue_club_id is not null and private.is_club_admin(t.venue_club_id)))
  loop
    if exists (
      select 1 from public.fcp_manual_reminder_log l
       where l.matchday_id = r.id and l.created_at > now() - interval '3 hours'
    ) then
      v_recent := v_recent + 1;
      continue;
    end if;

    v_ids := v_ids || r.id;
    v_msgs := v_msgs || coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', tm.user_id, 'type', 'fcp_upload_reminder', 'category', 'fcp_upload',
               'title', 'Tu club te recuerda: sube la hora a la Federación',
               'body', coalesce('J' || r.jornada_number::text, 'Jornada') || coalesce(' vs ' || r.opponent, '')
                       || ' (' || r.team_name || '): plazo el lunes a las 20:00.'
                       || case when r.match_time is null then ' Aún no tiene hora: pídesela a tu club.' else '' end,
               'data', jsonb_build_object('type', 'fcp_upload_reminder', 'matchdayId', r.id, 'teamId', r.team_id)))
        from public.team_members tm
       where tm.team_id = r.team_id and tm.role in ('captain', 'admin') and tm.user_id is distinct from v_uid
    ), '[]'::jsonb);
  end loop;

  if p_dry then
    return jsonb_build_object('dry', true, 'partidos', coalesce(array_length(v_ids, 1), 0),
                              'ya_recordados', v_recent, 'msgs', v_msgs);
  end if;

  if array_length(v_ids, 1) is not null then
    insert into public.fcp_manual_reminder_log (matchday_id, created_by)
    select unnest(v_ids), v_uid;
    v_sent := private.send_availability_messages(v_msgs);
  end if;

  return jsonb_build_object('partidos', coalesce(array_length(v_ids, 1), 0),
                            'ya_recordados', v_recent, 'avisos', jsonb_array_length(v_msgs), 'pushes', v_sent);
end $$;

revoke all on function public.remind_fcp_upload(uuid[], boolean) from public, anon;
grant execute on function public.remind_fcp_upload(uuid[], boolean) to authenticated;
