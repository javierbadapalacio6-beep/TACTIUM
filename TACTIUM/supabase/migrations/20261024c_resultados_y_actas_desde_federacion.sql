-- ═════════════════════════════════════════════════════════════════════════
-- Resultados y actas de la Federación → TACTIUM, solos (2026-10-24)
--
-- Hasta ahora el marcador de una jornada federada y los sets de cada pareja solo
-- entraban al IMPORTAR la temporada o con el botón «Traer del acta». Si el
-- capitán no lo pulsaba, la jornada se quedaba «por jugar» y sin sets.
--
-- Ahora, en cuanto el agente guarda el dato en las tablas fcp_*:
--   · fcp_partidos pasa a «jugado» con marcador  → la jornada enlazada se cierra
--     con ese marcador (status finished, outcome, score_for/against);
--   · fcp_actas recibe una pareja                → sus sets pasan a match_results.
--
-- LA FEDERACIÓN MANDA. Lo que se apunte en TACTIUM (directo, a mano, cierre del
-- capitán) vale hasta que la Federación publica lo suyo; entonces lo oficial
-- SUSTITUYE a lo nuestro: el marcador y el cierre de la jornada, y los sets de
-- cada pista (si difieren, se borran los sets de esa pista y se ponen los del
-- acta). Si coinciden, no se toca nada.
--   · Los sets 0/0 se descartan; «W.O.» sin sets crea el W.O. con la dirección que
--     dice el acta (forfeit_us = no nos presentamos nosotros).
--   · Perspectiva por is_home de la jornada.
--   · Un acta sin sets ni W.O. legible no borra nada.
-- ═════════════════════════════════════════════════════════════════════════

-- ── Sets (o W.O.) de UNA pista de un acta: lo oficial sustituye a lo nuestro ──
create or replace function private.fcp_acta_pista_a_resultados(
  p_matchday uuid, p_is_home boolean, p_num integer, p_parciales text, p_ganador text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if p_num is null or p_num < 1 or p_num > 12 then return false; end if;

  -- Lo que dice el acta, en el formato de match_results.
  select coalesce(jsonb_agg(jsonb_build_object(
           'us',  case when p_is_home then s.l else s.v end,
           'them', case when p_is_home then s.v else s.l end,
           'wo', false, 'fus', false) order by s.ord), '[]'::jsonb)
    into v_new
    from (
      select (x[1])::int as l, (x[2])::int as v, ord
        from regexp_matches(coalesce(p_parciales, ''), '(\d+)\s*/\s*(\d+)', 'g') with ordinality as t(x, ord)
    ) s
   where not (s.l = 0 and s.v = 0);

  if jsonb_array_length(v_new) = 0 then
    -- Sin sets: ¿W.O.? Sin ganador no se sabe hacia dónde va, así que no se adivina.
    if coalesce(p_parciales, '') ~* 'w\.?\s*o' and p_ganador in ('local', 'visitante') then
      select jsonb_agg(jsonb_build_object('us', null, 'them', null, 'wo', true,
                                          'fus', not ((p_ganador = 'local') = p_is_home)))
        into v_new from generate_series(1, 3);
    else
      return false;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('us', us, 'them', them, 'wo', forfeit, 'fus', forfeit_us)
                            order by set_number), '[]'::jsonb)
    into v_old
    from public.match_results where matchday_id = p_matchday and court_number = p_num;
  if v_old = v_new then return false; end if;

  delete from public.match_results where matchday_id = p_matchday and court_number = p_num;
  insert into public.match_results (matchday_id, court_number, set_number, us, them, forfeit, forfeit_us)
  select p_matchday, p_num, t.n::int,
         (t.e->>'us')::int, (t.e->>'them')::int, (t.e->>'wo')::boolean, (t.e->>'fus')::boolean
    from jsonb_array_elements(v_new) with ordinality as t(e, n);
  return true;
end $$;

