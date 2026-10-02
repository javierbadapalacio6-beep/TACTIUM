# TACTIUM — Memoria técnica del Trabajo Final

**Alumno:** Javier Bada Palacio
**Programa:** Especialista en Programación con IA · Racks Academy
**Proyecto:** TACTIUM, la plataforma del pádel por equipos y de competición (app iOS/Android + web tactium.io)
**Fecha:** octubre de 2026

---

## 1. El problema que resuelve y su impacto actual

### El problema

El pádel por equipos (ligas federadas e interclubs) se organiza hoy con WhatsApp, hojas de Excel y la web de la federación.

- **El capitán** de un equipo de liga tiene que alinear cada jornada el número de parejas que exige su competición, que cambia según la federación y la liga (por ejemplo, 5 parejas en la masculina de la Liga Cántabra y 3 en muchas autonómicas). Además, debe ordenarlas según las reglas de puntos de esa competición (en muchas, la pareja 1 debe sumar más puntos que la 2, y así sucesivamente). Pregunta uno a uno quién puede jugar, lo cuadra a mano, apunta resultados y lleva la clasificación en una hoja.
- **El jugador** no sabe si está convocado, con quién juega ni cómo va su equipo hasta que alguien lo escribe en el grupo.
- **El club** gestiona varios equipos y organiza torneos con hojas de cálculo: inscripciones, cobros, cuadros, horarios y consolación, todo a mano.
- **Los datos federativos** (rankings, actas, calendarios, clasificaciones) están dispersos en la web de la federación, sin un formato práctico para el día a día.

### La solución

TACTIUM reúne todo en una sola herramienta:

| Para quién | Qué hace TACTIUM |
|---|---|
| Capitán | Elige su federación y su liga, y TACTIUM ajusta cuántas parejas alinear y valida el orden por puntos según sus reglas. Además: plantilla con puntos federativos, disponibilidad en un toque (Voy / Duda / No), alineaciones con variantes, resultados y clasificación automática |
| Jugador | Su convocatoria, su pareja, sus estadísticas, perfil social, partidos amistosos, notificaciones push |
| Club | Panel multi-equipo con alta de equipos y puntos federativos detectados automáticamente, organización de torneos (grupos, eliminatoria, consolación, rejilla horaria), inscripción online con pago y cobro con Stripe Connect |
| Federación | Datos oficiales de la Federación Cántabra integrados: rankings, actas, grupos, clasificaciones y cuadros de playoff |

Escáner con IA: el capitán hace una foto al ranking o al calendario oficial y la app lo convierte en plantilla o en jornadas sin teclear nada.

### Impacto actual: fase piloto (02-10-2026)

**Dónde está hoy TACTIUM:**

- **En producción:** la app está publicada en App Store y Google Play (versión 1.4.2) y la web funciona en tactium.io con las mismas funciones.
- **Piloto real con un club de Cantabria:** es el primer cliente con el que se trabaja día a día, y su uso marca las mejoras.
- **Primeros usuarios reales y alguna suscripción de pago**, con el modelo de negocio ya activo: suscripción con prueba de 14 días (compras integradas en móvil con RevenueCat, Stripe en web) y comisión por torneo cobrado.
- **Datos federativos integrados de verdad:** 33.428 jugadores, 14.912 partidos, 67.076 actas y 148.780 instantáneas de ranking de la Federación Cántabra de Pádel.
- **Relación con el sector:** reuniones con clubes de la zona. La Federación Cántabra es la primera federación integrada.

**Transparencia sobre las cifras de la base de datos.** En total hay 52 cuentas, 7 clubes, 28 equipos, 419 resultados y 122 eventos de suscripción. **Muchos de ellos son de prueba o de demostración**: cuentas de QA, la cuenta de revisión de Apple, clubes demo para enseñar el producto y compras de prueba en las tiendas. No deben leerse como tracción comercial. Demuestran que el producto funciona de punta a punta: alta, alineaciones, resultados, cobros y suscripciones.

El valor actual no está en el volumen, sino en tener un producto completo en producción, validándose con un club real.

---

## 2. Herramientas de IA utilizadas y cómo se aplicaron

