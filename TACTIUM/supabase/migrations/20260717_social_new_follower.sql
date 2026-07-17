-- ─────────────────────────────────────────────────────────────────────────
-- Social (rama feature/perfiles-sociales): notificación in-app "te ha
-- empezado a seguir". Trigger AFTER INSERT en public.follows.
--   · seguir a un JUGADOR → aviso al jugador seguido.
--   · seguir a un CLUB    → aviso a los admins del club (excl. el que sigue).
-- Aditivo y dormido: solo dispara cuando la app social (aún en rama) hace
-- follows. Usa los helpers private.notify / private.display_name.
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- (Aplicada en prod vía MCP el 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function private.tg_notify_new_follower()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_actor text;
  v_club  text;
begin
  v_actor := private.display_name(new.follower_id);

  if new.target_type = 'user' then
    perform private.notify(
      new.target_id, 'new_follower',
      v_actor || ' te ha empezado a seguir',
      v_actor || ' ahora sigue tu perfil en TACTIUM.',
      jsonb_build_object('actor_id', new.follower_id)
    );
  elsif new.target_type = 'club' then
    select name into v_club from public.clubs where id = new.target_id;
    insert into public.notifications (user_id, type, title, body, data)
    select cm.user_id, 'new_follower',
      v_actor || ' sigue tu club',
      v_actor || ' ha empezado a seguir a ' || coalesce(v_club, 'tu club') || '.',
      jsonb_build_object('actor_id', new.follower_id, 'club_id', new.target_id)
    from public.club_members cm
    where cm.club_id = new.target_id
      and cm.role = 'admin'
      and cm.user_id is distinct from new.follower_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_new_follower on public.follows;
create trigger notify_new_follower
  after insert on public.follows
  for each row execute function private.tg_notify_new_follower();
