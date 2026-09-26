import { FAQ_QUESTIONS } from "@/lib/faq";
import { ALL_PLANS, formatEur } from "@/lib/plans";
import { CONTACT_EMAIL, SITE_DESCRIPTION } from "@/lib/site";

// JSON-LD (schema.org) que va en el <head> de todas las páginas. Rich snippets
// en Google (FAQ, ficha de app, organización) y contexto para los asistentes
// que citan fuentes.

export function organizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TACTIUM",
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.png`,
    description: SITE_DESCRIPTION,
    sameAs: [
      "https://instagram.com/tactium.io",
      "https://tiktok.com/@tactium.io",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: CONTACT_EMAIL,
      contactType: "customer support",
      availableLanguage: ["Spanish"],
    },
  };
}

export function websiteSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TACTIUM",
    url: siteUrl,
    inLanguage: "es-ES",
    publisher: { "@type": "Organization", name: "TACTIUM" },
  };
}

export function softwareApplicationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TACTIUM",
    applicationCategory: "SportsApplication",
    operatingSystem: "iOS, Android, Web",
    url: siteUrl,
    description:
      "App para capitanes y clubs de pádel federado en España. Alineaciones con orden de fuerza, hasta 5 variantes por jornada, disponibilidad de jugadores, torneos y competición federada.",
    offers: ALL_PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.displayName,
      price: plan.priceMonthlyEur.toFixed(2),
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.priceMonthlyEur.toFixed(2),
        priceCurrency: "EUR",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      description: `${plan.teamQuota} equipo${plan.teamQuota > 1 ? "s" : ""} · ${formatEur(plan.priceMonthlyEur)}/mes`,
    })),
    inLanguage: "es-ES",
  };
}

export function faqPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_QUESTIONS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function allSchemas(siteUrl: string) {
  return [
    organizationSchema(siteUrl),
    websiteSchema(siteUrl),
    softwareApplicationSchema(siteUrl),
    faqPageSchema(),
  ];
}
