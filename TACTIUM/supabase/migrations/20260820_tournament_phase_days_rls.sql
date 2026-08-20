-- #3: "los dias de las fases del torneo no se guardan".
--
-- La tabla `tournament_phase_days` se creo fuera de las migraciones trackeadas
-- y quedo con RLS activada SIN politicas (deny total) o sin GRANT para el rol
-- authenticated. Resultado: cuando el club_admin marca un dia de una fase,
-- `togglePhaseDay` (INSERT con la sesion del usuario) es rechazado y el dia no
-- persiste; la tabla esta vacia en TODos los torneos. En la app se veia como
-- "hay que volver a marcarlo cada vez, no se queda guardado".
--
-- Arreglo: RLS explicita. El admin del club dueño del torneo (owner del club o
-- club_member con rol 'admin') puede leer y gestionar los dias de fase; el
-- resto de autenticados puede LEER (los dias de fase son info de horario, no
-- sensible, y varias vistas los cargan). El webhook/servicio con service_role
-- sigue saltando RLS.

alter table public.tournament_phase_days enable row level security;

grant select, insert, update, delete on public.tournament_phase_days to authenticated;

-- Helper SECURITY DEFINER: evita recursion de RLS al mirar tournaments/clubs.
create or replace function public._tpd_is_club_admin(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    join public.clubs c on c.id = t.club_id
    where t.id = p_tournament_id
      and (
        c.owner_id = auth.uid()
        or exists (
          select 1 from public.club_members cm
          where cm.club_id = c.id
            and cm.user_id = auth.uid()
            and cm.role = 'admin'
        )
      )
  );
$$;

-- Lectura: cualquier autenticado (info de horario).
drop policy if exists tpd_read on public.tournament_phase_days;
create policy tpd_read
  on public.tournament_phase_days for select
  to authenticated
  using (true);

-- Alta: solo admin del club dueño del torneo.
drop policy if exists tpd_insert on public.tournament_phase_days;
create policy tpd_insert
  on public.tournament_phase_days for insert
  to authenticated
  with check (public._tpd_is_club_admin(tournament_id));

-- Modificacion: solo admin del club dueño del torneo.
drop policy if exists tpd_update on public.tournament_phase_days;
create policy tpd_update
  on public.tournament_phase_days for update
  to authenticated
  using (public._tpd_is_club_admin(tournament_id))
  with check (public._tpd_is_club_admin(tournament_id));

-- Borrado: solo admin del club dueño del torneo.
drop policy if exists tpd_delete on public.tournament_phase_days;
create policy tpd_delete
  on public.tournament_phase_days for delete
  to authenticated
  using (public._tpd_is_club_admin(tournament_id));
