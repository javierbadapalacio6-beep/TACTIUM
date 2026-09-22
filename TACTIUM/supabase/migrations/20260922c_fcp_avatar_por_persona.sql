-- La foto sigue a la PERSONA, no a la ficha.
--
-- Un jugador tiene una ficha por equipo y temporada (Gartzen Otaola tiene
-- `fcp_157793_…` y `fcp_162748_…`). Al vincular su cuenta eligió una, pero
-- las pantallas resuelven por nombre y se quedan con la de más puntos, que
-- puede ser otra: el enlace iba bien y la cara no salía.
--
-- Los dos RPC pasan a buscar la foto en CUALQUIER ficha del mismo nombre,
-- prefiriendo la exacta. Riesgo asumido: dos personas con nombre y dos
-- apellidos idénticos compartirían cara. Es raro, y la alternativa era que
-- la foto no se viera casi nunca.

create or replace function public.fcp_ranking_identities(p_nombres text[])
returns table (nombre text, id_jugador text, avatar_url text)
language plpgsql
stable
security definer
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
  -- Todo con alias: `id_jugador` y `avatar_url` son tambien los parametros
  -- de salida de la funcion, y sin cualificar Postgres no sabe a cual te
  -- refieres («column reference is ambiguous»).
  fichas as (
    select p.pedido as pedido, p.k as k, j.id_jugador as ficha, j.puntos as puntos
      from pedidos p
      join public.fcp_jugadores j
        on public.fcp_norm_name(
             coalesce(j.nombre_pila, '') || ' ' || coalesce(j.apellido1, '') || ' ' || coalesce(j.apellido2, '')
           ) = p.k
  ),
  -- A la que se enlaza: la de más puntos, que es la de la temporada viva.
  elegida as (
    select distinct on (f.k) f.k as k, f.pedido as pedido, f.ficha as ficha
      from fichas f
     order by f.k, f.puntos desc nulls last
  ),
  -- La cara: de cualquier ficha de esa persona que tenga cuenta vinculada.
  foto as (
    select distinct on (f2.k) f2.k as k, pr.avatar_url as url
      from fichas f2
      join public.profiles pr on pr.fcp_id_jugador = f2.ficha
     where pr.avatar_url is not null
     order by f2.k, f2.puntos desc nulls last
  )
  select e.pedido, e.ficha, foto.url
    from elegida e
    left join foto on foto.k = e.k;
end;
$function$;

create or replace function public.fcp_player_avatars(p_ids text[])
returns table (fcp_id_jugador text, avatar_url text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(array_length(p_ids, 1), 0) > 300 then
    raise exception 'Demasiadas fichas en una sola consulta (max. 300)'
      using errcode = 'program_limit_exceeded';
  end if;

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
  select distinct on (h.pedida) h.pedida, pr.avatar_url
    from hermanas h
    join public.profiles pr on pr.fcp_id_jugador = h.otra
   where pr.avatar_url is not null
   -- La ficha exacta manda sobre una hermana de otra temporada.
   order by h.pedida, (h.otra = h.pedida) desc;
end;
$function$;
