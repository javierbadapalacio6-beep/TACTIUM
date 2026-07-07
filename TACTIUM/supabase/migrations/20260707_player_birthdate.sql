-- ════════════════════════════════════════════════════════════════════
-- Migración 2026-07-07 · players.birthdate
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- Es idempotente: se puede ejecutar dos veces sin romper nada.
--
-- CONTEXTO (sondeo del 7-jul-2026 contra producción):
--   ✓ casual_matches / casual_match_participants   YA EXISTEN
--   ✓ create_casual_match (RPC)                    YA EXISTE
--   ✓ lectura de amistosos                         RLS ya lo permite
--   ✗ players.birthdate                            FALTA → esta migración
--
-- PARA QUÉ: validación de edad en SNP Seniors (jugador ≥40 años y
-- cada pareja debe sumar ≥90 años entre ambos — normativa 2025-26,
-- ver docs/formatos-snp-verificados.md). Columna opcional: solo se
-- valida si hay datos.
-- ════════════════════════════════════════════════════════════════════

alter table public.players
  add column if not exists birthdate date;

comment on column public.players.birthdate is
  'Fecha de nacimiento (opcional). Usada para validar restricciones de '
  'edad en competiciones tipo SNP Seniors (+40, pareja >= 90 años).';

-- Nota: tras aplicar, regenerar los tipos del cliente cuando toque:
--   npx supabase gen types typescript --project-id aabgnylvmntkzmgixlpe \
--     > src/core/supabase/database.types.ts
