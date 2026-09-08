-- Los equipos INVITADOS dejan de contar como «equipo independiente».
--
-- Un equipo invitado (juega en las pistas de un club sin ser suyo) se guarda con
-- `club_id` a NULL y `venue_club_id` apuntando al club sede. La cuota miraba
-- solo `club_id IS NULL`, así que los confundía con equipos independientes del
-- gestor: al importar el SEGUNDO invitado saltaba «Solo puedes tener 1 equipo
-- independiente. Usa un plan Club para gestionar varios», aun teniendo plan de
-- club. Es decir, la función de invitados solo funcionaba para un equipo.
--
-- Ahora hay tres casos: invitado (tope por club sede), independiente de verdad
-- (1 por usuario, sin contar invitados) y equipo de club (tope 25).

create or replace function public.enforce_team_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_count int;
BEGIN
  -- 1) Equipo INVITADO: no es del club ni del gestor, solo usa sus pistas.
  --    No consume la plaza de «equipo independiente» de nadie.
  IF NEW.club_id IS NULL AND NEW.venue_club_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.teams
    WHERE venue_club_id = NEW.venue_club_id AND club_id IS NULL;
    IF v_count >= 25 THEN
      RAISE EXCEPTION 'Has alcanzado el máximo de 25 equipos invitados en este club.'
        USING errcode = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- 2) Equipo independiente (sin club y sin sede): 1 por usuario.
  IF NEW.club_id IS NULL THEN
    SELECT count(*) INTO v_count
    FROM public.teams
    WHERE owner_id = NEW.owner_id
      AND club_id IS NULL
      AND venue_club_id IS NULL;   -- los invitados no cuentan
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Solo puedes tener 1 equipo independiente. Usa un plan Club para gestionar varios.'
        USING errcode = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- 3) Equipo de club: estructura libre hasta 25 (tope de cordura). El tier es
  --    cobertura blanda; la monetización va por los gates de operación.
  SELECT count(*) INTO v_count
  FROM public.teams
  WHERE club_id = NEW.club_id;
  IF v_count >= 25 THEN
    RAISE EXCEPTION 'Has alcanzado el máximo de 25 equipos por club.'
      USING errcode = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
