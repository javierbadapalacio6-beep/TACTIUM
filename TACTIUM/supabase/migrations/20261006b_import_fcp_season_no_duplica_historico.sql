-- Volcar de la Federación no vuelve a crear una temporada que ya está en el
-- histórico.
--
-- EL PROBLEMA. Entre temporadas, el equipo queda vinculado a su INSCRIPCIÓN de
-- la liga que viene, que aún no tiene grupos. La app cae entonces a la
-- clasificación de la temporada anterior (para enseñarla) y «Traer de la
-- Federación» mandaba ese id: como la temporada anterior ya estaba CERRADA,
-- `import_fcp_season` no encontraba temporada activa y creaba otra igual,
-- «Temporada nueva creada», sin avisar de que era la de antes.
--
-- LA SOLUCIÓN. Si el grupo que llega ya es el de una temporada cerrada del
-- equipo (y no el de la activa), no se crea nada y se explica por qué. Se
-- inserta la comprobación al principio, antes de tocar la temporada activa,
-- sobre la definición vigente de la función (la de
-- `20260925_import_fcp_season_no_pisa`).
do $mig$
declare
  d text;
  guard text := $g$
  -- Ese grupo ya es una temporada cerrada del equipo: no se duplica.
  if exists (
    select 1 from public.seasons
    where team_id = p_team_id and active = false and fcp_id_grupo = v_grupo
  ) and not exists (
    select 1 from public.seasons
    where team_id = p_team_id and active = true and fcp_id_grupo = v_grupo
  ) then
    raise exception 'Esa temporada ya está en tu histórico (%). La Federación aún no ha publicado el calendario de la temporada nueva: cuando lo haga podrás volcarla.',
      (select name from public.seasons
       where team_id = p_team_id and active = false and fcp_id_grupo = v_grupo
       order by created_at desc limit 1)
      using errcode = 'P0001';
  end if;

$g$;
  anchor text := '  select id, fcp_id_grupo into v_season, v_season_grupo';
begin
  d := pg_get_functiondef('public.import_fcp_season(uuid,integer,text)'::regprocedure);
  if position('ya está en tu histórico' in d) > 0 then
    return; -- ya aplicada
  end if;
  if position(anchor in d) = 0 then
    raise exception 'import_fcp_season ha cambiado: revisar esta migración';
  end if;
  d := replace(d, anchor, guard || anchor);
  execute d;
end
$mig$;
