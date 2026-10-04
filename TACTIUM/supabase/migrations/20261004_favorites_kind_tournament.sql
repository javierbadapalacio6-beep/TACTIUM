-- Seguir un torneo = favorito de tipo «tournament».
--
-- Los favoritos ya funcionan sin cuenta (viven en el dispositivo) y se suben al
-- iniciar sesión (ver TACTIUM/src/core/services/favorites.ts). Para seguir un
-- torneo solo hace falta que la tabla admita el tipo nuevo; `ref_id` guarda el
-- uuid del torneo como texto.
--
-- Mientras esta migración NO esté aplicada, la app y la web guardan el torneo
-- seguido solo en local: el upsert del servidor falla por el check y se ignora
-- (el resto de favoritos se sigue sincronizando aparte).
--
-- APLICADA en producción el 2026-10-04.

alter table public.favorites
  drop constraint if exists favorites_kind_check;

alter table public.favorites
  add constraint favorites_kind_check
  check (kind in ('team', 'player', 'federation', 'tournament'));
