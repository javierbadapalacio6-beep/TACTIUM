# SEO de TACTIUM · estado, hallazgos y hoja de ruta

Documento vivo del agente `experto-seo` (`~/.claude/agents/experto-seo.md`). Primera auditoría: 10-10-2026,
medida contra `https://tactium.io` en producción. Certeza: ✅ medido o documentado por Google/Meta · 🟡 práctica
aceptada por el sector, no verificada aquí · ⚪ hipótesis a probar.

**Límite honesto:** desde aquí NO se ve Google Search Console ni el posicionamiento real. Todo lo que dice
«Google no indexa X» es una hipótesis hasta que alguien pegue los datos de Search Console. Sin eso, el agente audita
lo técnico y propone; no puede medir resultados.

## 1. Estado medido (10-10-2026) ✅

| Qué | Dato |
|---|---|
| Dominio canónico | `tactium.io`; `app.` y `www.` redirigen con 308 |
| `robots.txt` | Permite todo menos rutas privadas, `/d/` y `/directo` (enlaces de WhatsApp, no se indexan); apunta al sitemap |
| `sitemap.xml` | **2.525 URLs**: 599 grupos + 1.914 equipos de la federación (temporadas 2021-2026) + 12 páginas (portada, torneos, federación, comunidad, pro, legales) |
| Portada | Título «TACTIUM · App para equipos de pádel federado · Liga Cántabra», descripción que abre con la definición, JSON-LD (Organization, WebSite con nombres alternativos, SoftwareApplication, FAQPage). **Desplegado hoy.** |
| Páginas de grupo y equipo | Título y descripción propios y canónica correcta; un `<h1>`; JSON-LD |
| `hreflang` | Ninguno (un solo idioma, es-ES): correcto |
| Velocidad (servidor) | Portada 0,4 s · torneos 0,3 s · grupo 0,6-1,8 s · equipo 1,5 s · federación/cántabra 1,5 s (226 KB) |
| **Caché** (antes del 11-10) | Las páginas de la federación se sirven con `Cache-Control: private, no-cache, no-store` y `X-Vercel-Cache: MISS`: se renderizan en cada visita porque el layout raíz lee la sesión. Desde el 11-10 los datos van en caché de datos (ver P0 n.º 2); la cabecera sigue igual a propósito |
| Ya existente (bien) | Migas de pan (`BreadcrumbList`) y `ItemList` de la clasificación en cada grupo; `lastmod` real por URL; directorio de grupos rastreable; perfiles de jugador fuera del sitemap |
| Verificación de Search Console | No hay etiqueta `google-site-verification` en el HTML (puede estar verificada por DNS) |
| Marca | «Tactium» se parece a «tactic» y a «Tactiq»; el competidor define su producto con una frase clara en la portada |

## 2. Hallazgos priorizados

### P0 · lo que más puede mover la aguja

1. **Medir: abrir Search Console** (propiedad de dominio), enviar `sitemap.xml`, mirar Informe de páginas (¿cuántas de las 2.525 están «Rastreada: actualmente sin indexar» o «Descubierta»?) y consultas de «tactium». *Lo hace Javier; pega el resultado.*
2. **Caché de las páginas de la federación.** ✅ **Hecho el 11-10-2026 (caché de datos).** Causa confirmada: el layout raíz llama a `serverUser()` (lee cookies), así que TODAS las rutas son dinámicas y nada se sirve desde la CDN (`Cache-Control: private, no-store`). Cada visita hacía 3-4 consultas a Supabase (0,6-1,8 s de servidor). Se ha envuelto la carga de grupo, equipo y directorio en `unstable_cache` (15 min grupo y equipo, 1 h el directorio; **un fallo no se cachea**). **Medido en producción tras desplegar (11-10-2026):** primera visita con caché fría 0,8-2,6 s; siguientes 0,29-0,50 s (antes 0,6-1,8 s en TODAS). Queda el suelo de ~0,3 s del render dinámico con la sesión. **Lo que NO se ha tocado (a propósito):** poner `Cache-Control: public` en esas rutas. El HTML lleva el estado de sesión del usuario (`SessionProvider initialUser`), y una caché de CDN sin variar por cookie serviría la sesión de una persona a otra. Para llegar a CDN pura habría que sacar la sesión del layout raíz (refactor de toda la app) o dar a las rutas públicas un layout sin sesión; no se hace sin decisión de Javier.
3. **Frase definitoria y entidad de marca.** Hecho hoy en portada y datos estructurados. Falta repetirla en lo que Google muestra de la marca: ficha de App Store, ficha de Google Play, bio de Instagram y TikTok, Search Console. 🟡 Una definición clara y consistente ayuda a que los resúmenes (también de IA) acierten.

### P1 · alto impacto, pide decisión

