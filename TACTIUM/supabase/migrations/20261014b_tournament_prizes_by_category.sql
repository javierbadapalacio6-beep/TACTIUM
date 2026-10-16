-- Premios POR CATEGORÍA. Un torneo puede tener varias categorías (3ª, 4ª…) y hasta ahora solo había una lista de
-- premios para todo el torneo (`prizes_json`). Esta columna guarda, por categoría, su propia lista:
--   { "3ª": [ { "place": "1º", "items": [ { "type": "metalico", "amount": 300 } ] } ], "4ª": [ … ] }
-- `prizes_json` pasa a ser el premio GENERAL: se enseña a las categorías que no tengan el suyo.
-- `public_get_tournament` devuelve `select *`, así que la columna llega sola a la ficha pública.
alter table public.tournaments add column if not exists prizes_by_category jsonb;
