import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/torneos`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/federacion`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/federacion/cantabra`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/comunidad`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/pro`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/legal/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/eliminar-cuenta`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
