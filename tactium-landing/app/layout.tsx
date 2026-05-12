import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { allSchemas } from "@/lib/seo/structured-data";
import "./globals.css";

// Fonts cargadas vía next/font (auto-preload + zero layout shift).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tactium.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TACTIUM · Alineaciones inteligentes para tu equipo de pádel",
    template: "%s · TACTIUM",
  },
  description:
    "El sistema operativo del pádel federado. Alineaciones con auto-balance por puntos, hasta 5 variantes por jornada, disponibilidad de jugadores y notificaciones push. 14 días gratis.",
  keywords: [
    "padel",
    "pádel",
    "padel federado",
    "gestión de equipos",
    "federación de pádel",
    "alineaciones pádel",
    "app capitán pádel",
    "club pádel",
    "FEP",
    "auto-balance puntos",
    "variantes alineación",
  ],
  authors: [{ name: "TACTIUM" }],
  creator: "TACTIUM",
  publisher: "TACTIUM",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    title: "TACTIUM · Alineaciones inteligentes para tu equipo de pádel",
    description:
      "Alineaciones con auto-balance por puntos, hasta 5 variantes por jornada y notificaciones a tus jugadores. Únete al waitlist.",
    siteName: "TACTIUM",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TACTIUM · El sistema operativo del pádel federado",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TACTIUM · El sistema operativo del pádel federado",
    description:
      "Alineaciones inteligentes, hasta 5 variantes y notificaciones a tus jugadores. 14 días gratis.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "sports",
  applicationName: "TACTIUM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030F0F" },
    { media: "(prefers-color-scheme: light)", color: "#030F0F" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const schemas = allSchemas(SITE_URL);

  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {schemas.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
