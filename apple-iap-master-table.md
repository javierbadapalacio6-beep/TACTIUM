# TACTIUM · Tabla maestra IAP — App Store Connect

> Documento de referencia para crear los 8 productos de suscripción en App Store Connect.
> **Subscription Group ya creado:** `TACTIUM Pro`
> **Bundle ID:** `io.tactium.app`
> **Free trial:** 14 días (Introductory Offer, New subscribers, todos los productos)

---

## 1. Resumen rápido — checklist de los 8 productos

| # | Plan | Product ID | Precio | Level | Estado |
|---|---|---|---|---|---|
| 1 | Capitán Mensual | `tactium_captain_monthly` | 4,99 € | 4 | ✅ Activo |
| 2 | Capitán Anual | `tactium_captain_yearly` | 47,99 € | 4 | ✅ Activo |
| 3 | Club Starter Mensual | `tactium_club_starter_monthly` | 11,99 € | 3 | ✅ Activo |
| 4 | Club Starter Anual | `tactium_club_starter_yearly` | 115,99 € | 3 | ✅ Activo |
| 5 | Club Pro Mensual | `tactium_club_pro_monthly` | 24,99 € | 2 | ✅ Activo |
| 6 | Club Pro Anual | `tactium_club_pro_yearly` | 239,99 € | 2 | ✅ Activo |
| 7 | Club Elite Mensual | `tactium_club_elite_monthly` | 39,99 € | 1 | ✅ Activo |
| 8 | Club Elite Anual | `tactium_club_elite_yearly` | 384,99 € | 1 | ✅ Activo |

> **Precios anuales actualizados al tier real aceptado por Apple** (los planificados originalmente — 47,90 / 115,10 / 239,90 / 383,90 € — no estaban en tiers válidos; Apple subió al siguiente). Levels reordenados según convención correcta: **1 = más premium** (Elite), 4 = menos premium (Capitán).

> **Importante sobre Levels:** Apple usa el "Subscription Rank" para los upgrades/downgrades automáticos. Productos del mismo `tier` (ej. Starter Mensual + Starter Anual) llevan **el mismo Level**. Apple ordenará los upgrades del Level más alto (4 = Elite) al más bajo (1 = Capitán).

---

## 2. Ficha por producto — copy / paste directo

### Campos comunes (los mismos en los 8)

- **Subscription Group:** `TACTIUM Pro`
- **Cleared for Sale:** ON (cuando ya estén completos)
- **Family Sharing:** OFF (suscripción individual, sin compartir entre Family)
- **Introductory Offer (Free Trial):**
  - Type: `Free`
  - Duration: `14 days` (Apple lo llama "2 weeks")
  - Eligibility: `New subscribers` (los que nunca suscribieron a ningún producto del grupo)
  - Countries: `All countries / regions where the subscription is available`

> **Apple price tier:** seleccionar el precio en € España y dejar que Apple calcule el equivalente en otros mercados ("Use Suggested Equivalents"). Si después quieres precios psicológicos (4,99$ USA en vez de la conversión literal) los ajustas país por país.

---

### Producto 1 · Capitán Mensual

```
Reference Name:    TACTIUM Captain Monthly
Product ID:        tactium_captain_monthly
Subscription Duration: 1 Month
Subscription Level (Rank): 1
Price (España):    4,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Capitán Mensual          (15 chars / 30)
  Description:                1 equipo · alineaciones IA · mensual   (43 / 45)
```

### Producto 2 · Capitán Anual

```
Reference Name:    TACTIUM Captain Yearly
Product ID:        tactium_captain_yearly
Subscription Duration: 1 Year
Subscription Level (Rank): 4
Price (España):    47,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Capitán Anual            (13 / 30)
  Description:                1 equipo · alineaciones IA · anual     (41 / 45)
```

### Producto 3 · Club Starter Mensual

```
Reference Name:    TACTIUM Club Starter Monthly
Product ID:        tactium_club_starter_monthly
Subscription Duration: 1 Month
Subscription Level (Rank): 3
Price (España):    11,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Starter Mensual     (20 / 30)
  Description:                Hasta 3 equipos · panel club · mensual (43 / 45)
```

### Producto 4 · Club Starter Anual

```
Reference Name:    TACTIUM Club Starter Yearly
Product ID:        tactium_club_starter_yearly
Subscription Duration: 1 Year
Subscription Level (Rank): 3
Price (España):    115,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Starter Anual       (18 / 30)
  Description:                Hasta 3 equipos · panel club · anual   (41 / 45)
```

### Producto 5 · Club Pro Mensual

```
Reference Name:    TACTIUM Club Pro Monthly
Product ID:        tactium_club_pro_monthly
Subscription Duration: 1 Month
Subscription Level (Rank): 2
Price (España):    24,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Pro Mensual         (16 / 30)
  Description:                10 equipos · multi-categoría · mensual (43 / 45)
```

### Producto 6 · Club Pro Anual

```
Reference Name:    TACTIUM Club Pro Yearly
Product ID:        tactium_club_pro_yearly
Subscription Duration: 1 Year
Subscription Level (Rank): 2
Price (España):    239,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Pro Anual           (14 / 30)
  Description:                10 equipos · multi-categoría · anual   (41 / 45)
```

