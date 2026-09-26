import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { SessionProvider } from "@/lib/session";
import { serverUser } from "@/lib/supabase/server";
import { allSchemas } from "@/lib/seo/structured-data";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import { AppShell } from "@/components/AppShell";
import { SignedOutToast } from "@/components/SignedOutToast";
import "./globals.css";

// JetBrains Mono sí está en Google Fonts → next/font (auto-preload, sin CLS).
// Satoshi no: es de Fontshare y se carga con <link> en el <head>.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · TACTIUM",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "pádel federado",
    "alineaciones pádel",
    "app pádel equipos",
    "torneos de pádel",
    "federación cántabra pádel",
    "gestión club pádel",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "TACTIUM",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // El navegador pinta los cromos nativos (barra de scroll, controles de
  // formulario) según el tema real, que resuelve el CSS.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030F0F" },
    { media: "(prefers-color-scheme: light)", color: "#F4F7F5" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await serverUser();

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://api.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
        />
        {/* Antes del primer pintado: evita el destello de tema equivocado. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {allSchemas(SITE_URL).map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className={jetbrainsMono.variable}>
        <ThemeProvider>
          <SessionProvider initialUser={user}>
            <AppShell>{children}</AppShell>
            <SignedOutToast />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
