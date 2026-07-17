-- ─────────────────────────────────────────────────────────────────────────
-- Social (rama feature/perfiles-sociales): el nombre de usuario pasa a ser
-- ÚNICO (case-insensitive), para identidad social buscable sin ambigüedad.
-- Nullable sigue permitido (quien no lo pone, cae al full_name). El cliente
-- captura el 23505 y muestra "ese nombre ya está en uso".
--
-- Requiere que NO haya duplicados previos (verificado: 0). CÓMO APLICAR:
-- Supabase Dashboard → SQL Editor → pegar → Run. (Aplicada vía MCP 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

create unique index if not exists profiles_username_unique_ci
  on public.profiles (lower(btrim(username)))
  where username is not null and btrim(username) <> '';