4. **Páginas de equipo duplicadas por temporada** (1.914 URLs, un id distinto por equipo y temporada). Muchas son casi idénticas entre sí y compiten. Opciones: (a) mantener todas con contenido propio de la temporada (plantilla, clasificación); (b) fijar una canónica hacia la temporada actual del mismo equipo; (c) `noindex` en temporadas antiguas de equipos. ⚪ Decidir con datos de Search Console (¿qué se indexa? ¿qué da clics?).
4b. ✅ **Hecho el 11-10-2026 · privacidad de los datos estructurados.** `teamJsonLd` listaba a todos los jugadores del equipo con nombre y enlace (`athlete`), contradiciendo que los perfiles de jugador están fuera del índice. Se ha quitado (Javier: «haz lo que sea mejor para nosotros»). Los nombres siguen en el HTML visible de la ficha del equipo (datos públicos de la Federación); si algún día se quiere retirarlos también del HTML indexable, es otra decisión.
5. **Páginas de grupo de temporadas antiguas** sí tienen búsquedas reales («clasificación liga cántabra pádel 2023»): conviene que sean rápidas y tengan texto único (descripción con los equipos que encabezan, ya la tiene).
6. **Enlaces internos:** portada → federación → grupo → equipo → grupo hermano. Hecho el directorio de grupos rastreable (commit `97eeb8c1`); comprobar que ningún grupo queda a más de 3 clics de la portada.
7. **Enlaces entrantes** (la palanca que más cuesta): la FCP, los clubs (G6, Smash, Alday, Medio Cudeyo…), medios de pádel locales, directorios. Cada club que enlace a su ficha en tactium.io vale más que mil descripciones.
8. **ASO** (SEO de tiendas): título (30 caracteres), subtítulo, campo de palabras clave (100 caracteres en iOS), capturas con texto, valoraciones. No auditado aquí por falta de acceso a App Store Connect / Play Console.

### P2 · mantenimiento

9. ~~`lastmod` real en el sitemap~~: **ya es real** (sale de `updated_at` de cada grupo y equipo; las fechas repetidas de 31-07 son de una importación masiva). Nada que hacer.
10. Textos alternativos y nombres de fichero de imágenes; imágenes OG por grupo/equipo ya existen.
11. Texto en pantalla, voz y pie de los reels con las mismas palabras que se buscan («liga cántabra pádel», «clasificación», «orden de fuerza»): es el SEO de Instagram.
12. Páginas de guía propias (normativa de la Liga Cántabra, orden de fuerza, cómo montar la alineación, calendario de jornadas) con enlace a la app.

## 3. Hoja de ruta · de la capa 0 a la 100

| Capa | Qué | Estado |
|---|---|---|
| 0 · Medición | Search Console (dominio), Bing Webmaster, analítica de visitas a `/` y `/federacion`, línea base de consultas de marca | Pendiente (Javier) |
| 1 · Técnico | Rastreo e indexación, redirecciones, canónicas, caché, Core Web Vitals reales, datos estructurados válidos | Parcial (ver §2) |
| 2 · Contenido de las páginas | Títulos y descripciones únicos, un `<h1>`, definición de entidad, enlaces internos | Portada hecha; resto OK |
| 3 · Contenido nuevo | Mapa temático: Liga Cántabra, normativa, orden de fuerza, torneos de pádel en Cantabria, guías para capitanes | Pendiente |
| 4 · Marca/entidad | `Organization`, `sameAs` (redes y tiendas, hecho), nombre coherente en todas partes, perfil de marca en las búsquedas de «tactium» | Parcial |
| 5 · Fuera de la web | Enlaces de la FCP, clubs, medios y directorios; menciones | Pendiente |
| 6 · ASO | Fichas de App Store y Google Play | Pendiente (acceso) |
| 7 · SEO en redes | Instagram y TikTok: nombre y bio con palabras clave, pie, texto en pantalla, voz, textos alternativos | En marcha (`TACTIUM-VIDEO/ESTRATEGIA-IG.md`) |
| 8 · Búsqueda con IA | Frase definitoria, FAQ, hechos coherentes en la web, tiendas y redes; datos estructurados | Parcial |
| 9 · Medición continua | Informe mensual: impresiones, clics, posición y páginas indexadas de las consultas «tactium», «liga cántabra pádel», «clasificación…» | Pendiente |

## 4. Consultas objetivo (hipótesis; validar con Search Console)

- **Marca:** «tactium», «tactium app», «tactium pádel».
- **Liga:** «liga cántabra de pádel», «clasificación liga cántabra pádel», «calendario liga cántabra pádel 2026/27», «grupos liga cántabra pádel».
- **Equipo/club:** «<nombre del equipo> pádel» (miles de consultas pequeñas: es donde las páginas de equipo pueden ganar).
- **Capitán:** «orden de fuerza pádel», «alineación liga pádel», «app para capitanes de pádel».
- **Torneos:** «torneos de pádel en Cantabria», «organizar torneo de pádel».

## 5. Reglas

- No comprar enlaces ni usar redes de enlaces; no esconder texto; no duplicar páginas para posicionar.
- Nada de nombres de jugadores en lo que se indexa (privacidad): los perfiles de jugador están fuera del índice.
- Solo la Cántabra está activa; no presumir de «17 federaciones».
- Todo cambio de código de `tactium-web` se propone primero; el despliegue lo aprueba Javier.
