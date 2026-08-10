-- Precio variable por nº de categorías (feedback Smash): inscribirse en 2
-- categorías cuesta un total distinto (normalmente con descuento) que 2×1.
-- Ej. cartel Smash: 1 categoría 22€, 2 categorías 35€.
alter table public.tournaments
  add column if not exists entry_fee_2 numeric;

comment on column public.tournaments.entry_fee_2 is
  'Cuota TOTAL si el jugador se inscribe en 2 categorias (feedback Smash: 1 cat 22EUR, 2 cats 35EUR). NULL = no hay precio especial para 2 (se usa entry_fee x2 o no se ofrece).';
