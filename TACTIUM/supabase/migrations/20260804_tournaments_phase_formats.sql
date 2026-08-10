-- Formato de partido POR CUADRO (feedback Smash): la consolación se suele
-- jugar más corta (p. ej. 2 sets + super TB) que el cuadro principal, y el
-- formato puede variar entre grupos y eliminatorias.
--
-- Se guarda un override por CUADRO sobre el `match_format` global del torneo.
-- Claves: 'main' (principal / oro-plata-bronce), 'consol' (consolación),
-- 'groups' (fase de grupos / liga). Cada valor es un MatchFormat
-- (bo3_stb | bo3_full | bo1). Vacío = todos los cuadros usan match_format.
alter table public.tournaments
  add column if not exists phase_formats jsonb not null default '{}'::jsonb;

comment on column public.tournaments.phase_formats is
  'Formato de partido por CUADRO (override de match_format). Claves: main | consol | groups -> MatchFormat (bo3_stb|bo3_full|bo1). Vacio = usar match_format para todos los cuadros.';
