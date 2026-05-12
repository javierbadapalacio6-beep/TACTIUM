import { FAQ_QUESTIONS } from "@/lib/faq";
import { ALL_PLANS, formatEur } from "@/lib/plans";

// Generadores de JSON-LD (schema.org). Inyectados en <head> via layout.tsx.
// Doble propósito:
//  1. Rich snippets en Google (FAQ accordion, knowledge panel, app card)
//  2. Contexto para LLMs (ChatGPT, Perplexity, Claude) que mejoran citación
//     cuando alguien pregunta "qué app de pádel federado existe en España".

export function organizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TACTIUM",
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
    description:
      "El sistema operativo del pádel federado. Gestión de equipos, alineaciones inteligentes con auto-balance por puntos FEP, hasta 5 variantes por jornada y notificaciones a jugadores.",
    sameAs: [
      // Añadir cuentas sociales cuando existan
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hola@tactium.app",
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
    operatingSystem: "iOS, Android",
    url: siteUrl,
    description:
      "App móvil para capitanes y clubs de pádel federado en España. Alineaciones con auto-balance por puntos, hasta 5 variantes por jornada, disponibilidad de jugadores y notificaciones push.",
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
    aggregateRating: undefined, // se añade tras lanzar y tener reseñas reales
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
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
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
