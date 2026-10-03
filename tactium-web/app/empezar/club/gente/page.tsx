import type { Metadata } from "next";
import { ClubYourPeople } from "@/components/entry/start";

export const metadata: Metadata = { title: "Invitar a tu gente" };

export default function ClubGentePage() {
  return <ClubYourPeople />;
}
