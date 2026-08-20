-- Herencia de premium para capitanes/jugadores invitados a un club.
--
-- PROBLEMA: el gate de premium del cliente (usePremiumGate -> subscriptionStore)
-- lee la tabla `subscriptions` con la sesión del propio usuario, sujeto a RLS.
-- La RLS anterior solo dejaba leer la fila de suscripción del club al
-- owner/admin del club (y al payer). Un capitán que entra por código de
-- invitacion NO podia leer la sub del club -> `hasPremiumAccess` no encontraba
-- la `clubSub` en el store -> caia a reason 'no_subscription' -> PAYWALL,
-- aunque `fn_has_premium_access` (SECURITY DEFINER, salta RLS) si le daria
-- acceso. Resultado: al tocar temporadas/alineaciones se le pedia pagar el
-- plan de Capitan, contradiciendo la regla "capitan invitado por un club
-- nunca paga".
--
-- SOLUCION: politica SELECT adicional (permisiva, se OR-ea con las existentes)
-- que permite a cualquier miembro de un equipo de un club LEER la fila de
-- suscripcion de ESE club. Las columnas sensibles (revenuecat/transaction ids)
-- ya estan revocadas a nivel de columna, y el store solo usa
-- SUB_VISIBLE_COLS (tier/estado/periodo), sin PII.

drop policy if exists subs_club_member_read on public.subscriptions;

create policy subs_club_member_read
  on public.subscriptions
  for select
  to authenticated
  using (
    subject_type = 'club'
    and subject_id in (
      select t.club_id
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = auth.uid()
        and t.club_id is not null
    )
  );
