# Cobro de inscripciones de torneo con Stripe Connect (Express)

**Objetivo:** que la pareja pague la cuota de inscripción **al club** desde la
app/web, con una **comisión pequeña para TACTIUM**. La misma base (Connect)
servirá luego para cuotas de socio.

**Decisiones tomadas:** Connect **Express** + **comisión de TACTIUM**.

---

## 1. Las dos patas del dinero de un torneo

| Pata | Quién paga | Quién cobra | Estado |
|---|---|---|---|
| Cuota de **organización** | Club | TACTIUM | ✅ Hecho (Stripe web + webhook) |
| Cuota de **inscripción** | Pareja/jugador | **Club** (− comisión TACTIUM) | 🔨 Esto |

Son flujos distintos: el de organización cobra a la cuenta de TACTIUM; el de
inscripción cobra a la cuenta **conectada del club**.

---

## 2. Modelo de cobro (Stripe Connect Express)

- **TACTIUM = plataforma**, cada **club = cuenta conectada Express**.
- Cargo tipo **destination charge**: TACTIUM crea el pago, los fondos van a la
  cuenta del club vía `transfer_data.destination`, y TACTIUM se queda su parte
  vía `application_fee_amount`. `on_behalf_of = club` para que el club sea el
  *merchant of record* (aparece en el extracto de la pareja) — encaja con el
  marco "servicio del mundo real" de Apple.
- **Payouts**: Stripe paga al banco del club automáticamente (calendario de
  payout de la cuenta Express). TACTIUM no toca ese dinero.

### Apple / Google
Una inscripción a un torneo es un **evento del mundo real** → Apple **3.1.3(e)**
obliga a cobrarlo con tarjeta/Stripe (NO IAP). Google igual. Mismo razonamiento
que la cuota de organización.
- **Paso de pago web-first** (recomendado): el pago se hace en `app.tactium.io`;
  la app hace deep-link a esa página. Cero riesgo con Apple.
- (Los servicios del mundo real *sí* se pueden cobrar dentro de la app, pero
  web-first es más limpio y reutiliza lo que ya hay.)

---

## 3. Modelo de datos

### `clubs` (añadir)
```sql
alter table public.clubs
  add column if not exists stripe_connect_account_id text,      -- acct_...
  add column if not exists stripe_connect_status text
    not null default 'none';  -- none | onboarding | active | restricted
```

### `tournaments` (ya existe)
- `entry_fee`, `entry_fee2` (numeric) → precio(s) de inscripción que fija el club
  al crear el torneo. `entry_fee2` cubre una 2ª categoría/género con precio
  distinto (ya soportado en el alta).

### `tournament_signup_payments` (nueva — espejo de `tournament_payments`)
```sql
create table public.tournament_signup_payments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  registration_id uuid references public.tournament_registrations(id) on delete set null,
  club_id uuid not null references public.clubs(id) on delete cascade,
  amount_cents integer not null,
  application_fee_cents integer not null default 0,   -- comisión TACTIUM
  currency text not null default 'eur',
  status text not null default 'pending',             -- pending | paid | refunded | canceled
  provider text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent text,
  connected_account_id text,                          -- acct_ del club (auditoría)
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
```

### `tournament_registrations` (añadir)
```sql
alter table public.tournament_registrations
  add column if not exists payment_status text not null default 'not_required';
  -- not_required (torneo gratis) | unpaid | paid | refunded
```

---

## 4. Endpoints (Next.js, en `app.tactium.io`)

Todos con **service_role** en servidor y **clave secreta de plataforma** de
Stripe (la misma cuenta que ya usamos).

### Onboarding del club
- `POST /api/connect/onboard`
  - Auth: owner/admin del club.
  - Si el club no tiene `stripe_connect_account_id` → `stripe.accounts.create({ type: 'express', country, capabilities: { card_payments, transfers } })` y lo guarda.
  - Crea un **Account Link** (`stripe.accountLinks.create`, type `account_onboarding`) y devuelve la URL.
  - `refresh_url` / `return_url` → páginas en la web.
- **Webhook `account.updated`** → actualiza `clubs.stripe_connect_status`:
  `charges_enabled && payouts_enabled ? 'active' : (details_submitted ? 'restricted' : 'onboarding')`.
- `GET /api/connect/status` → estado + link para continuar onboarding si falta algo.

