-- ═══════════════════════════════════════════════════════════════════════════
-- F0 · PUENTE FEDERACIÓN CÁNTABRA (FCP) → TACTIUM
-- ═══════════════════════════════════════════════════════════════════════════
-- Crea en el Supabase de TACTIUM las tablas fcp_* que alimenta el agente
-- SERVER4PADEL/agente-federacion-cantabra.js (Railway) en modo doble destino,
-- más las tablas puente propias de TACTIUM (links y snapshots).
--
-- Cómo aplicar: Supabase Dashboard → SQL Editor → pegar y ejecutar.
--   (o `supabase db push` si usas CLI con esta migración en supabase/migrations/)
--
-- Después, en Railway (proyecto SERVER4PADEL → Variables):
--   TACTIUM_SUPABASE_URL         = https://<proyecto-tactium>.supabase.co
--   TACTIUM_SUPABASE_SERVICE_KEY = <service_role key>   (Settings → API)
--
-- Idempotente: todo es IF NOT EXISTS; se puede re-ejecutar sin peligro.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1 · CATÁLOGO FEDERATIVO (espejo de lo que escribe el agente) ──────────

CREATE TABLE IF NOT EXISTS fcp_ligas (
  id_liga      INTEGER PRIMARY KEY,          -- id de la web FCP (Liga 2026 = 28074)
  nombre       TEXT,
  categoria    TEXT,
  genero       TEXT,
  temporada    TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fcp_grupos (
  id_grupo     TEXT PRIMARY KEY,             -- id compuesto (grupo FCP + fase)
  id_liga      INTEGER,
  nombre       TEXT,                          -- "1ª CATEGORIA MASCULINA - GRUPO A [Liga Oro]"
  genero       TEXT,                          -- M | F
  temporada    TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fcp_clasificacion (
  id           BIGSERIAL PRIMARY KEY,
  id_liga      INTEGER,
  id_grupo     TEXT,
  posicion     INTEGER,
  id_equipo    INTEGER,                       -- IdEquipo de la web FCP
  equipo       TEXT,
  enf          INTEGER,                       -- enfrentamientos disputados
  puntos       INTEGER,                       -- puntos ganados
  pj           INTEGER,                       -- partidos disputados
  pg           INTEGER,                       -- partidos ganados
  sets_favor   INTEGER,
  sets_contra  INTEGER,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (id_grupo, equipo)
);

CREATE TABLE IF NOT EXISTS fcp_partidos (
  id_partido       TEXT PRIMARY KEY,          -- fcp_<liga>_<grupo>_<n>
  id_liga          INTEGER,
  id_grupo         TEXT,
  equipo_local     TEXT,
  equipo_visit     TEXT,
  resultado        TEXT,                      -- "4-1"
  ganador          TEXT,                      -- local | visitante | empate
  estado           TEXT,                      -- jugado | programado | pendiente
  jornada          INTEGER,
  fecha            DATE,
  hora             TEXT,
  lugar            TEXT,
  orden_tandas     TEXT,
  fecha_rango      TEXT,                      -- texto rico de la FCP ("10 Abr 20:30…")
  -- columnas de playoff / fases (Oro, Plata, Bronce, Descenso)
  tipo             TEXT DEFAULT 'liga_regular',
  fase_nombre      TEXT,
  ronda            TEXT,
  cuadro           TEXT,
  posicion_bracket INTEGER,
  avance           INTEGER,
  resultado_ida    TEXT,
  resultado_vuelta TEXT,
  fecha_ida        TEXT,
  fecha_vuelta     TEXT,
  lugar_ida        TEXT,
  lugar_vuelta     TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fcp_jugadores (
  id_jugador    TEXT PRIMARY KEY,             -- fcp_<idEquipo>_<slug nombre>
  nombre        TEXT,                          -- "FERNANDEZ SOTA, Miguel Angel"
  apellido1     TEXT,
  apellido2     TEXT,
  nombre_pila   TEXT,
  categoria     TEXT,                          -- ABS | INF | …
  puntos        INTEGER DEFAULT 0,             -- puntos según plantilla del equipo
  id_equipo     INTEGER,
  nombre_equipo TEXT,
  id_liga       INTEGER,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fcp_rankings (
  id_jugador  TEXT PRIMARY KEY,               -- fcp_player_<idFcp>_<categoria>
  id_fcp      INTEGER,                         -- ⭐ id ESTABLE de jugador (Historico_Liga?Id=X)
  posicion    INTEGER,
  nombre      TEXT,
  modalidad   TEXT,                            -- ABSOLUTO | MENORES | VETERANOS
  categoria   TEXT,                            -- "RANKING LIGA MASCULINO", "1ª CATEGORIA…"
  puntos      NUMERIC,
  updated_at  TIMESTAMPTZ DEFAULT now()
);


-- ─── 2 · NUEVAS TABLAS F0 (solo TACTIUM) ───────────────────────────────────

-- Historia diaria de rankings → gráfica de evolución de puntos.
-- La escribe el agente tras cada sync de rankings (martes 10:00/15:00).
CREATE TABLE IF NOT EXISTS fcp_ranking_snapshots (
  id_jugador    TEXT NOT NULL,
  id_fcp        INTEGER,
  categoria     TEXT,
  modalidad     TEXT,
  posicion      INTEGER,
  puntos        NUMERIC,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (id_jugador, snapshot_date)
);

-- Puente de identidad: jugador federativo ↔ jugador/usuario TACTIUM.
-- FKs "lógicas" (sin REFERENCES) a propósito: no acopla la migración a los
-- nombres exactos de tus tablas de equipo/jugador. Añadir FK después si quieres.
CREATE TABLE IF NOT EXISTS fcp_player_links (
  id             BIGSERIAL PRIMARY KEY,
  fcp_id_jugador TEXT NOT NULL,               -- → fcp_jugadores.id_jugador
  fcp_id_fcp     INTEGER,                     -- → fcp_rankings.id_fcp (si se conoce)
  user_id        UUID,                        -- usuario TACTIUM que reclamó la ficha
  player_id      UUID,                        -- jugador de plantilla TACTIUM
  team_id        UUID,                        -- equipo TACTIUM
  confidence     TEXT NOT NULL DEFAULT 'auto' CHECK (confidence IN ('auto','confirmed')),
  linked_by      UUID,
  linked_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (fcp_id_jugador, team_id)
);

-- Puente equipo federativo ↔ equipo/club TACTIUM (se rellena en el onboarding F1).
CREATE TABLE IF NOT EXISTS fcp_team_links (
  fcp_id_equipo INTEGER NOT NULL,             -- → fcp_clasificacion.id_equipo / fcp_jugadores.id_equipo
  team_id       UUID NOT NULL,                -- equipo TACTIUM
  club_id       UUID,                         -- club TACTIUM
  linked_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (fcp_id_equipo, team_id)
);


-- ─── 3 · ÍNDICES ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fcp_grupos_liga          ON fcp_grupos (id_liga);
CREATE INDEX IF NOT EXISTS idx_fcp_clasif_grupo         ON fcp_clasificacion (id_grupo);
CREATE INDEX IF NOT EXISTS idx_fcp_partidos_grupo       ON fcp_partidos (id_grupo);
CREATE INDEX IF NOT EXISTS idx_fcp_partidos_liga_estado ON fcp_partidos (id_liga, estado);
CREATE INDEX IF NOT EXISTS idx_fcp_partidos_jornada     ON fcp_partidos (id_grupo, jornada);
CREATE INDEX IF NOT EXISTS idx_fcp_jugadores_equipo     ON fcp_jugadores (id_equipo);
CREATE INDEX IF NOT EXISTS idx_fcp_jugadores_nombre     ON fcp_jugadores (nombre);
CREATE INDEX IF NOT EXISTS idx_fcp_rankings_idfcp       ON fcp_rankings (id_fcp);
CREATE INDEX IF NOT EXISTS idx_fcp_rankings_categoria   ON fcp_rankings (categoria, posicion);
CREATE INDEX IF NOT EXISTS idx_fcp_rankings_nombre      ON fcp_rankings (nombre);
CREATE INDEX IF NOT EXISTS idx_fcp_snapshots_fecha      ON fcp_ranking_snapshots (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fcp_snapshots_idfcp      ON fcp_ranking_snapshots (id_fcp, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fcp_plinks_team          ON fcp_player_links (team_id);
CREATE INDEX IF NOT EXISTS idx_fcp_plinks_user          ON fcp_player_links (user_id);


-- ─── 4 · RLS ───────────────────────────────────────────────────────────────
-- Catálogo federativo: lectura para cualquier usuario autenticado de la app.
-- Escritura: SOLO el agente (service_role, que salta RLS) → sin policies de write.

ALTER TABLE fcp_ligas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_grupos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_clasificacion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_partidos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_jugadores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_rankings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_player_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcp_team_links        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fcp_ligas','fcp_grupos','fcp_clasificacion','fcp_partidos',
    'fcp_jugadores','fcp_rankings','fcp_ranking_snapshots'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
        t || '_read', t
      );
    END IF;
  END LOOP;
END $$;

-- Links: leer cualquiera autenticado; crear/editar solo quien firma el link.
-- (El volcado masivo del onboarding puede ir vía RPC security definer en F1.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fcp_player_links' AND policyname='fcp_player_links_read') THEN
    CREATE POLICY fcp_player_links_read   ON fcp_player_links FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fcp_player_links' AND policyname='fcp_player_links_insert') THEN
    CREATE POLICY fcp_player_links_insert ON fcp_player_links FOR INSERT TO authenticated WITH CHECK (linked_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fcp_player_links' AND policyname='fcp_player_links_update') THEN
    CREATE POLICY fcp_player_links_update ON fcp_player_links FOR UPDATE TO authenticated USING (linked_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fcp_team_links' AND policyname='fcp_team_links_read') THEN
    CREATE POLICY fcp_team_links_read     ON fcp_team_links FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fcp_team_links' AND policyname='fcp_team_links_insert') THEN
    CREATE POLICY fcp_team_links_insert   ON fcp_team_links FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación rápida tras el primer sync (SQL Editor):
--   SELECT count(*) FROM fcp_rankings;                          -- ~8-10k
--   SELECT count(*) FROM fcp_jugadores;                         -- plantillas
--   SELECT * FROM fcp_clasificacion WHERE id_grupo LIKE '%31249%' ORDER BY posicion;
--   SELECT snapshot_date, count(*) FROM fcp_ranking_snapshots GROUP BY 1;
-- ═══════════════════════════════════════════════════════════════════════════
