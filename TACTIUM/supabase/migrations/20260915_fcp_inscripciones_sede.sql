-- Sede del equipo inscrito y marca de cuándo se leyó su plantilla.
--
-- La sede la publica la ficha del equipo y no está en ninguna otra página.
-- Enlaza con los equipos invitados (`teams.venue_club_id`): dice quién va a
-- jugar en las pistas de quién la temporada que viene, antes de que empiece.
--
-- `plantilla_updated_at` se enseña en la app junto a los jugadores: la lista
-- cambia mientras dura la inscripción y conviene saber de cuándo es la foto.
alter table public.fcp_inscripciones
  add column if not exists sede text;
alter table public.fcp_inscripciones
  add column if not exists plantilla_updated_at timestamptz;

comment on column public.fcp_inscripciones.sede is
  'Club donde el equipo juega de local, según la ficha de la FCP.';
comment on column public.fcp_inscripciones.plantilla_updated_at is
  'Última vez que se volcó la plantilla de este equipo desde Liga_DetalleEquipo.';
