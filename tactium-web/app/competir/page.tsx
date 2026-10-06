import type { Metadata } from "next";
import { Suspense } from "react";

import { Compete } from "@/components/compete/Compete";

export const metadata: Metadata = { title: "Competir" };

// `Compete` lee `?vista=` con useSearchParams: necesita su Suspense.
export default function CompetirPage() {
  return (
    <Suspense>
      <Compete />
    </Suspense>
  );
}
