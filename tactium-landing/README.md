# tactium-landing · herramientas de marketing (YA NO SE DESPLIEGA)

Desde el 2026-09-26 la landing vive dentro de `tactium-web/` (portada de
`tactium.io` para visitantes, `components/marketing/*`). Este proyecto ya no
tiene dominio en Vercel y se conserva solo por lo que no tiene sentido en la
web de producto:

- `/dev/carousel` + `app/api/carousel/*` — generador de carruseles de Instagram
  (`lib/carousel/posts.ts`), PNG 1080×1350.
- `lib/email/*` — plantillas de email (bienvenida al waitlist) y la plantilla
  de Supabase `reset-password.html`.
- `public/social/*`, `public/brand/logo-variants/*` — assets sociales pesados.
- `CLAUDE DESIGN/` — documentos de marca y kits de UI.

Lo que se portó a `tactium-web` (no editar aquí, está duplicado a propósito):
secciones de la portada, `lib/faq.ts`, `lib/seo/structured-data.ts`, legales,
reset de contraseña, `sitemap`/`robots`/`manifest`/`opengraph-image`, iconos y
capturas de `public/screens/`.

```bash
npm install
npm run dev   # http://localhost:3000/dev/carousel
```
