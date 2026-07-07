-- ════════════════════════════════════════════════════════════════════
-- Migración 2026-07-08 · Modo jugador suelto persistido en la cuenta
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- Idempotente.
--
-- PARA QUÉ: la elección "Juego por mi cuenta" (jugador sin equipo) se
-- guardaba solo en el dispositivo y se pierde al cerrar sesión. Con esta
-- columna la cuenta la recuerda en cualquier dispositivo: al iniciar
-- sesión sin equipos, la app entra directa al modo jugador en vez de
-- volver a preguntar el rol.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists solo_mode boolean not null default false;
