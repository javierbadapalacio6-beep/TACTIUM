-- FCP · Actas detalladas (Nivel 2): parejas + parciales por set.
-- Cada enfrentamiento (fila de fcp_partidos) son 4-5 partidos individuales, cada
-- uno con sus 2 parejas (4 jugadores) y los parciales por set. El agente
-- (agente-federacion-cantabra.js --actas) scrapea Liga_Resultado y puebla esta
-- tabla en doble destino (LIVE + TACTIUM). Ver [[tactium_fcp_federation_integration]].

create table if not exists public.fcp_actas (
  id_partido    text not null,   -- enfrentamiento (fcp_{liga}_{grupo}_{num}) → fcp_partidos.id_partido
  id_liga       integer,
  id_grupo      text,
  partido_num   integer not null, -- orden de pista dentro del enfrentamiento (1..5)
  equipo_local  text,
  equipo_visit  text,
  local_j1      text,
  local_j2      text,
  visit_j1      text,
  visit_j2      text,
  local_j1_pts  numeric,
  local_j2_pts  numeric,
  visit_j1_pts  numeric,
  visit_j2_pts  numeric,
  sets_local    integer,
  sets_visit    integer,
  parciales     text,             -- "6/3 - 4/6 - 6/2"
  ganador       text,             -- 'local' | 'visitante'
  updated_at    timestamptz not null default now(),
  primary key (id_partido, partido_num)
);

alter table public.fcp_actas enable row level security;

drop policy if exists fcp_actas_read on public.fcp_actas;
create policy fcp_actas_read on public.fcp_actas
  for select to authenticated using (true);
-- Escritura: solo service_role (bypassa RLS), igual que el resto de fcp_*.

create index if not exists idx_fcp_actas_grupo on public.fcp_actas(id_grupo);
create index if not exists idx_fcp_actas_liga  on public.fcp_actas(id_liga);
