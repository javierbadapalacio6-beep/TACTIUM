-- Favoritos del usuario: equipos federados, jugadores y federaciones.
--
-- El flujo es "primero local, luego cuenta": se marcan sin registrarse (se
-- guardan en el dispositivo) y al iniciar sesión se suben aquí y se fusionan
-- con los que ya tuviera la cuenta. Por eso el insert es idempotente — se
-- reintenta la subida sin miedo a duplicar.
--
-- `ref_id` es texto a propósito: un equipo federado es un entero, un jugador
-- un id de la FCP y una federación un código como 'FCantP'. Una tabla por
-- tipo sería más pura y mucho más incómoda de leer para pintar una lista.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('team', 'player', 'federation')),
  ref_id text not null,
  -- Copia del nombre para poder pintar la lista sin ir a buscar cada ficha.
  -- Si el original cambia, se refresca al abrirla; no es fuente de verdad.
  label text,
  meta text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

-- Cada uno ve y gestiona SOLO los suyos. Sin política de lectura para otros:
-- a quién sigue alguien es cosa suya.
drop policy if exists favorites_own_select on public.favorites;
create policy favorites_own_select on public.favorites
  for select to authenticated using (user_id = auth.uid());

drop policy if exists favorites_own_insert on public.favorites;
create policy favorites_own_insert on public.favorites
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists favorites_own_delete on public.favorites;
create policy favorites_own_delete on public.favorites
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists favorites_own_update on public.favorites;
create policy favorites_own_update on public.favorites
  for update to authenticated using (user_id = auth.uid());