### Checkout de inscripción
- `POST /api/tournaments/:id/signup-checkout`
  - Valida: torneo **publicado**, tiene `entry_fee > 0`, y el club está `active` en Connect.
  - Crea el **draft de inscripción** (`tournament_registrations`, `payment_status='unpaid'`) con los datos de la ficha, o guarda la ficha en metadata hasta confirmar.
  - Crea Checkout Session (`mode: 'payment'`):
    ```
    payment_intent_data: {
      application_fee_amount: <comisión TACTIUM en cents>,
      transfer_data: { destination: <acct_ del club> },
      on_behalf_of: <acct_ del club>,
    }
    line_items: [{ price_data: { unit_amount: entry_fee_cents, product_data: { name: 'Inscripción · <torneo>' } }, quantity: 1 }]
    metadata: { tournament_id, registration_id, kind: 'signup' }
    success_url / cancel_url
    ```
  - Devuelve `url` (web) o la manda por correo (si viene de la app y se decide email).
  - **Idempotencia** como en el pago de organización (reutiliza sesión abierta del mismo importe).

### Webhook de confirmación
- `POST /api/tournaments/signup-webhook` (o reutilizar el de torneos con un `kind`):
  - `checkout.session.completed` con `metadata.kind='signup'` →
    - `tournament_signup_payments.status='paid'`,
    - `tournament_registrations.payment_status='paid'` (confirma la inscripción).

> El **gate** actual ya impide inscribir en torneos no publicados; aquí solo
> añadimos que, si el torneo tiene cuota, la inscripción quede **`unpaid` hasta
> pagar** (un trigger opcional puede impedir el paso a `paid` salvo service_role).

---

## 5. Comisión y tarifas (a cerrar contigo)

En destination charges, por defecto **la plataforma (TACTIUM) paga las tarifas
de Stripe** (~1,5% + 0,25 € tarjeta EU). Dos formas de montarlo:

- **Opción A — comisión neta para TACTIUM, tarifas a cargo del club:**
  configurar la cuenta conectada para que asuma las tarifas de Stripe
  (`on_behalf_of` + settlement en el club). TACTIUM fija un `application_fee`
  limpio (p. ej. **3%**). El club recibe `inscripción − Stripe − 3%`.
- **Opción B — TACTIUM absorbe Stripe y cobra por encima:** `application_fee`
  mayor (p. ej. **4-5%**) que cubre Stripe + margen. El club recibe
  `inscripción − application_fee`, y TACTIUM paga Stripe de su parte.

**Sugerencia:** Opción A con **3%** (transparente: "TACTIUM cobra un 3% por
inscripción; las tarifas de la pasarela las pone Stripe"). Fácil de comunicar.

**Ejemplo (inscripción 20 €, 3%):** comisión TACTIUM 0,60 €; el resto, menos
tarifa Stripe, al club.

---

## 6. Encaje en la interfaz

### Club
- Panel de club → **"Cobros" / "Facturación"**: botón **"Conectar con Stripe"**
  (onboarding Express). Estado: *Sin conectar / Pendiente / Activo*.
- Al crear torneo: campo **cuota de inscripción** (ya existe). Aviso si el club
  no está conectado: "conéctate a Stripe para cobrar inscripciones online".

### Pareja / jugador (ficha de inscripción)
- Si el torneo tiene cuota y el club está conectado: tras rellenar la ficha →
  **"Pagar inscripción · X €"** → Stripe → confirmación.
- Si el club **no** está conectado: se mantiene el flujo actual (inscripción sin
  cobro online; el club cobra por su cuenta). Nada se rompe.

### App
- La ficha de inscripción **deep-linkea a la web** para el pago (web-first).

---

## 7. Fases de entrega

1. **Connect Express — onboarding del club** (la base; sin esto no hay cobro).
   `accounts.create` + `accountLinks` + webhook `account.updated` + UI de estado.
2. **Checkout de inscripción (web)** + webhook de confirmación + estado
   `payment_status` en la inscripción.
3. **App:** deep-link a la ficha de pago web.
4. **Reembolsos / bajas** (revertir transfer + application_fee) y **visibilidad
   de payouts** en el panel del club.
5. **Reutilizar Connect** para cuotas de socio (Stripe Billing sobre la cuenta
   conectada).

---

## 8. Riesgos / cosas a vigilar

- **KYC**: algunos clubes tardarán en completar el alta (identidad + banco).
  Mientras `status != active`, no se puede cobrar online → fallback al flujo
  actual.
- **Reembolsos**: si una pareja se borra, hay que reembolsar (y decidir si se
  devuelve también la comisión de TACTIUM).
- **Fiscalidad**: el club es el vendedor (merchant of record vía `on_behalf_of`);
  las facturas/IVA de la inscripción son cosa del club, no de TACTIUM. TACTIUM
  solo factura su comisión.
- **Disputas/chargebacks**: con destination charges las gestiona la plataforma;
  conviene reflejarlas contra el club.

---

## 9. Decisiones que faltan para arrancar la Fase 1

1. **% de comisión** (sugerido 3%) y **quién asume las tarifas de Stripe**
   (sugerido: el club → Opción A).
2. **País/moneda** por defecto de las cuentas Express (ES / EUR).
3. **Pago en app**: confirmamos **web-first** (deep-link) — recomendado.
