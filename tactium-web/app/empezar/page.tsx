import type { Metadata } from "next";
import { Start } from "@/components/entry/start";

export const metadata: Metadata = { title: "Empezar" };

export default function EmpezarPage() {
  return <Start />;
}
