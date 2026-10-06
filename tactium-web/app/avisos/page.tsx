import type { Metadata } from "next";

import { NoticesPage } from "@/components/notifications/NoticesPage";

export const metadata: Metadata = { title: "Avisos" };

export default function AvisosPage() {
  return <NoticesPage />;
}
