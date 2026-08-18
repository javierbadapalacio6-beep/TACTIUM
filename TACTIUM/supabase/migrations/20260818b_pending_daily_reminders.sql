-- Recordatorio DIARIO con cuenta atrás para las inscripciones pendientes de pago
-- en el club: durante la última semana antes del límite se avisa cada día
-- ("te quedan N días… hoy es el último"); pasado el límite, se elimina.
--
-- Reemplaza expire_pending_signups() (el cron sigue llamando al mismo nombre,
-- no hay que reprogramar nada).

create or replace function public.expire_pending_signups()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_window constant int := 7;  -- días de recordatorio antes del límite
begin
  -- (1) RECORDATORIO DIARIO en la ventana [límite − 7, límite], con cuenta atrás.
  insert into public.notifications (user_id, type, title, body, data)
  select distinct u.uid,
         'tournament_payment_due',
         case
           when (t.starts_on::date - coalesce(t.payment_deadline_days, 3)) = current_date
             then 'Hoy es el último día para pagar tu inscripción'
           else 'Te quedan '
             || ((t.starts_on::date - coalesce(t.payment_deadline_days, 3)) - current_date)
             || ' día(s) para pagar tu inscripción'
         end,
         'Paga la inscripción de "' || t.name || '" o perderás la plaza.',
         jsonb_build_object('tournament_id', t.id, 'registration_id', r.id)
  from public.tournament_registrations r
  join public.tournaments t on t.id = r.tournament_id
  cross join lateral (values (r.p1_user_id), (r.p2_user_id)) as u(uid)
  where r.payment_status = 'pending_club'
    and t.starts_on is not null
    and u.uid is not null
    and current_date >= (t.starts_on::date - coalesce(t.payment_deadline_days, 3) - v_window)
    and current_date <= (t.starts_on::date - coalesce(t.payment_deadline_days, 3))
    -- un aviso por inscripción y día (evita duplicar en la misma ejecución)
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
