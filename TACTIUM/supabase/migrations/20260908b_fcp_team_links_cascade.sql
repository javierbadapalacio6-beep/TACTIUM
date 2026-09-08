-- Limpieza y cascada de los vínculos con la Federación.
--
-- `fcp_team_links` no tenía clave foránea contra `teams`, así que al borrar un
-- equipo el vínculo se quedaba colgando: 76 de 110 filas apuntaban a equipos
-- inexistentes. Como la app busca el vínculo por id federado y esperaba UNA
-- fila, esa basura rompía la importación con «Cannot coerce the result to a
-- single JSON object».
--
-- Ojo: seguir habiendo VARIAS filas por id federado es legítimo — el mismo
-- equipo de la Federación lo pueden importar clubes distintos. Por eso el
-- cliente también deja de asumir que hay una sola (ver findMyLinkedTeam).

delete from public.fcp_team_links l
 where not exists (select 1 from public.teams t where t.id = l.team_id);

alter table public.fcp_team_links
  drop constraint if exists fcp_team_links_team_id_fkey;

alter table public.fcp_team_links
  add constraint fcp_team_links_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete cascade;

create index if not exists fcp_team_links_team_idx
  on public.fcp_team_links (team_id);
