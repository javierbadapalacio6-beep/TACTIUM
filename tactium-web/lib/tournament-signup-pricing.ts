// Precio de una inscripción a torneo (posiblemente a 2 categorías).
//
// MODELO (confirmado con el cliente): la cuota es POR PERSONA y según cuántas
// categorías juega ESA persona:
//   · 1 categoría → entry_fee            (p.ej. 25 €)
//   · 2 categorías → entry_fee_2         (p.ej. 35 € — SUSTITUYE, no se suma)
// El total es la suma por persona. Ejemplos (25/35):
//   · 1 cat (A+B):                 A 25 + B 25            = 50
//   · 2 cats, compañero distinto:  A 35 + B 25 + C 25     = 85
//   · 2 cats, mismo compañero:     A 35 + B 35            = 70
//
// Se agrupa por NOMBRE normalizado, así que "mismo compañero en las dos
// categorías" se detecta solo y paga la cuota de 2, no dos de 1.

export interface SignupRegLite {
  category: string | null;
  p1Name: string;
  p2Name: string;
}

export interface PricedPerson {
  name: string;
  categories: number;
  feeCents: number;
}

export interface SignupPricing {
  persons: PricedPerson[];
  totalCents: number;
}

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function priceSignup(
  regs: SignupRegLite[],
  entryFeeEur: number,
  entryFee2Eur: number | null,
): SignupPricing {
  const perCents = Math.round((entryFeeEur || 0) * 100);
  // Sin cuota de 2 categorías definida → cae a 2× la de 1 (igual que la app).
  const per2Cents =
    entryFee2Eur != null && entryFee2Eur > 0
      ? Math.round(entryFee2Eur * 100)
      : perCents * 2;

  // Personas distintas y en cuántas categorías (= inscripciones) aparecen.
  const map = new Map<string, { name: string; categories: number }>();
  for (const r of regs) {
    for (const nm of [r.p1Name, r.p2Name]) {
      const n = (nm ?? "").trim();
      if (!n) continue;
      const key = normName(n);
      const e = map.get(key) ?? { name: n, categories: 0 };
      e.categories += 1;
      map.set(key, e);
    }
  }

  const persons: PricedPerson[] = [...map.values()].map((p) => ({
    name: p.name,
    categories: p.categories,
    feeCents: p.categories >= 2 ? per2Cents : perCents,
  }));
  const totalCents = persons.reduce((s, p) => s + p.feeCents, 0);
  return { persons, totalCents };
}
