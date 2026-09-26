-- El admin de un club ve el perfil (foto, nombre corto) de los jugadores
-- vinculados a los equipos de su club, aunque no sean miembros del club.
-- `profiles_teammate_select` sólo cubría compañeros de equipo y miembros del
-- club; sin esto, en el panel del club los jugadores salían sin su foto.
-- Aplicada en producción el 2026-09-26.
drop policy if exists profiles_club_admin_team_players_select on public.profiles;
create policy profiles_club_admin_team_players_select on public.profiles
  for select using (
    exists (
      select 1
        from public.club_members me
        join public.teams t on t.club_id = me.club_id
        join public.team_members tm on tm.team_id = t.id
       where me.user_id = (select auth.uid())
         and me.role = 'admin'::club_role
         and tm.user_id = profiles.id
    )
  );
