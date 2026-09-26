export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_QUESTIONS: FaqItem[] = [
  {
    q: "¿Dónde puedo descargar TACTIUM?",
    a: "Está disponible en el App Store para iPhone y iPad y en Google Play para Android. También puedes usar esta web: la cuenta es la misma en todos los sitios.",
  },
  {
    q: "¿Qué puedo ver sin crear cuenta?",
    a: "Los torneos que organizan los clubes (cuadros, horarios y resultados en directo) y la competición federada: clasificaciones, jornadas, actas y rankings. Solo necesitas cuenta para inscribirte o gestionar tu equipo.",
  },
  {
    q: "¿Qué federaciones soporta?",
    a: "Las alineaciones valen para cualquier liga federada: tú pones los puntos de tus jugadores y TACTIUM aplica el orden de fuerza. La competición cargada al día (clasificaciones, jornadas, actas y rankings, sin cuenta) hoy es la de la Federación Cántabra de Pádel; el resto de federaciones irán entrando.",
  },
  {
    q: "Mi club ya usa Excel. ¿Vale la pena cambiar?",
    a: "TACTIUM hace en 30 segundos lo que en Excel te lleva 20 minutos: balancear puntos, validar el orden de fuerza y avisar a los convocados. Y los jugadores ven todo desde su móvil.",
  },
  {
    q: "¿Puedo importar mi plantilla actual?",
    a: "Sí. Haz una foto del ranking o súbela desde la web y se extraen nombres y puntos automáticamente. También puedes añadir jugadores a mano.",
  },
  {
    q: "¿Cómo funciona la prueba gratuita?",
    a: "14 días con acceso completo a todas las funciones. No pedimos tarjeta para empezar: solo pagas si decides continuar. Cancela cuando quieras desde Ajustes.",
  },
  {
    q: "¿Los jugadores también pagan?",
    a: "No, nunca. Los jugadores siempre acceden gratis. Solo paga el capitán o el club que gestiona el equipo.",
  },
  {
    q: "Si mi club paga, ¿mis capitanes pagan también?",
    a: "No. Cuando un club tiene plan activo, todos sus capitanes acceden gratis bajo ese plan.",
  },
];
