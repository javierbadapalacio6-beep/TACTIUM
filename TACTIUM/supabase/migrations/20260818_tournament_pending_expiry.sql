-- CADUCIDAD de inscripciones pendientes de pago en el club.
-- La pareja tiene hasta `payment_deadline_days` antes del torneo para pagar; si
-- no, su inscripción PENDIENTE se elimina para dar hueco a otros. El día del
-- límite se avisa a las parejas con usuario vinculado.
--
-- Se ejecuta a diario (pg_cron). Ver TACTIUM/docs/plan-inscripciones-connect.md.

-- Límite configurable por torneo (días antes del inicio). Default 3.
alter table public.tournaments
  add column if not exists payment_deadline_days integer not null default 3;

create or replace function public.expire_pending_signups()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- (1) AVISO el DÍA DEL LÍMITE a las parejas pendientes con usuario vinculado.
  insert into public.notifications (user_id, type, title, body, data)
  select distinct u.uid,
         'tournament_payment_due',
         'Hoy es el último día para pagar tu inscripción',
         'Paga la inscripción de "' || t.name ||
           '" hoy o perderás la plaza.',
         jsonb_build_object('tournament_id', t.id, 'registration_id', r.id)
  from public.tournament_registrations r
  join public.tournaments t on t.id = r.tournament_id
  cross join lateral (values (r.p1_user_id), (r.p2_user_id)) as u(uid)
  where r.payment_status = 'pending_club'
    and t.starts_on is not null
    and u.uid is not null
    and current_date = (t.starts_on::date - coalesce(t.payment_deadline_days, 3))
    and not exists (
      select 1 from public.notifications n
      where n.user_id = u.uid
        and n.type = 'tournament_payment_due'
        and (n.data->>'registration_id') = r.id::text
        and n.created_at::date = current_date
    );

  -- (2) BORRADO pasado el límite: elimina las inscripciones aún PENDIENTES.
  delete from public.tournament_registrations r
  using public.tournaments t
  where r.tournament_id = t.id
    and r.payment_status = 'pending_club'
    and t.starts_on is not null
    and current_date > (t.starts_on::date - coalesce(t.payment_deadline_days, 3));
end;
$$;

-- Programación diaria (requiere la extensión pg_cron habilitada en el proyecto).
-- Se ejecuta a las 03:00. Si pg_cron no está activo, habilítalo en el panel de
-- Supabase (Database → Extensions → pg_cron) y ejecuta el `cron.schedule`.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'expire-pending-signups') then
      perform cron.unschedule('expire-pending-signups');
    end if;
    perform cron.schedule(
      'expire-pending-signups',
      '0 3 * * *',
      $cron$ select public.expire_pending_signups(); $cron$
    );
  end if;
end;
$$;
