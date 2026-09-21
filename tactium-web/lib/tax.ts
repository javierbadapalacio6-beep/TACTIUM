/**
 * Interruptor del IVA.
 *
 * Hoy TACTIUM factura como persona no dada de alta, así que los precios se
 * cobran tal cual, sin desglosar impuesto. Meter IVA antes del alta sería peor
 * que no tenerlo, así que todo esto nace APAGADO: con el interruptor en `off`
 * el checkout se comporta exactamente igual que antes de existir este fichero.
 *
 * El día del alta se enciende con una variable de entorno y no hay que tocar
 * código:
 *
 *     NEXT_PUBLIC_TAX_ENABLED=on
 *
 * Requisito antes de encenderlo: configurar Stripe Tax en el panel (dirección
 * de origen y registro de IVA en España). Sin eso, `automatic_tax` hace fallar
 * la creación de la sesión.
 */
export const TAX_ENABLED = process.env.NEXT_PUBLIC_TAX_ENABLED === "on";

/**
 * Cómo se trata el impuesto en cada plan, y no es un capricho:
 *
 *  · Los planes de CLUB son B2B. Al club el IVA no le cuesta nada porque se lo
 *    deduce, así que el precio va «+ IVA» (`exclusive`) y lo que TACTIUM se
 *    queda sube un 21% sin que al cliente le cambie el coste real.
 *  · El plan CAPITÁN lo paga una persona de su bolsillo. La ley de consumidores
 *    obliga a mostrar el precio final, así que el IVA va DENTRO (`inclusive`).
 */
export function taxBehaviorFor(
  tier: string,
): "inclusive" | "exclusive" {
  return tier === "captain" ? "inclusive" : "exclusive";
}

/** Coletilla para la pantalla de precios. Vacía mientras el IVA esté apagado. */
export function vatNote(tier: string): string {
  if (!TAX_ENABLED) return "";
  return taxBehaviorFor(tier) === "exclusive" ? "+ IVA" : "IVA incluido";
}
