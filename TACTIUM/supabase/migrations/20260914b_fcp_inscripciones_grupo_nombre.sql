-- La categoría en la que se inscribe el equipo.
--
-- Se guarda aquí y no se deriva de `fcp_grupos` porque esa tabla no tiene
-- (todavía) los grupos de la liga nueva: en cuanto los tuviera, la app ofrecería
-- esa temporada en el selector y sería una temporada vacía que se puede abrir.
alter table public.fcp_inscripciones
  add column if not exists grupo_nombre text;

comment on column public.fcp_inscripciones.grupo_nombre is
  'Nombre de la categoría tal y como la publica la FCP, p.ej. "3ª CATEGORIA MASCULINA".';
