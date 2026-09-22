-- Borrar avisos.
--
-- `notifications` sólo tenía políticas de SELECT y UPDATE: se podían marcar
-- como leídos pero no quitarlos de en medio, y la campana acababa siendo un
-- archivo de treinta líneas que nadie limpia.
--
-- Mismo criterio que las otras dos políticas: cada uno, los suyos.

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete
  on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));
