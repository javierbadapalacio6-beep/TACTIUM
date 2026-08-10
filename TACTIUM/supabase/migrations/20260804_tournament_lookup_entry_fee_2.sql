-- El lookup público de torneo (inscripción por código) debe devolver también
-- entry_fee_2 para mostrar el precio de 2 categorías en la pantalla de apuntarse.
drop function if exists public.tournament_lookup(text);

create function public.tournament_lookup(p_code text)
 returns table(id uuid, name text, genders text[], categories text[], pair_based boolean, starts_on date, ends_on date, entry_fee numeric, entry_fee_2 numeric, fee_currency text, category_rules jsonb, start_time text, end_time text, max_removable_hours integer)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select id, name, genders, categories, coalesce(pair_based, true), starts_on, ends_on,
    entry_fee, entry_fee_2, fee_currency, category_rules, start_time, end_time, max_removable_hours
  from public.tournaments
  where signup_code = p_code and status = 'open';
$function$;

grant execute on function public.tournament_lookup(text) to anon, authenticated;
