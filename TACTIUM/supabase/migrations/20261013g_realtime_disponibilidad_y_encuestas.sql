-- Realtime para disponibilidad (Voy/Duda/No) y encuesta de hora.
-- Antes solo se veían al entrar en la pantalla; ahora la app y la web con sesión se refrescan solas cuando
-- alguien responde o vota. RLS manda: cada cliente solo recibe cambios de las filas que puede leer
-- (miembros del equipo). Los DELETE no admiten filtro y llegan sin datos, así que el cliente recarga.
-- El enlace público (sin sesión) sigue refrescando cada 10 s: los anónimos no pueden usar Realtime.

do $$
declare
  t text;
begin
  foreach t in array array['availability', 'matchday_time_polls', 'matchday_time_poll_options', 'matchday_time_poll_votes']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
