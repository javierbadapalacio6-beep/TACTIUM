-- Franjas de juego por tipo de día (petición de Smash, 14-10-2026).
-- Hasta ahora un torneo tenía UNA ventana (start_time / end_time) para todos los días, con default 09:00–22:00: si el
-- club no la tocaba, el horario y la rejilla de inscripción ofrecían horas de madrugada en las que no se juega.
-- Ahora cada torneo puede fijar su ventana ENTRE SEMANA, en FIN DE SEMANA y en FESTIVOS:
--   play_windows = { "weekday": {"from":"17:00","to":"23:00"}, "weekend": {...}, "holiday": {...} }
--   holidays     = fechas ISO (de los días del torneo) que el club marca como festivo
-- start_time / end_time se siguen rellenando con el rango global (mínimo de inicios, máximo de finales) para los
-- clientes antiguos, que solo conocen esos dos campos.
alter table public.tournaments
  add column if not exists play_windows jsonb,
  add column if not exists holidays text[] not null default '{}';

-- La ficha pública (inscripción) lee las franjas por esta RPC: se añaden las dos columnas AL FINAL.
drop function if exists public.tournament_lookup(text);
create function public.tournament_lookup(p_code text)
 returns table(id uuid, name text, genders text[], categories text[], pair_based boolean, starts_on date, ends_on date,
               entry_fee numeric, entry_fee_2 numeric, fee_currency text, category_rules jsonb, start_time text,
               end_time text, max_removable_hours integer, terms text, play_windows jsonb, holidays text[])
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select id, name, genders, categories, coalesce(pair_based, true), starts_on, ends_on,
    entry_fee, entry_fee_2, fee_currency, category_rules, start_time, end_time,
    max_removable_hours,
    -- Ya resueltas: el cliente enseña exactamente lo que se va a guardar.
    coalesce(nullif(btrim(terms), ''), public.tournament_default_terms()),
    play_windows, holidays
  from public.tournaments
  where signup_code = p_code and status = 'open';
$function$;
grant execute on function public.tournament_lookup(text) to public, anon, authenticated, service_role;
