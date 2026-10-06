-- Grupo dentro de la categoría y sede corta, para la liga en inscripción.
--
-- La web de la Federación lista los inscritos por CATEGORÍA («2ª CATEGORIA
-- MASCULINA», 32 equipos) y no dice en qué grupo cae cada uno hasta que publica
-- el calendario. Pero la FCP reparte antes un PDF con la distribución
-- («Liga_Cantabra_Padel_2026_2027.pdf»: equipos, sedes y grupos A-D), y con eso
-- cada equipo ya sabe contra quién juega semanas antes de la primera jornada.
--
-- Estas dos columnas se rellenan a mano desde ese PDF con
-- `scripts/fcp-grupos-pdf.py`. El agente NO las toca: su upsert solo manda las
-- columnas que raspa, así que sobreviven a cada pasada. Cuando la liga tenga
-- calendario, los grupos de verdad viven en `fcp_grupos` y esto deja de leerse.
alter table public.fcp_inscripciones
  add column if not exists subgrupo text;
alter table public.fcp_inscripciones
  add column if not exists sede_corta text;

comment on column public.fcp_inscripciones.subgrupo is
  'Grupo dentro de la categoría (A, B, C…) según el PDF de distribución de la FCP. Null hasta que se publica.';
comment on column public.fcp_inscripciones.sede_corta is
  'Nombre corto de la sede tal y como lo usa la FCP en el PDF de distribución («SMASH», «GO FIT»).';
