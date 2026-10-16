-- Encuesta de hora: añadir y quitar horas de una encuesta ABIERTA, sin perder el resto de votos.
-- (aplicada en producción el 13-10-2026 como «time_poll_editar_opciones»)
--   · Añadir: capitán/admin; hasta 4 opciones; día no pasado; sin repetir. Avisa a quien ya votó.
--   · Quitar: capitán/admin; la encuesta tiene que seguir con 2 o más; se borra esa hora de cada voto.
-- (Antes solo se podía cancelar y crear otra, perdiendo todos los votos.)

create or replace function public.add_time_poll_option(p_poll_id uuid, p_date date, p_time time)
returns uuid
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.matchday_time_polls;
  v_md   public.matchdays;
  v_n    int;
  v_pos  int;
  v_id   uuid;
  v_msgs jsonb;
begin
  select * into v_poll from public.matchday_time_polls where id = p_poll_id;
  if not found then
    raise exception 'Encuesta no encontrada' using errcode = 'P0002';
  end if;
  if v_uid is null or not private.is_team_admin(v_poll.team_id) then
    raise exception 'Solo el capitán puede cambiar las horas' using errcode = '42501';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'La encuesta ya está cerrada' using errcode = '22023';
  end if;
  if p_date is null or p_time is null then
    raise exception 'Falta el día o la hora' using errcode = '22023';
  end if;
  if p_date < current_date then
    raise exception 'Esa hora ya pasó' using errcode = '22023';
  end if;
  select count(*), coalesce(max(position), -1) + 1 into v_n, v_pos
    from public.matchday_time_poll_options where poll_id = p_poll_id;
  if v_n >= 4 then
    raise exception 'Una encuesta admite como mucho 4 horas' using errcode = '22023';
  end if;
  if exists (select 1 from public.matchday_time_poll_options
              where poll_id = p_poll_id and match_date = p_date and match_time = p_time) then
    raise exception 'Esa hora ya está en la encuesta' using errcode = '23505';
  end if;

  insert into public.matchday_time_poll_options (poll_id, match_date, match_time, position)
  values (p_poll_id, p_date, p_time, v_pos)
  returning id into v_id;

  -- Quien ya votó no sabe que hay una hora nueva: se le avisa (el resto la verá al votar).
  select * into v_md from public.matchdays where id = v_poll.matchday_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', vt.user_id,
           'type', 'time_poll_open',
           'category', 'time_poll',
           'title', 'J' || v_md.jornada_number::text || ' · Hay una hora nueva',
           'body', private.time_poll_option_label(p_date, p_time) || '. Mira si te va.',
           'data', jsonb_build_object('type', 'time_poll_open', 'matchdayId', v_poll.matchday_id,
                                      'pollId', p_poll_id))), '[]'::jsonb)
    into v_msgs
    from public.matchday_time_poll_votes vt
   where vt.poll_id = p_poll_id and vt.user_id is not null and vt.user_id <> v_uid;
  perform private.send_availability_messages(v_msgs);

  return v_id;
end $$;

create or replace function public.remove_time_poll_option(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.matchday_time_polls;
  v_n    int;
begin
  select * into v_poll from public.matchday_time_polls where id = p_poll_id;
  if not found then
    raise exception 'Encuesta no encontrada' using errcode = 'P0002';
  end if;
  if v_uid is null or not private.is_team_admin(v_poll.team_id) then
    raise exception 'Solo el capitán puede cambiar las horas' using errcode = '42501';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'La encuesta ya está cerrada' using errcode = '22023';
  end if;
  if not exists (select 1 from public.matchday_time_poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'Esa hora no es de esta encuesta' using errcode = '22023';
  end if;
  select count(*) into v_n from public.matchday_time_poll_options where poll_id = p_poll_id;
  if v_n <= 2 then
    raise exception 'La encuesta tiene que quedarse con al menos 2 horas' using errcode = '22023';
  end if;

  -- Fuera esa hora de los votos de todos (el resto de sus votos se mantiene).
  update public.matchday_time_poll_votes
     set option_ids = array_remove(option_ids, p_option_id), updated_at = now()
   where poll_id = p_poll_id and p_option_id = any(option_ids);

  delete from public.matchday_time_poll_options where id = p_option_id and poll_id = p_poll_id;
end $$;

revoke all on function public.add_time_poll_option(uuid, date, time) from public, anon;
revoke all on function public.remove_time_poll_option(uuid, uuid) from public, anon;
grant execute on function public.add_time_poll_option(uuid, date, time) to authenticated;
grant execute on function public.remove_time_poll_option(uuid, uuid) to authenticated;
