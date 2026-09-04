-- TRASPASO DEL EQUIPO INVITADO A SU CAPITÁN DE VERDAD.
--
-- El agujero que cierra: cuando un club añade un equipo invitado (juega en sus
-- pistas sin ser suyo — ver 20260903c_venue_teams.sql), ese equipo se crea a
-- nombre del gestor del club, porque `teams.owner_id` no admite vacío. La app
-- solo le ofrece horarios, pero a nivel de base de datos tiene poder completo
-- sobre un equipo ajeno. Mientras el equipo no existe para nadie más da igual;
-- en cuanto aparece su capitán de verdad, no.
--
-- Así que en el momento en que ese capitán entra (canjea el código de capitán
-- que le pasa el club), el equipo pasa a ser SUYO:
--   · `owner_id` → el capitán que acaba de entrar.
--   · el gestor del club deja de ser miembro del equipo.
--   · el club CONSERVA `venue_club_id`, o sea, sigue poniendo los horarios —
--     que es justo lo que se pactó: vínculo directo y revocable por el capitán.
--
-- Va como trigger y no dentro de `redeem_team_invitation` a propósito: esa
-- función hace ya bastantes cosas y no quiero tocarla para esto.

create or replace function public.guest_team_captain_takeover()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  t public.teams%rowtype;
  v_club_name text;
begin
  if new.role <> 'captain' or new.user_id is null then
    return new;
  end if;

  select * into t from public.teams where id = new.team_id;
  if not found then return new; end if;

  -- Solo equipos INVITADOS: sin club propio y con sede apuntada.
  if t.club_id is not null or t.venue_club_id is null then return new; end if;
  -- Y solo si el dueño actual es el club sede: si el equipo ya es de una
  -- persona de verdad, aquí no se toca nada.
  if not exists (
    select 1 from public.clubs c
     where c.id = t.venue_club_id and c.owner_id = t.owner_id
    union
    select 1 from public.club_members cm
     where cm.club_id = t.venue_club_id and cm.user_id = t.owner_id
       and cm.role = 'admin'
  ) then
    return new;
  end if;
  if new.user_id = t.owner_id then return new; end if;

  update public.teams set owner_id = new.user_id where id = t.id;

  -- El gestor del club deja de ser miembro del equipo: su relación con él pasa
  -- a ser SOLO la de sede (venue_club_id), que es lo que se le prometió.
  delete from public.team_members
   where team_id = t.id and user_id = t.owner_id and user_id <> new.user_id;

  select c.name into v_club_name from public.clubs c where c.id = t.venue_club_id;

  insert into public.notifications (user_id, type, title, body, data)
  select distinct u, 'joined_team', 'Equipo reclamado',
         'El capitán de "' || t.name || '" ha entrado en TACTIUM y el equipo pasa a ser suyo. '
           || 'Tú sigues poniendo los horarios de sus partidos en tu club.',
         jsonb_build_object('team_id', t.id)
  from (
    select c.owner_id as u from public.clubs c where c.id = t.venue_club_id
    union
    select cm.user_id from public.club_members cm
     where cm.club_id = t.venue_club_id and cm.role = 'admin'
  ) x
  where u is not null and u is distinct from new.user_id;

  return new;
end;
$function$;

drop trigger if exists guest_team_captain_takeover_trg on public.team_members;
create trigger guest_team_captain_takeover_trg
  after insert or update of role on public.team_members
  for each row
  execute function public.guest_team_captain_takeover();
