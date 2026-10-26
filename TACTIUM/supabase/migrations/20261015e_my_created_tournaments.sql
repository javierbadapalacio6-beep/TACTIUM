-- «Creados por mí» en Torneos: los torneos que organizas.
--
-- `my_tournaments()` solo devuelve aquellos en los que juegas (inscrito como p1/p2). Quien organiza no tenía
-- ninguna lista suya fuera de la gestión del club. Esta devuelve las MISMAS columnas, así que las dos pantallas
-- (app y web) reutilizan la fila.
--
-- «Mío» = lo creé yo, o lo gestiona un club del que soy admin (gestores por invitación, 14-10-2026).

create or replace function public.my_created_tournaments()
returns table(
  id uuid, name text, club_name text, cover_url text, location text, starts_on date, status text,
  format text, genders text[], categories text[], signup_code text, pair_based boolean, players bigint,
  entry_fee numeric, fee_currency text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.name, c.name, t.cover_url, t.location, t.starts_on, t.status,
    t.format, t.genders, t.categories, t.signup_code, coalesce(t.pair_based, true),
    (select count(*) from public.tournament_registrations r2 where r2.tournament_id = t.id),
    t.entry_fee, t.fee_currency
  from public.tournaments t
  join public.clubs c on c.id = t.club_id
  where auth.uid() is not null
    and (t.created_by = auth.uid() or private.is_club_admin(t.club_id))
  order by (t.starts_on is null), t.starts_on desc
$$;

revoke all on function public.my_created_tournaments() from public, anon;
grant execute on function public.my_created_tournaments() to authenticated;
