import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { StoreBadges } from "@/components/marketing/StoreBadges";
import { QrCode } from "@/components/marketing/QrCode";
import { Card, PageHeader } from "@/components/ui";
import { cleanClub, detectPlatform, isBot, storeUrl } from "@/lib/download";
import { recordDownloadVisit } from "@/lib/download-visits";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Descargar la app",
  description: "Descarga TACTIUM en el App Store o en Google Play.",
  // Es el destino de un QR impreso, no una página que deba salir en Google.
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * `tactium.io/descargar?club=<slug>` · el QR de los carteles de los clubs.
 *
 * iPhone/iPad → App Store; Android → Google Play; el resto (escritorio,
 * rastreadores) ve esta página con los dos botones y los dos QR para escanear
 * con el móvil. Cada visita de una persona se apunta con su club y su sistema
 * (`lib/download-visits.ts`). Redirección 307: temporal, para que ningún
 * navegador ni CDN la recuerde y se siga contando.
 */
export default async function DescargarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rawClub = Array.isArray(sp.club) ? sp.club[0] : sp.club;
  const club = cleanClub(rawClub);

  const ua = (await headers()).get("user-agent") ?? "";
  const platform = detectPlatform(ua);
  const bot = isBot(ua);

  if (!bot) after(() => recordDownloadVisit({ club, platform }));
  if (!bot && platform !== "escritorio") redirect(storeUrl(platform));

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Descarga TACTIUM"
        lede="La app es gratuita. Escanea el código con la cámara del móvil o pulsa tu tienda."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 16,
        }}
      >
        <StoreCard title="iPhone y iPad" qrValue={APP_STORE_URL} qrLabel="Código QR del App Store">
          <StoreBadges only="apple" />
        </StoreCard>
        <StoreCard title="Android" qrValue={PLAY_STORE_URL} qrLabel="Código QR de Google Play">
          <StoreBadges only="google" />
        </StoreCard>
      </div>
    </div>
  );
}

function StoreCard({
  title,
  qrValue,
  qrLabel,
  children,
}: {
  title: string;
  qrValue: string;
  qrLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ display: "grid", justifyItems: "center", gap: 16, textAlign: "center" }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
      <QrCode value={qrValue} label={qrLabel} />
      {children}
    </Card>
  );
}
