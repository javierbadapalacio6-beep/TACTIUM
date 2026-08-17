# Desplegar tactium-web para cobrar torneos

Objetivo mínimo: publicar la web en producción para **activar el cobro de
torneos** (desde la app y desde la web), sin depender de que el resto del
frontend esté pulido.

El cobro de torneos vive en 3 rutas de servidor —
`/api/tournaments/[id]/checkout`, `/api/tournaments/webhook` y la página de
retorno `/torneos/pago-ok`— que escriben con **service_role**. Por eso el
interruptor `NEXT_PUBLIC_TACTIUM_WRITES` NO las afecta: puedes dejar la web en
**solo-lectura** y el cobro funciona igual.

Interruptor real del cobro: tener `STRIPE_SECRET_KEY`. Sin clave → las rutas
responden 503 ("cobro no activo"). Con clave live → encendido.

---

## 1. Variables de entorno

Configúralas en el host (Vercel → Project → Settings → Environment Variables).
`NEXT_PUBLIC_*` se incrustan en el build (públicas); el resto son de servidor.

| Variable | Tipo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL del proyecto Supabase (producción) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | anon/publishable key de Supabase |
| `NEXT_PUBLIC_APP_URL` | pública | Dominio real, ej. `https://tactium.io` (success/cancel de Stripe y el `pago-ok`) |
| `NEXT_PUBLIC_TACTIUM_WRITES` | pública | `off` para lanzar en solo-lectura (recomendado hasta pulir la UI) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | Que el webhook confirme pagos saltándose RLS |
| `STRIPE_SECRET_KEY` | **secreta** | `sk_live_…` — interruptor del cobro |
| `STRIPE_WEBHOOK_SECRET` | **secreta** | `whsec_…` del endpoint de **torneos** |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | **secreta** | `whsec_…` del endpoint de **suscripciones** (si se deja vacío, reutiliza el de arriba) |
| `RESEND_API_KEY` | **secreta** | Enviar por email el enlace de pago (obligado para el flujo de la app) |
| `EMAIL_FROM` | config | Remitente, ej. `TACTIUM <no-reply@tactium.io>` (dominio verificado en Resend) |
| `EMAIL_LOGO_URL` | config | Opcional; logo en la cabecera del correo |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pública | Opcional; hoy no se usa (el checkout es redirección de servidor) |

> Empieza con claves **test** (`sk_test_`) para una pasada de humo, y cambia a
> **live** cuando todo cuadre.

---

## 2. Desplegar la web

1. Conecta el repo al host (Vercel detecta Next.js solo). **Root directory =
   `tactium-web`** (es un monorepo).
2. Build command `next build`, output por defecto. Node 20+.
3. Mete las variables del punto 1 (marca las secretas como "sensitive").
4. Deploy. Verifica que `https://<dominio>/torneos` carga.

---

## 3. Webhooks de Stripe (el paso que en local hacía `stripe listen`)

En el panel de Stripe (modo **live**) → Developers → Webhooks → **Add endpoint**.
Crea DOS endpoints:

| Endpoint URL | Eventos a escuchar | Secreto → variable |
|---|---|---|
| `https://<dominio>/api/tournaments/webhook` | `checkout.session.completed` | `STRIPE_WEBHOOK_SECRET` |
| `https://<dominio>/api/subscription/webhook` | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` | `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` |

Copia el `whsec_…` que da cada endpoint a su variable y **redeploy** (las env
nuevas exigen redeploy).

> Si solo vas a por torneos, basta el primer endpoint + `STRIPE_WEBHOOK_SECRET`.

---

## 4. Email (Resend)

- Verifica tu **dominio** en Resend y pon `EMAIL_FROM` con ese dominio.
- Sin `RESEND_API_KEY` el checkout responde `emailed:false` y no rompe, pero la
  app no recibiría el enlace de pago → imprescindible para el flujo móvil.

---

## 5. Vuelta a la app tras pagar (ya está en el código)

Flujo desde el móvil (respeta las reglas de Apple):

1. App → `/api/tournaments/[id]/checkout` con `deliver:"email"`.
2. El enlace de Stripe llega por **correo** (la app nunca lo muestra).
3. El usuario paga en Stripe (navegador).
4. Webhook → torneo `paid` + publicado.
5. Stripe vuelve a `/torneos/pago-ok?src=app` → botón **"Volver a la app"** con
   deep link `tactium://tournament/{id}?paid=1` (+ intento automático a los 15s).

Verifica solo que el **build publicado de la app** enruta ese `tactium://…`
(ya implementado; es cosa de la store, no de la web).

---

## 6. Verificación post-deploy (humo)

1. Con claves **test**, crea un torneo de pago desde un club sin plan.
2. Lanza el checkout → paga con tarjeta de test `4242 4242 4242 4242`.
3. Comprueba en el panel de Stripe que llega `checkout.session.completed` con
   **200** al endpoint.
4. El torneo pasa a `billing_status='paid'` y, si estaba en borrador, a `open`.
5. Repite el checkout del mismo torneo → debe devolver `{paid:true}` sin cobrar
   (anti doble cobro).
6. Cuando cuadre, cambia a claves **live**.

---

## 7. Notas

- **Solo-lectura**: deja `NEXT_PUBLIC_TACTIUM_WRITES=off` mientras el frontend
  no esté pulido. El cobro de torneos (servidor) funciona igual; solo se
  bloquean escrituras de la UI web.
- **No hace falta anunciar la URL** todavía: el consumidor real ahora es la app.
- **Apagar el cobro**: quita `STRIPE_SECRET_KEY` (vuelve a 503) o borra los
  endpoints del webhook.
- **Supabase**: si usas login por OAuth/enlace mágico, añade el dominio de
  producción a las *Redirect URLs* del proyecto Supabase.
