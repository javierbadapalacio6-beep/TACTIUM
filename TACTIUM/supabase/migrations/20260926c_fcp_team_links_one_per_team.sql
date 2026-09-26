-- Un equipo TACTIUM tiene UN vínculo federativo. La clave primaria
-- (fcp_id_equipo, team_id) permitía dos filas para el mismo equipo —pasó al
-- sustituir un equipo ya apuntado a la inscripción del año siguiente por el
-- id de la liga en curso— y `getFcpIdEquipo` (maybeSingle) fallaba: la
-- clasificación desaparecía. Aplicada en producción el 2026-09-26, tras
-- dejar una sola fila por equipo.
create unique index if not exists fcp_team_links_team_unique
  on public.fcp_team_links (team_id);
