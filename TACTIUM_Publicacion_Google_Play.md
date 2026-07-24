# TACTIUM · Guía de publicación en Google Play

**App:** TACTIUM · `io.tactium.app` · versión 1.1.0
**Estado:** app aprobada por Google Play ✅ (jul-2026)
**Build de referencia:** `builds/tactium-build8-vc4.aab`

Ahora que Google aprobó la revisión, se **desbloquea el catálogo de suscripciones** (el blocker era tener un AAB subido a un track; ya lo tienes). Sigue estas 4 fases en orden.

---

## Fase 0 — Confirmar qué track se aprobó (2 min)

Antes de nada, mira en **Play Console → Publicación → Panel** en qué track está la build aprobada:

- Si está en **Testing (interno/cerrado)** → perfecto para crear y probar el catálogo IAP antes de producción.
- Si ya está en **Producción** → igualmente puedes crear el catálogo; los productos son a nivel de app, no de track.

Da igual el track: el AAB subido es lo que desbloquea el botón de suscripciones. Continúa.

---

## Fase 1 — Crear el catálogo de suscripciones (lo desbloqueado)

Ruta: **Monetizar con Play → Productos → Suscripciones**.

En Google el modelo es en 3 niveles (distinto a Apple):
**Suscripción** (el tier) → **Base plans** (mensual / anual) → **Offers** (los 14 días gratis).

### Recomendación de estructura

Crea **4 suscripciones** (una por plan), cada una con **2 base plans** (mensual + anual) = 8 planes de compra, replicando exactamente los 8 productos de Apple. Usa IDs que coincidan con lo que espera tu código (`plans.ts`), típicamente `tactium_captain`, base plans `monthly` / `annual`.

> ⚠️ El **base plan ID no se puede cambiar ni reutilizar** una vez activado. Decide la convención antes de crear.

### Precios (Apple = fuente de verdad — deben coincidir)

| Plan | Suscripción (ID) | Base plan mensual | Base plan anual |
|---|---|---|---|
| Capitán | `tactium_captain` | **4,99 €** | **47,99 €** |
| Club Starter | `tactium_club_starter` | **11,99 €** | **115,99 €** |
| Club Pro | `tactium_club_pro` | **24,99 €** | **239,99 €** |
| Club Elite | `tactium_club_elite` | **39,99 €** | **384,99 €** |

Fija el precio en **EUR como base** y revisa la conversión automática por país antes de guardar (Google no hace el "tier-snapping" de Apple, así que aquí los precios pueden quedar exactos).

### Pasos por cada suscripción

1. **Add subscription** → nombre + ID del tier.
2. **Add base plan** → ID (`monthly` / `annual`), tipo de renovación **Auto-renewing**, periodo (1 mes / 1 año), precio de la tabla.
3. **Add offer** (para los 14 días gratis):
   - Elegibilidad: **New customer acquisition**.
   - **Add phase → Free trial → 14 días**.
   - Guarda.
4. **Activa** la suscripción, cada base plan y cada offer (nacen inactivos; si no los activas, no se venden).

Repite para los 4 tiers → 8 base plans + 8 trials.

### Antes de crear productos, verifica que esté listo (si no, aparecerá bloqueo)

- Perfil de pagos completo, cuenta bancaria y grupo de cuentas.
- Programa de tarifa de servicio del 15% activado.
- Plantilla de impuestos/precios revisada.

---

## Fase 2 — Completar los requisitos de ficha (obligatorios para producción)

Google no deja publicar en producción sin estas secciones en verde. Revisa **Política y programas → App content**:

- **Clasificación de contenido** — cuestionario IARC.
- **Seguridad de los datos (Data safety)** — declara qué datos recoge TACTIUM (cámara, fotos, cuenta/login, notificaciones) según los permisos de `app.json`.
- **Público objetivo y contenido** — rango de edad.
- **Anuncios** — declara si hay o no publicidad.
- **Política de privacidad** — URL pública obligatoria (puedes usar la de `tactium-landing`).
- **Acceso a la app (App access)** — TACTIUM tiene login (Apple Sign In / auth). **Da credenciales de prueba a Google** o el revisor no podrá entrar y rechazará el release.
- **Ficha principal (Store listing)** — descripción corta/larga, icono, feature graphic, y **screenshots** (tienes material en `tactium-landing/Screens APP` y `SCREENS/`).

---

## Fase 3 — Sacar a producción

Ruta: **Producción → Crear nueva versión** (o **Promover** la build ya aprobada desde el track de testing).

1. Añade el AAB (o promociona el ya subido — evita rebuild innecesario).
2. **Países / regiones** de disponibilidad.
3. Notas de la versión (ES + idiomas).
4. **Rollout escalonado**: empieza en 10–20 % y sube gradualmente.
5. Revisa **Publicación gestionada (Managed publishing)**: si está activada, los cambios esperan a que pulses "Publicar".
6. Enviar a revisión → producción.

---

## Notas técnicas TACTIUM

- `eas.json` usa `appVersionSource: "remote"`: EAS gestiona el `versionCode`, se auto-incrementa en cada build. No lo edites a mano en `app.json`.
- Al subir un build nuevo, sube el `versionCode`; Google rechaza duplicados.
- Tras crear el catálogo, **prueba una compra real en Internal Testing** (con una cuenta de tester y tarjeta de licencia) antes del rollout de producción.
- Cuando toques `TACTIUM/src/core/subscriptions/plans.ts` o `tactium-landing/lib/plans.ts`, confirma que los precios anuales sean **47,99 / 115,99 / 239,99 / 384,99 €** (coinciden con Apple y Google).

---

## Checklist rápido

- [ ] Fase 0 — Confirmado el track aprobado
- [ ] Fase 1 — 4 suscripciones × 2 base plans creados y **activados**
- [ ] Fase 1 — Offer de 14 días gratis en los 8 base plans
- [ ] Fase 1 — Precios EUR verificados = Apple
- [ ] Fase 2 — App content todo en verde (data safety, rating, app access con credenciales, privacidad, screenshots)
- [ ] Fase 3 — Release de producción con rollout escalonado
- [ ] Prueba de compra real en Internal Testing OK