La IA se ha usado en tres niveles: **para construir** el producto, **dentro** del producto y **para comercializarlo**.

### 2.1 IA para construir (desarrollo)

| Herramienta | Uso concreto |
|---|---|
| **Bolt** | Prototipo inicial de 4PADEL (el proyecto del curso del que nace TACTIUM): la primera estructura en Next.js |
| **Cursor AI** | Desarrollo durante el curso (4PADEL/PADELHUB y el proyecto Airbnb), con reglas (`.cursor/rules`) para guiar al modelo |
| **Claude Code (Anthropic)** | Herramienta principal de TACTIUM: **473 de los 516 commits** están coescritos con Claude. Arquitectura, migraciones SQL, pantallas, depuración, revisión de código y releases |
| **Servidores MCP** | Supabase (consultas, migraciones y funciones Edge desde el agente), Playwright (pruebas de navegador), Figma, Gmail, Stripe |
| **Skills y subagentes** | Unas 70 skills y agentes propios: revisor visual, crítico de diseño, guionista de redes, scraper de la federación, etc. |
| **Memoria persistente del agente** | Más de 100 notas de decisiones, gotchas y estados de release que el agente consulta en cada sesión, lo que permite trabajar meses sin perder el contexto |
| **Claude Design** | Exploración visual de la landing y del sistema de diseño |

### 2.2 IA dentro del producto

| Función | Tecnología | Detalle |
|---|---|---|
| **Escáner de ranking y calendario** | Google **Gemini 2.5 Flash** (visión + salida JSON con esquema) en una función Edge de Supabase | Lee fotos o PDF de rankings y calendarios. Entiende listas por jornadas y **tablas cruzadas** local × visitante. Reintentos con backoff ante errores 429/503 |
| **TACTIUM AI · análisis de vídeo** (I+D, proyecto aparte) | **YOLO11** + homografía + re-identificación propia | Detecta y sigue a los 4 jugadores en un vídeo de pádel y proyecta sus posiciones sobre la pista (2,51 px de error de calibración) |

### 2.3 IA para comercializar (Go to Market)

| Herramienta | Uso |
|---|---|
| **Remotion** (vídeo con código) + Claude | Reels y vídeos de producto generados por código con capturas reales de la app |
| **Whisper** (local) | Transcripción palabra a palabra para subtítulos tipo karaoke |
| **ElevenLabs** (vía fal) | Voces en off |
| **Kling** (vía fal) y **Gemini / Nano Banana** | Clips e imágenes generadas para carruseles y reels |
| **Higgsfield** | Avatares de vídeo |
| **Panel de contenido propio** | Dashboard local que genera carruseles y reels y publica en Instagram con funciones Edge (`redes-publicar`, `redes-telegram`) |

---

## 3. Proceso de desarrollo, métricas y evidencias

### 3.1 Línea temporal

| Fase | Fechas | Hitos |
|---|---|---|
| Curso Racks | 2025 | Proyecto Airbnb del temario (front + back + Stripe) y 4PADEL / PADELHUB con Bolt y Cursor |
| Arranque TACTIUM | mayo 2026 | Primer commit el 11-05-2026, proyecto Supabase en Frankfurt, landing, logo y backups semanales automáticos con GitHub Actions |
| MVP del capitán | mayo–junio | Plantillas, jornadas, alineaciones, resultados, escáner con IA, suscripciones con RevenueCat. Primeras versiones en tiendas (1.0.x, junio) |
| Capa de jugador y social | julio | 1.1.0 (capa de jugador, 09-07) y 1.2.0 aprobada en App Store y Google Play (~16-07): social, amistosos y push |
| Federación y torneos | julio–agosto | Integración con la Federación Cántabra, módulo de torneos completo, cobro con Stripe Connect |
| Web y madurez | agosto–septiembre | Web con paridad completa con la app, versiones 1.4.0 → 1.4.2, fusión de landing y app en tactium.io |
| Crecimiento | septiembre–octubre | Reels, carruseles, diagnóstico de Instagram con datos, colaboración con un club |

### 3.2 Métricas del desarrollo