-- ── Marcador oficial: cierra (o corrige) la jornada con el resultado de la Federación ─
create or replace function private.fcp_apply_resultado(p_matchday uuid, p_id_partido text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  md record;
  v_parts text[];
  v_l int; v_v int; v_for int; v_against int;
begin
  select estado, resultado into p from public.fcp_partidos where id_partido = p_id_partido;
  if not found or p.estado is distinct from 'jugado' then return; end if;
  select is_home, status into md from public.matchdays where id = p_matchday;
  if not found then return; end if;

  v_parts := regexp_split_to_array(coalesce(p.resultado, ''), '[/\-]');
  if array_length(v_parts, 1) <> 2 then return; end if;
  begin
    v_l := nullif(btrim(v_parts[1]), '')::int;
    v_v := nullif(btrim(v_parts[2]), '')::int;
  exception when others then return;
  end;
  if v_l is null or v_v is null then return; end if;

  v_for := case when md.is_home then v_l else v_v end;
  v_against := case when md.is_home then v_v else v_l end;
  update public.matchdays
     set status = 'finished',
         score_for = v_for, score_against = v_against,
         outcome = (case when v_for > v_against then 'win' when v_for < v_against then 'loss' else 'draw' end)::public.match_outcome
   where id = p_matchday
     and (status <> 'finished'
          or score_for is distinct from v_for or score_against is distinct from v_against
          or outcome is distinct from (case when v_for > v_against then 'win' when v_for < v_against then 'loss' else 'draw' end)::public.match_outcome);
end $$;

-- ── Triggers ────────────────────────────────────────────────────────────
create or replace function private.fcp_partido_resultado_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in select id from public.matchdays where fcp_id_partido = new.id_partido loop
    perform private.fcp_apply_resultado(r.id, new.id_partido);
  end loop;
  return null;
end $$;

drop trigger if exists fcp_partidos_resultado_sync on public.fcp_partidos;
create trigger fcp_partidos_resultado_sync
  after insert or update of estado, resultado on public.fcp_partidos
  for each row when (new.estado = 'jugado')
  execute function private.fcp_partido_resultado_sync();

create or replace function private.fcp_acta_resultados_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in select id, is_home from public.matchdays where fcp_id_partido = new.id_partido loop
    perform private.fcp_acta_pista_a_resultados(r.id, r.is_home, new.partido_num, new.parciales, new.ganador);
  end loop;
  return null;
end $$;

drop trigger if exists fcp_actas_resultados_sync on public.fcp_actas;
create trigger fcp_actas_resultados_sync
  after insert or update on public.fcp_actas
  for each row execute function private.fcp_acta_resultados_sync();

revoke all on function private.fcp_acta_pista_a_resultados(uuid, boolean, integer, text, text) from public, anon, authenticated;
revoke all on function private.fcp_apply_resultado(uuid, text) from public, anon, authenticated;
revoke all on function private.fcp_partido_resultado_sync() from public, anon, authenticated;
revoke all on function private.fcp_acta_resultados_sync() from public, anon, authenticated;

-- ── Lo que ya estaba publicado ──────────────────────────────────────────
-- Jornadas enlazadas cuyo partido ya está jugado en la Federación: marcador oficial…
do $$
declare r record;
begin
  for r in
    select m.id, m.fcp_id_partido from public.matchdays m
      join public.fcp_partidos p on p.id_partido = m.fcp_id_partido and p.estado = 'jugado'
  loop
    perform private.fcp_apply_resultado(r.id, r.fcp_id_partido);
  end loop;
end $$;

-- …y los sets de cada pareja con acta (si ya coinciden, no se toca).
do $$
declare r record;
begin
  for r in
    select m.id, m.is_home, a.partido_num, a.parciales, a.ganador
      from public.matchdays m
      join public.fcp_actas a on a.id_partido = m.fcp_id_partido
  loop
    perform private.fcp_acta_pista_a_resultados(r.id, r.is_home, r.partido_num, r.parciales, r.ganador);
  end loop;
end $$;
