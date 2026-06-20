export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_QUESTIONS: FaqItem[] = [
  {
    q: "¿Dónde puedo descargar TACTIUM?",
    a: "Ya está disponible en el App Store para iPhone y iPad. La versión de Android llegará muy pronto a Google Play.",
  },
  {
    q: "¿En qué plataformas está disponible?",
    a: "Disponible en iOS (App Store); Android llega pronto. La web (esta landing) es solo informativa y para gestionar la suscripción.",
  },
  {
    q: "¿Qué federaciones soporta?",
    a: "Todas las federaciones autonómicas españolas afiliadas a la FEP (Andalucía, Madrid, Cataluña, Galicia, etc.). Cada una con sus reglas específicas: parejas, orden de fuerza, número de partidos por jornada.",
  },
  {
    q: "Mi club ya usa Excel. ¿Vale la pena cambiar?",
    a: "TACTIUM hace en 30 segundos lo que en Excel te lleva 20 minutos: balancear puntos, validar orden de fuerza, avisar a los convocados. Y los jugadores ven todo desde su móvil.",
  },
  {
    q: "¿Puedo importar mi plantilla actual?",
    a: "Sí. Haz una foto del ranking FEP y nuestro OCR extrae nombres y puntos automáticamente. También puedes añadir jugadores manualmente.",
  },
  {
    q: "¿Cómo funciona la prueba gratuita?",
    a: "14 días con acceso completo a todas las funciones. No pedimos tarjeta para empezar — solo te cobramos si decides continuar. Cancela en cualquier momento desde Ajustes.",
  },
  {
    q: "¿Los jugadores también pagan?",
    a: "No, nunca. Los jugadores siempre acceden gratis. Solo paga el capitán o el club que gestiona el equipo.",
  },
  {
    q: "¿Y si mi club paga, mis capitanes pagan también?",
    a: "No. Cuando un club tiene plan activo, todos sus capitanes acceden gratis bajo ese plan. Ahorran sus 4,99 €/mes individuales.",
  },
];