| Métrica | Valor |
|---|---|
| Commits | **516** en **67 días** de trabajo (11-05 → 26-09-2026) |
| Commits por mes | mayo 43 · junio 46 · julio 119 · agosto 178 · septiembre 130 |
| Tipo de commit | 261 funcionalidades · 148 correcciones · 45 documentación · 34 mantenimiento |
| Commits coescritos con IA | **473 / 516 (92 %)** |
| App móvil (Expo / React Native) | **50 pantallas**, 220 ficheros, ~81.000 líneas de TypeScript |
| Web (Next.js) | **53 páginas**, 11 rutas API, ~42.000 líneas |
| Base de datos (Supabase / PostgreSQL 17) | **51 tablas**, **100 funciones**, **109 políticas RLS**, **68 migraciones** |
| Funciones Edge | 8 (escáner IA, webhook RevenueCat, push, email, búsqueda de sedes, federación, redes) |
| Vídeo (Remotion) | 28 componentes + 21 scripts de producción |
| Versiones publicadas | de la 1.0 a la **1.4.2** en iOS y Android, más actualizaciones OTA intermedias |

### 3.3 Arquitectura

```
App iOS/Android (Expo + RN)  ─┐
                              ├──► Supabase (Postgres + RLS + RPC + Auth + Storage + Edge Functions)
Web tactium.io (Next.js)  ────┘          │             │              │
                                         │             │              └─► Gemini (escáner)
            RevenueCat (compras) ────────┤             └─► Resend (emails) · Expo Push
            Stripe + Connect (web/torneos)┘
Agente federación (scraper) ──► tablas fcp_*  ──► ranking, actas, cuadros
```

- **Seguridad:** toda la lógica sensible vive en RPCs `SECURITY DEFINER` y en políticas RLS. El cliente nunca escribe directamente en las tablas críticas.
- **Pagos híbridos:** compras integradas en la app en móvil (exigido por Apple y Google) y Stripe en la web, con el mismo modelo de planes y la misma fuente de verdad.
- **Despliegue continuo:** Vercel para la web, EAS Build + Submit para las tiendas, EAS Update (OTA) para cambios JS sin pasar por revisión.

### 3.4 Método de trabajo con IA

1. **Plan antes de código:** documentos de plan HTML (web-app, federación) que el agente sigue por fases.
2. **Pequeños incrementos verificados:** cada cambio se prueba en el navegador, en el simulador o contra la base de datos antes del commit.
3. **Paridad app ↔ web:** regla fija de que cada cambio se hace en las dos superficies en la misma tanda.
4. **Memoria del proyecto:** las decisiones y los errores aprendidos se guardan como notas que la IA recupera, por ejemplo: «`eas submit --id` miente, verificar en App Store Connect» o «el importe facturado debe ser el más prominente en el paywall (Apple 3.1.2c)».
5. **Revisión por agentes:** revisor visual en móvil y escritorio, revisión de código y crítico de diseño antes de enseñar algo a clientes.

### 3.5 Evidencias

- App en App Store y Google Play (TACTIUM, `io.tactium.app`).
- Web en producción: **tactium.io** (portada, explorar torneos, comunidad, federación).
- Historial completo en git (516 commits con mensajes descriptivos).
- Capturas de las pantallas clave (anexo del deck) y vídeo de demostración.

---

## 4. Vinculación con los módulos del curso

