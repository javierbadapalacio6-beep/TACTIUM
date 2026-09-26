import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TACTIUM",
    short_name: "TACTIUM",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#030F0F",
    theme_color: "#030F0F",
    lang: "es-ES",
    categories: ["sports", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
