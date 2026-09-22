# PROMPT — Vídeo explicativo del ecosistema TACTIUM

> Copia desde la línea de abajo hasta el final y pégalo en Claude Design.

---

Quiero que crees un **vídeo explicativo de unos 3 minutos** que presente el ecosistema completo de **TACTIUM**, mi plataforma de gestión de equipos y competiciones de pádel. El vídeo es mi **proyecto final para una academia** (lo evalúa un tribunal para darme el título), así que tiene que demostrar dos cosas a la vez: que el producto es real y completo, y que detrás hay una arquitectura técnica seria. Un dato que debe quedar claro en el vídeo: **todo el ecosistema lo he desarrollado yo solo en 12 meses, desde agosto de 2025 hasta hoy**. Tono profesional, ritmo ágil, sin humor ni estética "gaming".

## Identidad de marca (obligatoria, no inventes otra)

- **Fondo:** verde-negro `#030F0F` (el vídeo es 100% tema oscuro, es la firma de la marca).
- **Accent único:** verde `#00DF82` para CTAs, highlights, indicadores, líneas de conexión y datos clave. Un solo accent por composición, nunca dos colores compitiendo.
- **Secundario:** verde profundo `#03624C` para superficies, tarjetas y divisores sutiles.
- **Texto:** blanco suave `#E8F5EF` (nunca blanco puro).
- **Tipografías:** **Satoshi** (pesos 400/500/700/900 — no existen 600 ni 800) para titulares y cuerpo; **JetBrains Mono** para datos, cifras, códigos y "eyebrows" (siempre tabular-nums).
- **Estética:** geométrica, modular, basada en grid, tipo Linear / Vercel / Stripe Dashboard. Nada de degradados llamativos, sombras duras, mascotas ni neón excesivo. El glow verde sutil sí es marca de la casa.
- **Logo:** monograma "T" táctico minimalista; inline se dibuja como tesela cuadrada redondeada con relleno `#03624C` y la T en verde accent.
- Personalidad: **El Estratega** — preciso, táctico, premium-tech. Debe sentirse como un "sistema operativo deportivo de precisión".

## Estructura del vídeo, escena a escena

### Escena 1 — Gancho (0:00–0:15)
Pantalla oscura, aparece el monograma T con un pulso de glow verde y el wordmark TACTIUM. Voz en off / texto:
"Cada semana, miles de capitanes de pádel gestionan sus equipos con WhatsApp, Excel y capturas de pantalla. TACTIUM lo sustituye todo."
Cierre del gancho: "Una plataforma. Todo el ecosistema del pádel de equipos."

### Escena 2 — El problema (0:15–0:30)
Composición caótica: burbujas de chat, hojas de cálculo, fotos de calendarios en papel, todo en gris apagado. Voz:
"Convocatorias por chat, disponibilidad a mano, resultados perdidos, torneos organizados en papel y la información de la federación dispersa en webs antiguas."
Transición: todo el caos colapsa y se ordena en una interfaz TACTIUM.

### Escena 3 — La app móvil, el núcleo (0:30–1:05)
Mockups de móvil (iPhone) flotando sobre el fondo oscuro, con micro-animaciones. Presentar en ráfaga las capacidades clave, cada una con un rótulo corto en JetBrains Mono:
- **Equipos y alineaciones** — plantilla, disponibilidad de jugadores por jornada y generador de alineaciones.
- **Temporada y resultados** — jornadas, cruces, resultados (incluida la lógica de W.O.) y estadísticas.
- **Torneos** — creación de torneos con fase de grupos + eliminatoria, cuadro de consolación, elegibilidad por categoría y género, y rejilla de horarios pista a pista.
- **Escáner con IA** — fotografías un calendario o un ranking en papel y la app lo convierte en datos estructurados.
- **Capa social** — perfiles de jugador con nombre de usuario, seguir a jugadores y clubes, feed de novedades, partidos amistosos con foto compartible y cara a cara (H2H).
- **Notificaciones** — push server-side (alineación publicada, recordatorios de disponibilidad) y campanita de avisos in-app.
- **Doble tema** — modo claro y oscuro con el mismo sistema de tokens.
Voz: "El núcleo es la app móvil: iOS y Android desde una sola base de código con React Native y Expo."