### Producto 7 · Club Elite Mensual

```
Reference Name:    TACTIUM Club Elite Monthly
Product ID:        tactium_club_elite_monthly
Subscription Duration: 1 Month
Subscription Level (Rank): 1
Price (España):    39,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Elite Mensual       (18 / 30)
  Description:                25 equipos · reporting pro · mensual   (41 / 45)
```

### Producto 8 · Club Elite Anual

```
Reference Name:    TACTIUM Club Elite Yearly
Product ID:        tactium_club_elite_yearly
Subscription Duration: 1 Year
Subscription Level (Rank): 1
Price (España):    384,99 €

Localization · Spanish (Spain):
  Subscription Display Name: Club Elite Anual         (16 / 30)
  Description:                25 equipos · reporting pro · anual     (39 / 45)
```

---

## 3. Pasos exactos en App Store Connect (repite × 7)

Apple suele cambiar la UI cada pocos meses; los nombres pueden variar ligeramente.

1. **App Store Connect → My Apps → TACTIUM → Monetization → Subscriptions**
2. Dentro del grupo **TACTIUM Pro** → botón `+` para crear una nueva subscription
3. Rellena **Reference Name** + **Product ID** (irreversible — copia los del bloque exacto)
4. Selecciona **Subscription Duration** (1 Month o 1 Year)
5. **Subscription Level (Rank)** → 1, 2, 3 o 4 según el plan
6. **Subscription Prices** → `+` → España → tier que coincida con el precio (Apple muestra el €) → `Use Suggested Equivalents` para los demás países → Save
7. **Localization** → `+` → Spanish (Spain) → pegar Display Name + Description del bloque → Save
8. **App Store Promotion** → puedes dejarlo vacío en esta fase (es opcional)
9. **Review Information**:
   - **Screenshot** (1024 × 1024 o 640 × 920 según device — Apple acepta cualquier device size del paywall). Si aún no tienes paywall en la app, sube uno de los mockups Soul de `public/social/avatar/` (ej. `lineup-bench.png`) y en Review Notes explica que la pantalla real llegará con el primer build.
   - **Review Notes (ES o EN, da igual):**
     ```
     This is a subscription product for TACTIUM, a SaaS for federated padel teams.
     The captain/club gets access to AI-driven lineups, season stats and team admin.
     Free trial of 14 days for new subscribers. Auto-renews until canceled.
     Test account credentials and a sandbox tester will be provided with the first
     build submission. Paywall screen will be visible inside the app once it is
     uploaded for review.
     ```
10. **Introductory Offers** → `Create Introductory Offer`:
    - Countries: All
    - Start date: today
    - No end date (siempre activo para new subscribers)
    - Type: Free
    - Duration: 2 Weeks
    - Eligibility: New Subscribers
    - Save
11. Status objetivo del producto cuando termines: **Ready to Submit** (verde/amarillo). Pasará a **Waiting for Review** cuando subas el primer build con un screenshot real.

---

## 4. Diferencia entre Display Name y Description

Apple expone los dos campos al usuario en sitios distintos:

- **Subscription Display Name** (≤30) → es el nombre que el usuario verá en *Ajustes → Suscripciones* y en el sheet nativo de StoreKit. Aquí va el nombre del plan + período (`Club Pro Anual`).
- **Description** (≤45) → es la frase corta debajo del nombre en el sheet de StoreKit y en review. Aquí va el value-prop ultra resumido (`10 equipos · multi-categoría · anual`).

Hay un tercer campo, el **App Name for Display** (en App Information), que es el nombre comercial — eso ya lo tienes como `TACTIUM`.

---

## 5. Errores comunes que vas a evitar

- **No marcar Family Sharing.** Una vez activado no se puede desactivar sin borrar el producto. Para SaaS de equipos lo correcto es OFF.
- **No mezclar Levels entre mensual/anual del mismo plan.** Captain Mensual y Captain Anual ambos en Level 1. Si pones uno en Level 1 y otro en Level 2, Apple ofrecerá upgrades raros.
- **No olvidar el Introductory Offer.** Si lo creas después de que un usuario ya suscribió, ese usuario no entra en "New Subscribers" y no obtiene el trial. Mejor crearlo desde el inicio.
- **No usar emojis ni caracteres especiales en Product ID.** Solo `[a-z0-9_]`. Los Product IDs son IRREVERSIBLES.
- **No traducir Reference Name.** Es interno, no se enseña. Mantén el patrón `TACTIUM [Plan] [Period]` para que sea greppable en App Store Connect.

---

## 6. Después de los 8 productos

Cuando los 8 estén en `Ready to Submit`:

1. **Generar los 100 Offer Codes** para waitlist (30 días extra) — Subscriptions → Offer Codes → batch upload CSV
2. **Replicar los 8 productos en Google Play Console** con los mismos Product IDs
3. **Integración técnica IAP** (sesión técnica aparte — RevenueCat recomendado para evitar dos integraciones nativas distintas)
4. Los productos solo entran en estado `Approved` cuando submits el primer build con el paywall real. Hasta entonces se quedan `Ready to Submit`.
