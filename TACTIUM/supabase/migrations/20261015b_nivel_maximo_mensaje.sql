-- «Nivel máximo» en el mensaje de elegibilidad de tournament_signup. La cuenta no cambia (suma de categorías de la
-- pareja ≥ N: nadie mejor que ese nivel); solo el texto, que hablaba de «nivel >= N» como si fuera un mínimo.
do $$
declare
  def text;
  nw  text;
begin
  select pg_get_functiondef('public.tournament_signup(text,text,text,text,text,text,text,text[],text,text,numeric,integer,boolean,boolean,boolean)'::regprocedure) into def;
  nw := replace(def,
    'raise exception ''Necesitáis nivel >= % en la categoría % (sumáis %)'', v_min_niv, p_category, p_league_sum;',
    'raise exception ''Superáis el nivel máximo de %: la suma de categorías tiene que ser % o más (sumáis %)'', p_category, v_min_niv, p_league_sum;');
  if nw = def then raise exception 'No se pudo parchear el mensaje de nivel'; end if;
  execute nw;
end $$;
