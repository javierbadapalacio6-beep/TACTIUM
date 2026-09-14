-- Equipos inscritos en una liga de la Federación que TODAVÍA no ha empezado.
--
-- Entre que la FCP abre las inscripciones y publica el calendario pasan meses.
-- En ese hueco la liga existe y tiene equipos apuntándose, pero no hay ni
-- clasificación ni partidos, así que no cabe en `fcp_clasificacion` (que es la
-- tabla de clasificaciones y de la que leen el buscador y el alta de clubes).
-- De ahí una tabla aparte: lo que hay aquí es una lista de inscripción, no una
-- competición.
--
-- Sale de `Liga_ListadoEquipos`, una página distinta a las que raspa el agente
-- para las ligas en juego, y trae algo que no está en ningún otro sitio: si el
-- equipo está CONFIRMADO o solo apuntado. Para un gestor de club eso es lo
-- primero que quiere saber cuando se acerca el cierre de inscripción.

create table if not exists public.fcp_inscripciones (
  id_liga    integer     not null,
  id_grupo   text        not null,
  id_equipo  integer     not null,
  equipo     text,
  -- El número de orden de la lista, tal y como lo enseña la Federación.
  num        integer,
  -- «revisado» = confirmado; «engranaje» = pendiente de confirmar.
  confirmado boolean     not null default false,
  genero     text,
  updated_at timestamptz not null default now(),
  primary key (id_liga, id_grupo, id_equipo)
);

create index if not exists fcp_inscripciones_liga_idx  on public.fcp_inscripciones (id_liga);
create index if not exists fcp_inscripciones_equipo_idx on public.fcp_inscripciones (id_equipo);

alter table public.fcp_inscripciones enable row level security;

-- Lectura pública, igual que el resto de tablas espejo de la Federación: es
-- información que la FCP ya publica abierta en su web.
drop policy if exists fcp_inscripciones_read on public.fcp_inscripciones;
create policy fcp_inscripciones_read
  on public.fcp_inscripciones
  for select
  to authenticated, anon
  using (true);

comment on table public.fcp_inscripciones is
  'Equipos apuntados a una liga FCP aún sin calendario, con su marca de confirmado. Espejo de Liga_ListadoEquipos.';
