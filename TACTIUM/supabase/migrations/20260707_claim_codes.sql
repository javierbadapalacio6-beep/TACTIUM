-- ════════════════════════════════════════════════════════════════════
-- Migración 2026-07-07 (2/2) · Códigos de reclamo de amistosos
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- Idempotente. Aplicar TAMBIÉN 20260707_player_birthdate.sql si no lo está.
--
-- PARA QUÉ: cuando alguien juega un amistoso SIN tener cuenta, sus
-- participaciones se guardan solo con su nombre. Con esto, cada partido
-- tiene un código corto (p. ej. K7M2XQ) que va en el mensaje de
-- invitación; al registrarse, la persona lo introduce en la pestaña
-- Stats, elige su nombre y el partido pasa a su cuenta. Cierra el loop:
-- invitado → se instala → SUS PARTIDOS LE ESPERAN.
-- ════════════════════════════════════════════════════════════════════

-- 1 · Generador de códigos cortos legibles (sin 0/O/1/I)
create or replace function public.gen_claim_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6)
$$;

-- 2 · Columna + default + backfill + unicidad
alter table public.casual_matches
  add column if not exists claim_code text;

alter table public.casual_matches
  alter column claim_code set default public.gen_claim_code();

update public.casual_matches
  set claim_code = public.gen_claim_code()
  where claim_code is null;

create unique index if not exists casual_matches_claim_code_key
  on public.casual_matches (claim_code);

-- 3 · Consultar participaciones reclamables de un código
create or replace function public.get_claimable_participants(p_code text)
returns table (participant_id uuid, name text, side smallint, played_on date)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.side::smallint, m.played_on
  from casual_match_participants p
  join casual_matches m on m.id = p.match_id
  where upper(m.claim_code) = upper(trim(p_code))
    and p.user_id is null
    and coalesce(p.name, '') <> '';
$$;

grant execute on function public.get_claimable_participants(text) to authenticated;

-- 4 · Reclamar una participación (vincula al usuario autenticado)
create or replace function public.claim_casual_participant(
  p_code text,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update casual_match_participants p
     set user_id = auth.uid()
    from casual_matches m
   where p.id = p_participant_id
     and m.id = p.match_id
     and upper(m.claim_code) = upper(trim(p_code))
     and p.user_id is null;
  return found;
end;
$$;

grant execute on function public.claim_casual_participant(text, uuid) to authenticated;
