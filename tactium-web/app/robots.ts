import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Lo que va tras la sesión no tiene nada que indexar: sin cookies devuelve
// la pantalla de "entra para ver tu equipo".
const PRIVATE = [
  "/api/",
  "/auth/",
  "/ajustes",
  "/amistosos",
  "/club",
  "/connect",
  "/empezar",
  "/bienvenida",
  "/entrar",
  "/equipo",
  "/jornada",
  "/novedades",
  "/stats",
  "/suscripcion",
  "/temporadas",
  "/torneos/mios",
  "/torneos/pago-ok",
  "/torneos/pago-cancelado",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
