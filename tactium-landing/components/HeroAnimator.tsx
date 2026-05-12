"use client";

import { useEffect } from "react";
import { createTimeline } from "animejs";

// Cliente que orquesta la entrada del hero con un timeline coordinado.
// No renderiza nada — sólo se monta para disparar la animación. Los
// elementos se identifican via `data-hero` y empiezan invisibles (CSS).
//
// Una timeline da control temporal preciso: cuándo arranca cada elemento,
// cuándo se solapa con el anterior, cómo encadenan. Mucho más limpio que
// CSS keyframes para 6+ elementos coordinados.
export function HeroAnimator() {
  useEffect(() => {
    // Respetar prefers-reduced-motion: si está activo, dejamos los
    // elementos visibles directamente sin animar.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll<HTMLElement>("[data-hero]").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    // Esperamos al siguiente frame para garantizar que los hermanos
    // [data-hero] ya están en el DOM antes de buscarlos. Sin esto, en
    // condiciones de hot-reload o hidratación tardía, anime puede no
    // encontrar los targets ("No target found").
    let timeline: ReturnType<typeof createTimeline> | null = null;

    const rafId = requestAnimationFrame(() => {
      const tl = createTimeline({
        defaults: { ease: "out(3)", duration: 600 },
      });
      timeline = tl;

      // 1. Logo + eyebrow (juntos, encabezado del hero)
      tl.add('[data-hero="brand"]', {
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 500,
      });

      // 2. Headline — empieza a la vez que el logo termina
      tl.add(
        '[data-hero="headline"]',
        {
          opacity: [0, 1],
          translateY: [24, 0],
        },
        "-=200", // arranca 200ms antes de que el anterior acabe (overlap)
      );

      // 3. Sub-headline
      tl.add(
        '[data-hero="sub"]',
        {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 500,
        },
        "-=300",
      );

      // 4. Form waitlist — SOLO translateY (no opacity).
      //    El form es el CTA principal: debe ser siempre visible/clickable,
      //    incluso si el usuario aterriza desde #hero-form antes de que la
      //    animación termine.
      tl.add(
        '[data-hero="form"]',
        {
          translateY: [12, 0],
          duration: 500,
        },
        "-=350",
      );

      // 5. Mockup phone — entra desde la derecha. En paralelo con el
      //    form para que el ojo no vaya solo de izq → der.
      tl.add(
        '[data-hero="mockup"]',
        {
          opacity: [0, 1],
          translateX: [40, 0],
          duration: 900,
          ease: "out(4)",
        },
        "-=700",
      );
    });

    return () => {
      cancelAnimationFrame(rafId);
      timeline?.cancel();
    };
  }, []);

  return null;
}
