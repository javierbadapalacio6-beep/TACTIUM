import type { Metadata } from "next";
import { CasualList } from "@/components/social/Casual";

export const metadata: Metadata = { title: "Amistosos" };

export default function AmistososPage() {
  return <CasualList />;
}
