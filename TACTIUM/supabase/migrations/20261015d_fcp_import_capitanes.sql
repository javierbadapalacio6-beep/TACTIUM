-- Los capitanes (y quien gestiona el club) pueden actualizar la plantilla y volcar la temporada de la Federación.
--
-- Hasta ahora import_fcp_roster / import_fcp_season / apply_fcp_season_update solo dejaban pasar al dueño del
-- equipo o al admin del club ("Sin permiso sobre este equipo"). Un capitán que entra con el código de capitán
-- queda en team_members con rol 'captain', no como dueño, así que no podía actualizar su propia plantilla
-- (caso real: capitán de Smash, 15-10-2026). private.is_team_admin ya cubre capitán/admin del equipo y admin
-- del club; se conserva además al dueño por si no figurara en team_members.
--
-- Se reescribe el cuerpo de las tres funciones sustituyendo SOLO la condición de permiso.

do $$
declare
  fn text;
  def text;
  nuevo text;
  viejo constant text := 'v_owner <> auth.uid() and not exists (
    select 1 from public.clubs c join public.teams t on t.club_id = c.id
    where t.id = p_team_id and private.is_club_admin(c.id)
  )';
  reemplazo constant text := 'v_owner <> auth.uid() and not private.is_team_admin(p_team_id)';
begin
  foreach fn in array array['import_fcp_roster', 'import_fcp_season', 'apply_fcp_season_update'] loop
    select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = fn;

    if def is null then
      raise exception 'No existe public.%', fn;
    end if;

    nuevo := replace(def, viejo, reemplazo);
    if nuevo = def then
      -- Ya estaba aplicada (o el cuerpo cambió): no se toca.
      raise notice '% sin cambios', fn;
    else
      execute nuevo;
    end if;
  end loop;
end $$;
