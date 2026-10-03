"use client";

import { useState } from "react";

import { Btn, BtnLink, Modal } from "@/components/ui";

/**
 * «Canjear código», el mismo en `/pro` y en `/suscripcion`.
 *
 * En la web los códigos promocionales se aplican en el pago de Stripe (el
 * checkout se crea con `allow_promotion_codes`), así que aquí se explica
 * dónde meterlo. Los códigos de oferta de la App Store o de Google Play solo
 * se canjean en la tienda, desde el móvil.
 */
export function RedeemCode({
  planHref,
  size,
}: {
  /** Destino de «Ver planes» (en `/suscripcion`). En `/pro` ya se está ahí. */
  planHref?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn size={size} onClick={() => setOpen(true)}>
        Canjear código
      </Btn>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="canjear-codigo"
        title="Canjear un código"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Entendido</Btn>
            {planHref && (
              <BtnLink href={planHref} variant="accent">
                Ver planes
              </BtnLink>
            )}
          </>
        }
      >
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "grid",
            gap: 10,
            fontSize: 13.5,
            color: "var(--text-muted)",
          }}
        >
          <li>Elige tu plan y pulsa suscribirte.</li>
          <li>
            En la pantalla de pago, toca «Añadir código promocional», escríbelo y
            verás el descuento antes de confirmar.
          </li>
          <li>
            Si tu código es de la App Store o de Google Play, canjéalo desde la
            app en el móvil: solo vale en la tienda.
          </li>
        </ol>
      </Modal>
    </>
  );
}
