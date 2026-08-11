import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { SessionProvider } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
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
  title: {
    default: "TACTIUM",
    template: "%s · TACTIUM",
  },
  description:
    "Gestiona tu equipo de pádel federado: alineaciones, jornadas, temporadas, torneos y federación.",
};

export const viewport: Viewport = {
  // El navegador pinta los cromos nativos (barra de scroll, controles de
  // formulario) según el tema real, que resuelve el CSS.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030F0F" },
    { media: "(prefers-color-scheme: light)", color: "#F4F7F5" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      </head>
      <body className={jetbrainsMono.variable}>
        <ThemeProvider>
          <SessionProvider>
            <AppShell>{children}</AppShell>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
