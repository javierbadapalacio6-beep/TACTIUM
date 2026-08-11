-- Federación pública · lectura sin sesión de las tablas `fcp_*`.
--
-- Son datos que la federación ya publica en abierto: clasificaciones, actas,
-- rankings y calendarios. No hay nada por fila que proteger, así que van por
-- POLÍTICA de lectura y no por RPC — la web puede filtrar y paginar con
-- consultas normales en vez de una función por vista.
--
-- Cada tabla ya tenía su política `*_read` con `using (true)` para
-- `authenticated`; aquí simplemente se le suma `anon`.
--
-- QUEDAN FUERA A PROPÓSITO: `fcp_player_links` y `fcp_team_links`. Esas no son
-- datos de la federación, son el PUENTE entre un jugador federado y una cuenta
-- de TACTIUM. Abrirlas diría públicamente qué usuario es qué jugador federado
-- y quién hizo el enlace.

do $$
declare
  t text;
  tablas text[] := array[
    'fcp_ligas',
    'fcp_grupos',
    'fcp_clasificacion',
    'fcp_partidos',
    'fcp_jugadores',
    'fcp_rankings',
    'fcp_ranking_snapshots',
    'fcp_actas',
    'fcp_historico'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t
    );
  end loop;
end $$;
