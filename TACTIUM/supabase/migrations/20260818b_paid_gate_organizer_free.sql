-- Afina el blindaje: el ORGANIZADOR (owner/admin del club) mete a sus parejas
-- GRATIS en su propio torneo (es la casa, no se cobra a sí mismo). Solo los
-- EXTERNOS pagan. Independiente de la vía: se mira auth.uid() = admin del club.
--
-- · Organizador (logueado, alta manual o cualquier insert) → auth.uid() = admin
--   → pasa gratis.
-- · Externo (anónimo o no-admin) por el signup público → no es admin, sin flag
--   de pago → bloqueado (debe pagar).
-- · Webhook de pago → flag 'tactium.paid_signup'='on' → pasa.

create or replace function public.tournament_registration_paid_gate()
returns trigger
language plpgsql
as $$
declare
  v_fee numeric;
  v_connected boolean;
  v_club uuid;
  v_is_admin boolean := false;
begin
  select t.entry_fee, (c.stripe_connect_status = 'active'), t.club_id
    into v_fee, v_connected, v_club
    from public.tournaments t
    left join public.clubs c on c.id = t.club_id
   where t.id = new.tournament_id;

  -- ¿El que inserta es el owner/admin del club del torneo? (auth.uid() se lee
  -- del JWT de la petición, también dentro de funciones SECURITY DEFINER.)
  if v_club is not null and auth.uid() is not null then
    select exists (
      select 1 from public.clubs
        where id = v_club and owner_id = auth.uid()
      union all
      select 1 from public.club_members
        where club_id = v_club and user_id = auth.uid() and role = 'admin'
    ) into v_is_admin;
  end if;

  if coalesce(v_fee, 0) > 0
     and coalesce(v_connected, false)
     and not v_is_admin
     and coalesce(current_setting('tactium.paid_signup', true), '') <> 'on' then
    raise exception 'Este torneo tiene cuota: paga la inscripción para apuntarte'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
