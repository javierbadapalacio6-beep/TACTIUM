-- Circuitos de la Federación Cántabra de Pádel (absoluto + Master), recopilados por
-- TACTIUM/scripts/fcp-circuito/recopilar.mjs.
--
-- PRIVADAS hasta tener autorización de la FCP: RLS activada y SIN ninguna política,
-- así que anon y authenticated no leen ni escriben nada. Solo el service_role (que se
-- salta la RLS) accede. Además se revocan los privilegios de tabla a anon/authenticated.
--
-- Fuera de alcance a propósito: el circuito de MENORES y su ranking (datos de niños).

create table if not exists public.fcp_circuito_torneos (
  id_torneo      integer primary key,           -- id de Torneo_previo?id=N
  anio           smallint not null,
  nombre         text not null,
  modalidad      text not null,                 -- 'ABSOLUTO' | 'MASTER'
  estado         text,                          -- 'En Juego' | 'Torneo Finalizado' | …
  fecha_inicio   date,
  fecha_fin      date,
  sede           text,                          -- de /Calendario («ZINK PADEL / G6 RAOS»)
  sedes_orden    text[],                        -- lugares distintos del orden de juego
  cartel_url     text,
  pagina_destino text,                          -- Torneo-Cuadros-Absoluto | Torneo-Info
  n_cuadros      integer,
  updated_at     timestamptz not null default now()
);

create table if not exists public.fcp_circuito_cuadros (
  id_cuadro      text primary key,              -- <torneo>_<genero>_<nivel>_<cuadro>
  id_torneo      integer not null references public.fcp_circuito_torneos(id_torneo) on delete cascade,
  genero         text not null,                 -- M | F | X
  nivel          smallint not null,             -- 1..6 · 21 = previa
  cuadro_param   text not null,                 -- Final | GrupoA | GrupoB | Liguilla
  etiqueta       text,                          -- texto del enlace («Previa Grupo A»)
  plantilla      text,                          -- Cuadro16cc, Liguilla4, … (null si 403)
  tipo           text,                          -- eliminatoria | previa | liguilla
  estado         text not null,                 -- ok | sin_plantilla_403 | vacio | error
  http_status    integer,
  url            text,
  campeon        text,
  finalista      text,
  campeon_consolacion text,
  n_partidos     integer,
  updated_at     timestamptz not null default now()
);
create index if not exists fcp_circuito_cuadros_torneo_idx on public.fcp_circuito_cuadros(id_torneo);

create table if not exists public.fcp_circuito_inscritos (
  id_torneo      integer not null references public.fcp_circuito_torneos(id_torneo) on delete cascade,
  genero         text not null,
  nivel          smallint not null,
  num            integer not null,
  categoria      text,                          -- «1ª CATEGORÍA MASCULINA»
  fecha_inscripcion date,
  pareja         text not null,                 -- «APELLIDO, NOMBRE - APELLIDO, NOMBRE»
  puntos         integer,
  j1_nombre      text, j1_apellido text, j1_licencia integer, j1_cruce text,
  j2_nombre      text, j2_apellido text, j2_licencia integer, j2_cruce text,
  updated_at     timestamptz not null default now(),
  primary key (id_torneo, genero, nivel, num)
);

create table if not exists public.fcp_circuito_partidos (
  id_partido     text primary key,              -- <id_cuadro>_<fase>_<ronda_idx>_<orden>
  id_cuadro      text not null references public.fcp_circuito_cuadros(id_cuadro) on delete cascade,
  id_torneo      integer not null,
  fase           text not null,                 -- principal | consolacion | liguilla
  ronda          text,                          -- cabecera de la columna («Cuartos», «Final C.», «Partido 2»)
  ronda_idx      smallint,                      -- 1 = primera ronda de esa fase
  orden          smallint,
  pareja1        text,                          -- nombre abreviado tal cual («MARCO REMOLINA P. - ALEX BLANCO S.»)
  pareja2        text,
  ganador        smallint,                      -- 1 | 2 | null (pendiente o no deducible)
  resultado      text,                          -- tal cual («6/7-7/6-6/3», «W.O.», «6/2-5/2 y lesión»)
  sets           jsonb,                         -- [[j_p1, j_p2], …] desde el punto de vista de pareja1
  walkover       boolean not null default false,
  retirada       boolean not null default false,
  programado     text,                          -- «MONTEVERDE-Jueves 8 Octubre - 18:00» si aún no se ha jugado
  estado         text not null,                 -- jugado | pendiente | bye
  p1_j1 text, p1_j1_licencia integer, p1_j1_cruce text,
  p1_j2 text, p1_j2_licencia integer, p1_j2_cruce text,
  p2_j1 text, p2_j1_licencia integer, p2_j1_cruce text,
  p2_j2 text, p2_j2_licencia integer, p2_j2_cruce text,
  updated_at     timestamptz not null default now()
);
create index if not exists fcp_circuito_partidos_torneo_idx on public.fcp_circuito_partidos(id_torneo);
create index if not exists fcp_circuito_partidos_cuadro_idx on public.fcp_circuito_partidos(id_cuadro);

