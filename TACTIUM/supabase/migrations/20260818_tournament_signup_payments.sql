-- Cobro de inscripciones de torneo (Stripe Connect). Fase 2.
-- La pareja paga la cuota → destination charge a la cuenta del club (− 3% TACTIUM)
-- → el webhook crea la inscripción al confirmarse el pago. Ver
-- TACTIUM/docs/plan-inscripciones-connect.md.

-- Pago de inscripción. Guarda la FICHA (signup_payload) hasta que el pago se
-- confirma; entonces el webhook llama a tournament_signup con esos datos. Así no
-- quedan inscripciones "a medias" sin pagar.
create table if not exists public.tournament_signup_payments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  registration_id uuid references public.tournament_registrations(id) on delete set null,
  amount_cents integer not null,
  application_fee_cents integer not null default 0,   -- comisión TACTIUM (3%)
  currency text not null default 'eur',
  status text not null default 'pending',             -- pending | paid | refunded | canceled
  provider text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent text,
  connected_account_id text,                           -- acct_ del club (auditoría)
  signup_payload jsonb not null,                       -- ficha de inscripción
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Solo el servidor (service_role vía checkout/webhook) toca esta tabla.
alter table public.tournament_signup_payments enable row level security;

-- Marca de cobro en la propia inscripción (para distinguir gratis vs pagada).
alter table public.tournament_registrations
  add column if not exists payment_status text not null default 'not_required';
  -- not_required (torneo gratis) | paid (inscripción pagada)
