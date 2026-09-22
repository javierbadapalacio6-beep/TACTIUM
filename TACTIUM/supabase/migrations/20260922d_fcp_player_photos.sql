-- Las fotos de la Federación son SUYAS, no las de los perfiles.
--
-- Corrección sobre 20260922 y 20260922c: aquellas versiones sacaban la cara
-- de `profiles.avatar_url`, y esas fotos —las que sube cada usuario o cada
-- club para su equipo— son PRIVADAS. Las de los jugadores federados las
-- carga Javier a mano, poco a poco, y viven aquí.
--
-- Consecuencia buena: ni `fcp_player_avatars` ni `fcp_ranking_identities`
-- vuelven a tocar `profiles`, así que dejan de necesitar `SECURITY
-- DEFINER`. Pasan a `SECURITY INVOKER` sobre tablas ya públicas: cero
-- privilegio elevado y cero fuga posible.

create table if not exists public.fcp_player_photos (
  id_jugador text primary key,
  photo_url  text not null,
  updated_at timestamptz not null default now()
);

comment on table public.fcp_player_photos is
  'Fotos de jugadores federados, cargadas a mano. NO son los avatares de `profiles`, que son privados.';

alter table public.fcp_player_photos enable row level security;

-- Lectura abierta: las pantallas de Federación se ven sin sesión.
-- Escritura: ninguna política, así que sólo `service_role` (o el editor
-- SQL) puede cargarlas. Es lo que queremos — las sube Javier.
drop policy if exists fcp_player_photos_read on public.fcp_player_photos;
create policy fcp_player_photos_read
  on public.fcp_player_photos
  for select to anon, authenticated
  using (true);

-- ── Los dos RPC, ahora sin privilegio elevado ─────────────────────────

create or replace function public.fcp_player_avatars(p_ids text[])
returns table (fcp_id_jugador text, avatar_url text)
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(array_length(p_ids, 1), 0) > 300 then
    raise exception 'Demasiadas fichas en una sola consulta (max. 300)'
      using errcode = 'program_limit_exceeded';
  end if;

  -- Una persona tiene una ficha por equipo y temporada. La foto va con la
  -- PERSONA, así que vale la de cualquier ficha con su mismo nombre,
  -- prefiriendo la exacta.
  return query
  with pedidas as (
    select j.id_jugador as pedida,
           public.fcp_norm_name(
             coalesce(j.nombre_pila, '') || ' ' || coalesce(j.apellido1, '') || ' ' || coalesce(j.apellido2, '')
           ) as k
      from public.fcp_jugadores j
     where j.id_jugador = any (p_ids)
  ),
  hermanas as (
    select d.pedida, j2.id_jugador as otra
      from pedidas d
      join public.fcp_jugadores j2
        on public.fcp_norm_name(
             coalesce(j2.nombre_pila, '') || ' ' || coalesce(j2.apellido1, '') || ' ' || coalesce(j2.apellido2, '')
           ) = d.k
  )
  select distinct on (h.pedida) h.pedida, ph.photo_url
    from hermanas h
    join public.fcp_player_photos ph on ph.id_jugador = h.otra
   order by h.pedida, (h.otra = h.pedida) desc;
end;
$function$;

create or replace function public.fcp_ranking_identities(p_nombres text[])
returns table (nombre text, id_jugador text, avatar_url text)
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(array_length(p_nombres, 1), 0) > 300 then
    raise exception 'Demasiados nombres en una sola consulta (max. 300)'
      using errcode = 'program_limit_exceeded';
  end if;

  return query
  with pedidos as (
    select distinct n as pedido, public.fcp_norm_name(n) as k
      from unnest(p_nombres) n
     where n is not null and trim(n) <> ''
  ),
  fichas as (
    select p.pedido as pedido, p.k as k, j.id_jugador as ficha, j.puntos as puntos
      from pedidos p
      join public.fcp_jugadores j
        on public.fcp_norm_name(
             coalesce(j.nombre_pila, '') || ' ' || coalesce(j.apellido1, '') || ' ' || coalesce(j.apellido2, '')
           ) = p.k
  ),
  elegida as (
    select distinct on (f.k) f.k as k, f.pedido as pedido, f.ficha as ficha
      from fichas f
     order by f.k, f.puntos desc nulls last
  ),
  foto as (
    select distinct on (f2.k) f2.k as k, ph.photo_url as url
      from fichas f2
      join public.fcp_player_photos ph on ph.id_jugador = f2.ficha
     order by f2.k, f2.puntos desc nulls last
  )
  select e.pedido, e.ficha, foto.url
    from elegida e
    left join foto on foto.k = e.k;
end;
$function$;

revoke execute on function public.fcp_player_avatars(text[]) from public;
revoke execute on function public.fcp_ranking_identities(text[]) from public;
grant  execute on function public.fcp_player_avatars(text[]) to anon, authenticated;
grant  execute on function public.fcp_ranking_identities(text[]) to anon, authenticated;
