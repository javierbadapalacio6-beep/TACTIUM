-- LOS PLAYOFF, EN EL HORARIO.
--
-- Hasta ahora las eliminatorias solo existían en la vista del cuadro (lectura,
-- datos de la Federación): `select count(*) from matchdays where fcp_id_partido
-- like 'fcp_playoff_%'` daba CERO. Por eso al club le resultaba imposible
-- cuadrar las pistas del playoff: esos partidos no estaban en su horario.
--
-- Ahora se vuelcan como jornadas normales. Y con la sede marcada como PROPUESTA,
-- no como dato, por lo que cuenta el club: la Federación no lo presenta claro.
-- La propuesta sale de la normativa de la Liga Cántabra, no de inventarla:
--
--   «Todos los enfrentamientos del Play Off se disputarán a ida y vuelta,
--    jugando el primero en casa del equipo PEOR clasificado»
--
-- es decir, IDA en casa del peor clasificado y VUELTA en casa del mejor. Con
-- excepciones que también están escritas (finales de ORO y PLATA a SEDE ÚNICA;
-- en 5ª y 6ª masculina, ronda única en casa del MEJOR clasificado), así que la
-- app propone y el club corrige. De ahí esta columna.

alter table public.matchdays
  add column if not exists home_unconfirmed boolean not null default false;

comment on column public.matchdays.home_unconfirmed is
  'La sede es una PROPUESTA (típico de playoff: la Federación no la publica de forma fiable). El club o el capitán la confirman y esto pasa a false.';

-- Índice parcial: son cuatro filas por temporada, pero la pantalla de horarios
-- las busca en cada carga para pintarlas distinto.
create index if not exists matchdays_home_unconfirmed_idx
  on public.matchdays (season_id)
  where home_unconfirmed;
