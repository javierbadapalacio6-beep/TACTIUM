-- ═════════════════════════════════════════════════════════════════════════
-- Actualización obligatoria (2026-10-24)
--
-- Una sola fila con el número de BUILD mínimo que puede usar la app en cada
-- tienda (el CFBundleVersion de iOS / el versionCode de Android). La app lo lee
-- al arrancar y al volver a primer plano: si su build es menor, enseña una
-- pantalla que solo deja ir a la tienda.
--
-- Se SUBE a mano cuando la versión nueva ya está aprobada y publicada en la
-- tienda, nunca antes (si no, se bloquearía a gente sin nada que descargar):
--   update public.app_config set ios_min_build = 36, android_min_build = 30 where id = 1;
-- 0 = no se exige nada. Sin migración de datos: arranca desactivado.
-- ═════════════════════════════════════════════════════════════════════════

create table if not exists public.app_config (
  id                int primary key default 1 check (id = 1),
  ios_min_build     int not null default 0 check (ios_min_build >= 0),
  android_min_build int not null default 0 check (android_min_build >= 0),
  updated_at        timestamptz not null default now()
);

insert into public.app_config (id) values (1) on conflict (id) do nothing;

-- Sin políticas: nadie la lee ni la escribe por la API; solo la RPC de abajo
-- (y el SQL del dueño del proyecto para cambiar los números).
alter table public.app_config enable row level security;

create or replace function public.get_app_min_build()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('ios', ios_min_build, 'android', android_min_build)
    from public.app_config where id = 1;
$$;

revoke all on function public.get_app_min_build() from public;
grant execute on function public.get_app_min_build() to anon, authenticated;
