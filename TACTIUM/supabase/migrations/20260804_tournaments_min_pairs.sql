-- Mínimo de parejas por categoría (feedback Smash: un torneo con muy pocas
-- parejas por categoría "queda pobre"). El club fija un mínimo recomendado; al
-- generar el cuadro de una categoría con menos parejas, se avisa (no bloquea).
alter table public.tournaments
  add column if not exists min_pairs int;

comment on column public.tournaments.min_pairs is
  'Minimo de parejas (o jugadores en social) recomendado por categoria. Si una division tiene menos, se avisa al generar el cuadro. NULL = sin minimo.';
