# `/descargar` · el QR de los carteles de los clubs

`tactium.io/descargar?club=<slug>` es el destino de **un solo QR por club** (en vez de dos, App Store y Google Play). El servidor mira el móvil y manda a la tienda que toca; en escritorio enseña los dos botones y los dos QR. Cada visita se apunta con el club de origen para saber **qué club trae descargas**.

Código: `app/descargar/page.tsx` (ruta), `lib/download.ts` (detección, slug, URL del QR), `lib/download-visits.ts` (registro), `components/marketing/QrCode.tsx` (QR en SVG generado en servidor, dependencia `qrcode-generator`).

## Qué hace cada dispositivo

| Quién abre el enlace | Resultado |
|---|---|
| iPhone, iPad, iPod (UA) | 307 → `APP_STORE_URL` |
| Android | 307 → `PLAY_STORE_URL` |
| Escritorio y cualquier otro | Página con los dos botones y los dos QR |
| Rastreadores y vistas previas (Googlebot, WhatsApp, Telegram, Slack…) | La misma página, sin redirigir y **sin contar** |

- 307 a propósito (temporal): ningún navegador ni CDN lo recuerda y todas las visitas llegan al servidor.
- `noindex, nofollow` en la página. Sin `Disallow` en `robots.txt` (para que Google pueda leer el `noindex`) y fuera del sitemap.
- Los enlaces universales (`public/.well-known/apple-app-site-association`) solo capturan `/i/*` y `/torneos/*`: `/descargar` siempre abre el navegador.
- Un iPad con Safari en «sitio de escritorio» se presenta como Mac: ve la página con los botones y elige. No se corrige con JavaScript para no contar dos veces.
- Los QR de la página de escritorio apuntan **directos a cada tienda** (no a `/descargar`), así que esos escaneos no se registran.

## Slugs de club

`?club=` acepta letras minúsculas, números, `-` y `_` (hasta 40). Cualquier otra cosa se descarta y la visita se cuenta sin club. No hay lista cerrada: un club nuevo no necesita cambios de código. Sugeridos: `smash`, `g6`, `alday`, `medio-cudeyo`. `downloadUrl("smash")` (en `lib/download.ts`) da la URL completa para el QR.

## Qué se guarda (y qué no)

Fecha, club y plataforma (`ios` · `android` · `escritorio`). **Ni IP, ni User-Agent, ni cookie**: no hay dato personal.

1. **Log del servidor**, siempre: una línea `[descargar] {"club":"smash","platform":"ios"}`. Vercel la conserva poco tiempo; sirve para ver en caliente que el QR funciona, no para contar semanas.
2. **Tabla `download_visits`**, por la RPC `log_download_visit`. Es lo que da el recuento. **Migración aplicada en producción el 16-10-2026** (`TACTIUM/supabase/migrations/20261016e_download_visits.sql`). La tabla no tiene permisos para `anon` ni `authenticated`: solo la RPC escribe (`SECURITY DEFINER`, máximo 120 visitas por minuto en total) y se lee con el SQL editor o `execute_sql`.

La tabla solo se escribe desde el hosting (`VERCEL`) y con `NEXT_PUBLIC_TACTIUM_WRITES=on`: en local la web apunta a producción y una prueba con `?club=smash` falsearía las cifras de ese club. Hasta que la web se despliegue, `/descargar` no existe en producción y la tabla solo recibe lo que se le mande a mano.

## Cómo ver los resultados

```sql
select coalesce(club, '(sin club)') as club, platform, count(*) as visitas
  from public.download_visits
 where created_at >= now() - interval '30 days'
 group by 1, 2 order by 1, 2;
```

Una visita no es una descarga: mide escaneos que llegaron a la tienda, no instalaciones. Para instalaciones por origen haría falta el atributo de campaña de cada tienda (App Store Connect y Play Console).

## Cómo probarlo en local

```bash
IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'
curl -sI -A "$IOS" "http://localhost:3000/descargar?club=smash"   # 307 → apps.apple.com
```

Con Android (`Linux; Android 14`) da 307 a Google Play; con un UA de escritorio, 200 y la página. En el log del servidor aparece una línea `[descargar]` por visita.
