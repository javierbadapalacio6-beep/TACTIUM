-- Del ranking a la ficha del jugador (y a su foto).
--
-- `fcp_rankings` NO trae el id real del jugador: su columna `id_jugador` es
-- una clave sintética de la propia fila («fcp_rank_2_categoria_masculina_
-- pos_1») y `id_fcp` está a null en las 8.361 filas. Lo único que comparten
-- ranking y censo es el NOMBRE, que en el ranking viene entero («ALBERTO
-- PEREZ GUERRERO») y en `fcp_jugadores` partido en pila/apellido1/apellido2.
--
-- De ahí este RPC: recibe los nombres de la página de ranking que se está
-- mirando y devuelve, para cada uno, su ficha y su foto. Cruzan 8.037 de
-- 8.361 (96%); el resto se queda sin enlace en vez de apuntar a la ficha
-- equivocada.
--
-- El mismo jugador tiene una ficha por equipo y temporada: se elige la de
-- más puntos, que es la de la temporada en curso.

-- Normalizador: mayúsculas, sin tildes y con los espacios colapsados.
-- IMMUTABLE para poder indexar por él.
create or replace function public.fcp_norm_name(p text)
returns text
language sql
immutable
parallel safe
set search_path to 'pg_catalog'
as $function$
  select trim(regexp_replace(
           upper(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑÀÈÌÒÙáéíóúüñàèìòù', 'AEIOUUNAEIOUaeiouunaeiou')),
           '\s+', ' ', 'g'));
$function$;

-- Sin esto, cada vista del ranking recorre las 32.707 fichas normalizando
-- al vuelo.
create index if not exists fcp_jugadores_nombre_norm_idx
  on public.fcp_jugadores (
    public.fcp_norm_name(
      coalesce(nombre_pila, '') || ' ' || coalesce(apellido1, '') || ' ' || coalesce(apellido2, '')
    )
  );

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
  fichas as (
    select distinct on (p.k) p.pedido, j.id_jugador
      from pedidos p
      join public.fcp_jugadores j
        on public.fcp_norm_name(
             coalesce(j.nombre_pila, '') || ' ' || coalesce(j.apellido1, '') || ' ' || coalesce(j.apellido2, '')
           ) = p.k
     order by p.k, j.puntos desc nulls last
  )
  select f.pedido, f.id_jugador, pr.avatar_url
    from fichas f
    left join public.profiles pr on pr.fcp_id_jugador = f.id_jugador;
end;
$function$;

revoke execute on function public.fcp_ranking_identities(text[]) from public;
grant  execute on function public.fcp_ranking_identities(text[]) to anon, authenticated;
