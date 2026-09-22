-- Lo que ha ganado en el año, junto al total — como en la app.
--
-- `fcp_historico` guarda la variación de puntos partido a partido
-- (`puntos_var`, con `anio`). La suma del año en curso es el delta que la
-- app enseña al lado del ranking, y aquí faltaba.
--
-- Se agrega sobre TODAS las fichas del mismo nombre: un jugador tiene una
-- ficha por equipo y temporada, y el histórico puede colgar de otra
-- distinta de la que elige el ranking.
--
-- OJO con la cobertura: hoy el scraper sólo ha traído histórico de 138
-- jugadores (1.561 filas, todas de 2026) sobre ~32.000 fichas. Quien no lo
-- tenga devuelve null y la pantalla no enseña delta, en vez de un +0 que
-- parecería «no ha ganado nada».

create or replace function public.fcp_ranking_identities(p_nombres text[])
returns table (nombre text, id_jugador text, avatar_url text, puntos_anio integer)
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
  ),
  -- Último año con histórico de esa persona, y lo ganado en él.
  anio_ult as (
    select f3.k as k, max(h.anio) as anio
      from fichas f3
      join public.fcp_historico h on h.id_jugador = f3.ficha
     group by f3.k
  ),
  delta as (
    select a.k as k, sum(h.puntos_var)::integer as var
      from anio_ult a
      join fichas f4 on f4.k = a.k
      join public.fcp_historico h
        on h.id_jugador = f4.ficha and h.anio = a.anio
     group by a.k
  )
  select e.pedido, e.ficha, foto.url, delta.var
    from elegida e
    left join foto  on foto.k  = e.k
    left join delta on delta.k = e.k;
end;
$function$;

revoke execute on function public.fcp_ranking_identities(text[]) from public;
grant  execute on function public.fcp_ranking_identities(text[]) to anon, authenticated;
