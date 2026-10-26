-- Visitas a tactium.io/descargar (el QR de los carteles de los clubs).
--
-- La web llama a `log_download_visit` desde el servidor (lib/download-visits.ts) con el club
-- (`?club=smash`) y el sistema detectado. No se guarda IP, User-Agent ni nada personal: solo
-- fecha, club y plataforma. Mismo patrón que `availability_links`: tabla con RLS y sin grants,
-- solo se escribe por una RPC SECURITY DEFINER.

-- ── 1. Tabla ────────────────────────────────────────────────────────────────
create table if not exists public.download_visits (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- Slug del club tal como va en el QR; nulo si el enlace no traía club (o no era válido).
  club       text check (club is null or club ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  platform   text not null check (platform in ('ios', 'android', 'escritorio'))
);

create index if not exists download_visits_created_idx on public.download_visits (created_at desc);
create index if not exists download_visits_club_idx    on public.download_visits (club, created_at desc);

alter table public.download_visits enable row level security;
-- Sin policies a propósito: solo la RPC de abajo escribe; se lee con service role / SQL editor.
revoke all on table public.download_visits from public, anon, authenticated;

-- ── 2. RPC de registro ──────────────────────────────────────────────────────
-- Frena el abuso (la RPC es pública): como mucho 120 visitas por minuto en total; pasado eso
-- se descartan en silencio. Un evento real en un club queda muy por debajo.
create or replace function public.log_download_visit(p_club text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_platform is null or p_platform not in ('ios', 'android', 'escritorio') then
    return;
  end if;

  if (select count(*) from public.download_visits
       where created_at > now() - interval '1 minute') >= 120 then
    return;
  end if;

  insert into public.download_visits (club, platform)
  values (
    case when p_club ~ '^[a-z0-9][a-z0-9_-]{0,39}$' then p_club end,
    p_platform
  );
end $$;

revoke all on function public.log_download_visit(text, text) from public;
grant execute on function public.log_download_visit(text, text) to anon, authenticated;

-- ── 3. Cómo leerlo (SQL editor o execute_sql; no se aplica, es de consulta) ─
-- Visitas por club y sistema, últimos 30 días:
--   select coalesce(club, '(sin club)') as club, platform, count(*) as visitas
--     from public.download_visits
--    where created_at >= now() - interval '30 days'
--    group by 1, 2 order by 1, 2;
--
-- Por día:
--   select date_trunc('day', created_at)::date as dia, club, platform, count(*)
--     from public.download_visits group by 1, 2, 3 order by 1 desc, 2, 3;
