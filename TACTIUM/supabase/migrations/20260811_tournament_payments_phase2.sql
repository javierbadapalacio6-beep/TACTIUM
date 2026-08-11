-- FASE 2 · Cobro por torneo (modelo "por adelantado según max_pairs").
-- Estado de cobro del propio torneo: gatea el paso a "open" (inscripción).
--   none            = aún sin evaluar
--   included        = cubierto por la suscripción del club (gratis)
--   free            = gratis (<=16 parejas, sin suscripción)
--   pending_payment = requiere pago y aún no se ha completado
--   paid            = pagado (o cubierto) → puede publicarse
alter table public.tournaments
  add column if not exists billing_status text not null default 'none';

-- Pagos por torneo (uno por intento de cobro; el último 'paid' manda).
create table if not exists public.tournament_payments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  max_pairs integer,                 -- plazas contratadas (lo que fija el precio)
  reason text,                       -- 'per_tournament' | 'overage'
  amount_cents integer not null,     -- importe en céntimos (€)
  currency text not null default 'eur',
  status text not null default 'pending',  -- pending | paid | failed | refunded
  provider text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists tournament_payments_tournament_idx
  on public.tournament_payments (tournament_id);
create unique index if not exists tournament_payments_stripe_session_uidx
  on public.tournament_payments (stripe_session_id)
  where stripe_session_id is not null;

-- RLS: solo el admin del club dueño del torneo ve/gestiona sus pagos. La
-- escritura de confirmación la hará el webhook con service_role (bypassa RLS).
alter table public.tournament_payments enable row level security;

drop policy if exists tournament_payments_club_admin_read on public.tournament_payments;
create policy tournament_payments_club_admin_read
  on public.tournament_payments for select
  using (
    exists (
      select 1 from public.clubs c
      where c.id = tournament_payments.club_id
        and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = tournament_payments.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );
