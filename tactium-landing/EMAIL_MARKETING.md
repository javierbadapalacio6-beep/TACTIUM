# Email marketing · TACTIUM

Montado sobre **Resend** (envío) + **Supabase** (lista, tabla `waitlist`).
Remitente actual: `EMAIL_FROM` en `.env.local` (hoy `TACTIUM <hola@tactium.io>`).

## Newsletter (envío recurrente)

1. Edita el contenido en **`scripts/newsletter-content.ts`**
   (asunto, titular, párrafos, CTA y `campaignId` — cámbialo en cada envío).
2. Comandos:

   - `npm run newsletter:preview` → genera `scripts/newsletter-preview.html`
   - `npm run newsletter:test` → te lo envía a ti (`testTo` del archivo)
   - `npm run newsletter:dry-run` → lista destinatarios, NO envía
   - `npm run newsletter:send` → envía a toda la lista

El log `scripts/.newsletter-<campaignId>.log` evita reenviar la misma
campaña dos veces. Para una newsletter nueva, cambia `campaignId`.

## Bienvenida automática (si se reactiva la captación)

`app/api/waitlist/route.ts` envía `WelcomeAppLive` (carta con enlace de
descarga) a cada nuevo registro. Solo se dispara si el formulario de alta
está activo.

## Email de lanzamiento (ya enviado)

- `npm run email:launch` (versión visual) / `--plain` (versión sobria).
- Reenvía solo a gente nueva (log `scripts/.launch-sent.log`).

## Mejorar entregabilidad (caer en Principal, no Promociones)

- Remitente con nombre de persona: `Javier de TACTIUM <javier@tactium.io>`.
- Menos imágenes y un solo enlace (las plantillas "plain" ya lo hacen).
- Pedir a la gente que te añada a contactos.
