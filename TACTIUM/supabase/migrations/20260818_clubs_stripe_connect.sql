-- Stripe Connect (Express) para clubes: cobro de inscripciones de torneo.
-- Fase 1 (onboarding). Ver TACTIUM/docs/plan-inscripciones-connect.md.
--
-- El estado lo escribe SIEMPRE el servidor (endpoints /api/connect/*, con
-- service_role, tras consultar a Stripe). El cliente no debe poder marcarse la
-- cuenta como activa.

alter table public.clubs
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text not null default 'none';
  -- none | onboarding | restricted | active
