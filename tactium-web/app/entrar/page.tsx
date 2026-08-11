import type { Metadata } from "next";
import { Auth } from "@/components/entry/Auth";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return <Auth />;
}
