-- Modo "solo torneos" para un club.
--
-- Un usuario puede crear una cuenta cuyo único objetivo es ORGANIZAR TORNEOS,
-- sin gestionar equipos de liga. Como los torneos cuelgan de un club
-- (tournaments.club_id), ese usuario crea igualmente un club, pero marcado con
-- `tournaments_only = true`: la app le enseña un menú recortado (solo Torneos +
-- Perfil) hasta que decida desbloquear la gestión de equipos.
--
-- Aditiva y con default: los clubes existentes quedan en `false` (menú completo
-- de siempre), así que no cambia nada para nadie ya creado.
alter table public.clubs
  add column if not exists tournaments_only boolean not null default false;

comment on column public.clubs.tournaments_only is
  'true = club creado en modo "solo torneos": la app muestra menú recortado (Torneos + Perfil) hasta que el owner desbloquea la gestión de equipos.';