| Módulo del curso | Aplicación en TACTIUM |
|---|---|
| **M1 Mentalidad & Setup** (rol de la IA, MVP) | Mentalidad MVP: primero el capitán (el dolor más agudo), después el club y los torneos. La IA como compañero de desarrollo desde el día 1 |
| **M2 Entorno y Herramientas** (Bolt, Cursor, Git, despliegue) | Bolt y Cursor en el origen (4PADEL). Git con 516 commits convencionales. Evolución natural a Claude Code como agente principal |
| **M3 Fundamentos** (pensar como desarrollador, componentes, stack) | División del problema por roles (capitán, jugador, club, federación). Arquitectura por *features* y componentes reutilizables (`ui.tsx`) |
| **M4–M5 Frontend: estructura del MVP y modularización** (rutas Next, rutas protegidas, checkout y mocks, Rules) | Web en Next.js con App Router, rutas públicas y privadas (`PUBLIC_ROUTES`), checkout de inscripción y suscripción, reglas para la IA (`CLAUDE.md`, memoria) |
| **M7–M9 Backend, MVC y CRUD** | En lugar de Express, backend *serverless* con Supabase: CRUD mediante RPCs y funciones Edge (Deno). Misma separación de responsabilidades que el MVC del curso |
| **M10 Documentar + Debugear** | Documentación en `docs/` (guía de estilo, planes, mejoras de torneos), comentarios con el *porqué*, depuración con logs de Supabase y Playwright |
| **M11 Base de datos** (.env, JWT, rutas protegidas, validación, QA + AI) | PostgreSQL con 109 políticas RLS y JWT de Supabase Auth, variables de entorno separadas por entorno, validación en RPC, QA asistida por IA |
| **M12 Integración Fase 1** (auth, MCP, Playwright, emails, hallazgos) | Login con Google y Apple, **MCP de Supabase y Playwright** en el día a día, emails transaccionales con Resend, repasos de bugs con informe de hallazgos (por ejemplo, el repaso de 9 bugs del 20-08) |
| **M13 Integración Fase 2** (quitar mocks) | Purga de los datos de maqueta: los precios salen de una única fuente (`lib/plans.ts`), y la web lee los datos reales por RPC |
| **M14 Plataforma de pago (Stripe)** | Stripe Checkout + webhooks + portal del cliente, **Stripe Connect** para pagar a los clubes con un 3 % de comisión, devolución automática, y además RevenueCat para las compras en la app |
| **M15–M16 Docker, build y deploy** (dominio, SSL) | Equivalente gestionado: Vercel (web, dominio tactium.io, SSL), EAS Build/Submit (tiendas), EAS Update (OTA), dominio propio de autenticación (login.tactium.io) |
| **Go to Market** (Lean, ICPs, propuesta de valor, canales) | ICPs definidos (capitán de liga, club organizador, federación), *reverse trial* de 14 días, Instagram con reels y carruseles, colaboración con clubes, federación como canal de distribución |

---

## 5. Conclusiones y lecciones aprendidas

### Conclusiones

- Con IA, **una sola persona ha construido y lanzado** una plataforma completa: dos apps nativas, una web, backend, pagos, integración con datos oficiales y marketing, en unos 5 meses.
- El curso dio la **base y el método**: MVP, frontend → backend → integración → pagos → deploy → go to market. TACTIUM recorre ese mismo camino a escala real.
- La IA no sustituye al criterio: **multiplica** a quien sabe qué construir, cómo verificarlo y cuándo parar.

### Lecciones aprendidas

1. **Verificar siempre, no fiarse del «hecho».** Ejemplo real: `eas submit` informaba de un envío correcto que no había llegado a App Store Connect. Desde entonces se verifica en la fuente.
2. **La memoria es la ventaja.** Guardar decisiones y gotchas evita repetir errores y permite retomar el trabajo meses después sin perder contexto.
3. **Seguridad desde la base de datos.** RLS y RPCs en lugar de confiar en el cliente. Y los secretos nunca en el código: una clave de API embebida en una función es un riesgo que hay que rotar.
4. **Las tiendas imponen reglas de producto.** Apple exige compras integradas en móvil y que el importe facturado sea lo más prominente del paywall. Eso obligó a un modelo de pago híbrido.
5. **Medir el marketing con datos, no con intuición.** El diagnóstico de Instagram mostró que los reels horizontales retenían la mitad que los verticales, y se cambió el formato.
6. **Lanzar pronto y mejorar en producción.** Las actualizaciones OTA permiten corregir en horas. La primera versión llegó a las tiendas unas 6 semanas después del primer commit.
7. **No inflar el impacto.** Primero una federación (la Cántabra) bien hecha. Las demás irán entrando.

### Próximos pasos

- Crecer en clubes y equipos de la Liga Cántabra.
- Ampliar la integración a más federaciones.
- Llevar TACTIUM AI (análisis de vídeo) del laboratorio a la app.
