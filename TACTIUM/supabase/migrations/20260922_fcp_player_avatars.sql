-- Caras en el acta de la Federación.
--
-- El acta de un partido enseña las dos parejas de cada punto, y queremos la
-- foto de cada jugador. El enganche ya existía —`profiles.fcp_id_jugador`
-- apunta a la ficha federativa— pero la RLS de `profiles` sólo deja ver la
-- propia y la de compañeros de equipo o club, así que en un grupo ajeno
-- salían todos con iniciales.
--
-- Este RPC devuelve SÓLO el par (ficha federativa → foto). Ni nombre, ni id
-- de usuario, ni nada más: lo mínimo para pintar el avatar. La foto ya es
-- pública por otra vía (`get_public_user_profile` la sirve por id de
-- usuario), y vincular la ficha federativa es un acto voluntario del
-- jugador, así que quien no la ha reclamado no aparece aquí.
--
-- Lectura abierta a `anon` a propósito: las pantallas de Federación se ven
-- sin sesión.

create or replace function public.fcp_player_avatars(p_ids text[])
returns table (fcp_id_jugador text, avatar_url text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Tope por llamada. No impide recorrer la tabla a base de llamadas —los
  -- ids federativos son públicos—, pero evita que un cliente se traiga el
  -- censo entero de una vez por descuido.
  if coalesce(array_length(p_ids, 1), 0) > 300 then
    raise exception 'Demasiadas fichas en una sola consulta (máx. 300)'
      using errcode = 'program_limit_exceeded';
  end if;

  return query
  select p.fcp_id_jugador, p.avatar_url
    from public.profiles p
   where p.fcp_id_jugador = any (p_ids)
     and p.avatar_url is not null;
end;
$function$;

revoke execute on function public.fcp_player_avatars(text[]) from public;
grant  execute on function public.fcp_player_avatars(text[]) to anon, authenticated;