### Escena 4 — Integración con la Federación (1:05–1:25)
Visual: datos "fluyendo" desde una fuente externa hacia TACTIUM (líneas verdes animadas sobre grid). Voz:
"TACTIUM se integra con la Federación Cántabra de Pádel: un agente propio sincroniza rankings, clasificaciones, cuadros de playoff y resultados oficiales, y los sirve dentro de la app y de la web. Al inscribirte en un torneo, la app ya sabe tus puntos federados y valida si puedes jugar esa categoría."
Rótulo: `AGENTE DE DATOS → SUPABASE → APP + WEB`.

### Escena 5 — La web app y la landing (1:25–1:50)
Mockups de navegador (portátil) junto al móvil. Voz:
"El ecosistema no vive solo en el móvil. En app.tactium.io cualquier jugador se inscribe a un torneo desde el navegador y paga con Stripe — incluso a dos categorías a la vez, con validación de elegibilidad y emails de confirmación automáticos. Y en tactium.io, la landing pública presenta el producto."
Rótulos: `tactium.io — landing` · `app.tactium.io — web app` · `Stripe Checkout` · `emails transaccionales`.

### Escena 6 — Arquitectura técnica (1:50–2:20)
Diagrama animado de arquitectura sobre el grid, construyéndose pieza a pieza con líneas verdes. Nodos:
- **App móvil** — React Native + Expo (iOS y Android), actualizaciones OTA con EAS.
- **Web app + landing** — Next.js desplegado en Vercel.
- **Backend** — Supabase: PostgreSQL con Row Level Security, RPCs, Edge Functions y tareas cron (recordatorios diarios, push).
- **Pagos** — RevenueCat + compras in-app en móvil; Stripe en web (modelo Spotify/Notion).
- **Agente de federación** — Node.js, scraping y sincronización de datos oficiales.
- **Emails** — Resend.
Voz: "Una sola base de datos con seguridad a nivel de fila alimenta la app, la web y al agente de la federación. Los pagos siguen el modelo de Spotify: compras in-app en el móvil, Stripe en la web."

### Escena 7 — Modelo de negocio (2:20–2:40)
Tres tarjetas de planes (Starter · Pro · Elite) en estilo pricing dark, más una cuarta pieza "pago por torneo". Voz:
"Modelo freemium con prueba invertida: entras gratis, montas tu club y tu equipo, y las acciones productivas activan la suscripción. Tres planes para clubes y capitanes, y cobro por torneo para quien solo organiza competiciones."

### Escena 8 — Cierre (2:40–3:00)
Vuelve el monograma T con glow. Métricas-resumen en JetBrains Mono apareciendo en cascada:
`12 MESES · 1 DESARROLLADOR · 2 APPS NATIVAS · WEB APP · LANDING · AGENTE DE FEDERACIÓN · +90 POLÍTICAS RLS · PAGOS IAP + STRIPE · PUSH + EMAILS`
Voz: "Todo esto — las apps, la web, el backend y el agente de la federación — lo he diseñado, construido y desplegado yo solo en doce meses, de agosto de 2025 a agosto de 2026. TACTIUM: el sistema operativo del pádel de equipos."
Cierre final: wordmark TACTIUM + "tactium.io".

## Indicaciones de producción

- Formato **16:9 horizontal** (se proyectará ante un tribunal).
- Transiciones limpias: fundidos rápidos, desplazamientos sobre grid, nada de zooms bruscos.
- Los mockups de interfaz que generes deben respetar el sistema de color y tipografía de arriba; si necesitas inventar pantallas, que parezcan un dashboard táctico (tarjetas sobre `#030F0F`, bordes hairline `#03624C`, datos en JetBrains Mono verde).
- Texto en pantalla siempre en español, frases cortas, máximo una idea por plano.
- Si generas locución, voz masculina joven en castellano de España, tono seguro y cercano, sin sobreactuar.
