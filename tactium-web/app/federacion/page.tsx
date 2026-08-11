import type { Metadata } from "next";
import { FederationPicker } from "@/components/federation/Federation";

export const metadata: Metadata = { title: "Federación" };

export default function FederacionPage() {
  return <FederationPicker />;
}
