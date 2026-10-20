-- «Publicada» de verdad: la alineación solo es visible para jugadores cuando el capitán pulsa Publicar.
--
-- Hasta ahora el editor guarda cada cambio al momento en la variante oficial y los jugadores veían esa
-- alineación a medias («lista») sin que el capitán la hubiera publicado ni avisado. Esta marca es lo que
-- distingue borrador de publicada. NULL = sin publicar.

alter table public.matchdays add column if not exists lineup_published_at timestamptz;

comment on column public.matchdays.lineup_published_at is
  'Cuándo el capitán pulsó Publicar en la alineación. NULL = borrador: solo lo ve el capitán/club.';

-- Las jornadas que ya tienen alineación completa en la variante oficial cuentan como publicadas
-- (no escondemos de golpe lo que los jugadores ya veían).
update public.matchdays m
set lineup_published_at = coalesce(m.lineup_published_at, now())
where m.lineup_published_at is null
  and exists (
    select 1
    from public.lineup_variants v
    join public.lineups l on l.variant_id = v.id
    where v.matchday_id = m.id
      and v.is_active
      and l.player_a_id is not null
      and l.player_b_id is not null
  );