create table if not exists public.fcp_circuito_grupos_clasif (
  id_cuadro      text not null references public.fcp_circuito_cuadros(id_cuadro) on delete cascade,
  posicion       smallint not null,
  pareja         text not null,
  puntos         integer, pg integer, pp integer, sg integer, sp integer, dif_sets integer,
  jg integer, jp integer, dif_juegos integer,
  updated_at     timestamptz not null default now(),
  primary key (id_cuadro, posicion)
);

create table if not exists public.fcp_circuito_orden_juego (
  id_torneo      integer not null references public.fcp_circuito_torneos(id_torneo) on delete cascade,
  seq            integer not null,              -- orden de aparición en la página
  fecha          date,
  lugar          text, hora text, categoria text, cuadro text, genero text,
  pareja1        text, pareja2 text, resultado text,
  updated_at     timestamptz not null default now(),
  primary key (id_torneo, seq)
);

-- Ranking del circuito: una fila por jugador y ranking en la fecha de la foto.
-- rnk 114–129 = ranking por categoría (suma de las 5 mejores pruebas);
-- rnk 125/126 = ranking absoluto (trae la licencia en el enlace Historico_Liga?Id=).
create table if not exists public.fcp_circuito_ranking (
  fecha          date not null,
  rnk            smallint not null,
  ranking        text not null,
  genero         text,
  posicion       integer not null,
  nombre         text not null,                 -- «NOMBRE APELLIDO1 APELLIDO2» tal cual
  licencia       integer,
  cruce          text,                          -- enlace | nombre_unico | ambiguo | sin_cruce
  puntos         integer,
  updated_at     timestamptz not null default now(),
  primary key (fecha, rnk, posicion, nombre)
);

create table if not exists public.fcp_circuito_ranking_detalle (
  fecha          date not null,
  rnk            smallint not null,
  posicion       integer not null,
  nombre         text not null,
  col            smallint not null,             -- columna de la matriz (1..n)
  prueba         text not null,                 -- cabecera de la columna
  id_torneo      integer,                       -- cruce por nombre con fcp_circuito_torneos
  puntos         integer,                       -- null = «-» (no jugó)
  primary key (fecha, rnk, posicion, nombre, col)
);

create table if not exists public.fcp_circuito_licencias (
  licencia       integer primary key,
  nombre_completo text not null,                -- «APELLIDO1 APELLIDO2, NOMBRE»
  apellidos      text,
  nombre         text,
  genero         text,                          -- M | F (de la búsqueda por género)
  categoria      text,                          -- «4ª CATEGORIA»
  nivel          smallint,
  updated_at     timestamptz not null default now()
);

-- Privacidad: RLS sin políticas + sin privilegios para los roles del cliente.
do $$
declare t text;
begin
  foreach t in array array['fcp_circuito_torneos','fcp_circuito_cuadros','fcp_circuito_inscritos',
    'fcp_circuito_partidos','fcp_circuito_grupos_clasif','fcp_circuito_orden_juego',
    'fcp_circuito_ranking','fcp_circuito_ranking_detalle','fcp_circuito_licencias']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format($c$comment on table public.%I is 'Privada hasta tener autorización de la FCP. Circuitos FCP (absoluto + Master) recopilados por TACTIUM/scripts/fcp-circuito. Sin políticas RLS: solo service_role.'$c$, t);
  end loop;
end $$;

-- Empates en las liguillas: la FCP repite la posición. La PK usa el orden de la fila y la
-- posición que enseña la web va aparte.
alter table public.fcp_circuito_grupos_clasif add column if not exists pos_mostrada smallint;
comment on column public.fcp_circuito_grupos_clasif.posicion is 'Orden de la fila en la tabla (1..n); los empates de la FCP repiten pos_mostrada';
