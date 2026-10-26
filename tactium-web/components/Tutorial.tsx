"use client";

/**
 * Tutoriales dentro de la web, los mismos que en la app (`TACTIUM/src/components/ui/TutorialSheet.tsx`):
 * pasos cortos con barra de progreso, un único «Siguiente» → «Entendido» y «Saltar». Cada uno sale UNA vez
 * (se recuerda en el navegador).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Btn, Modal } from "@/components/ui";

export type TutorialId = "team-welcome" | "create-matchday" | "lineup";

interface Step {
  icon: string;
  title: string;
  text: string;
}

const TUTORIALS: Record<TutorialId, { name: string; steps: Step[] }> = {
  "team-welcome": {
    name: "Cómo moverte por tu equipo",
    steps: [
      { icon: "🏠", title: "Inicio: lo que viene", text: "Aquí ves siempre la próxima jornada, quién ha dicho que va y lo que te falta por hacer. Es lo primero que se actualiza." },
      { icon: "📅", title: "Jornadas", text: "Cada jornada tiene su previa, su alineación, el resultado en directo y las fotos. La hora y la sede se copian solas de la Federación." },
      { icon: "✅", title: "Disponibilidad en un toque", text: "Tu equipo responde Voy, Duda o No desde la notificación o desde un enlace, sin tener la app. Tú ves el cupo al momento." },
      { icon: "🏛", title: "Federación", text: "La clasificación, los partidos y las actas de tu grupo. Si la Federación todavía no ha subido algo, lo calculamos con tus actas." },
    ],
  },
  "create-matchday": {
    name: "Crear una jornada",
    steps: [
      { icon: "🆚", title: "Rival y número de jornada", text: "Pon contra quién juegas y el número de jornada. Es lo único obligatorio." },
      { icon: "🏠", title: "Casa o fuera", text: "Marca si juegas de local o de visitante. Fuera, la hora la fija el otro club: te avisamos en cuanto la suba a la Federación." },
      { icon: "🗓", title: "Fecha, hora y tandas", text: "Si ya las sabes, ponlas. Si no, déjalas en blanco: la Federación las rellena sola cuando las publica." },
      { icon: "⚡", title: "¿Muchas jornadas?", text: "Importa todo el calendario de una vez (escaneando la foto o desde la Federación) en lugar de crearlas una a una." },
    ],
  },
  lineup: {
    name: "Hacer la alineación",
    steps: [
      { icon: "👥", title: "Primero, quién puede jugar", text: "La alineación parte de las respuestas de disponibilidad. Quien dijo que no, no aparece como opción." },
      { icon: "🎾", title: "Parejas por pista", text: "Toca una pista y elige a los dos jugadores. Las pistas se ordenan solas por la suma de puntos de cada pareja." },
      { icon: "📋", title: "Varias opciones", text: "Puedes guardar variantes y elegir cuál es la oficial. Los jugadores solo ven la que publiques." },
      { icon: "📤", title: "Publicar y subir a la Federación", text: "Publícala para avisar al equipo. Después súbela a la Federación y márcalo: si no, te avisamos 24 h, 3 h y 1 h antes." },
    ],
  },
};

const key = (id: TutorialId, scope?: string | null) => `tutorial:${id}${scope ? `:${scope}` : ""}`;

function seen(id: TutorialId, scope?: string | null): boolean {
  try {
    return window.localStorage.getItem(key(id, scope)) != null;
  } catch {
    return true; // sin almacenamiento no insistimos
  }
}

/** `show(then)`: si ya se vio ejecuta `then` al momento; si no, abre el tutorial y `then` va al cerrarlo. */
export function useTutorial(id: TutorialId, scope?: string | null) {
  const [visible, setVisible] = useState(false);
  const thenRef = useRef<(() => void) | null>(null);
  const show = useCallback(
    (then?: () => void) => {
      if (seen(id, scope)) {
        then?.();
        return;
      }
      thenRef.current = then ?? null;
      setVisible(true);
    },
    [id, scope],
  );
  const close = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(key(id, scope), "1");
    } catch {
      /* sin almacenamiento */
    }
    const then = thenRef.current;
    thenRef.current = null;
    if (then) setTimeout(then, 200);
  }, [id, scope]);
  return { visible, show, close };
}

/** Lo abre solo la primera vez, a los `delayMs` de montar (si `enabled`). */
export function useAutoTutorial(id: TutorialId, scope: string | null | undefined, enabled: boolean, delayMs = 1200) {
  const tut = useTutorial(id, scope);
  const showRef = useRef(tut.show);
  showRef.current = tut.show;
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => showRef.current(), delayMs);
    return () => clearTimeout(t);
  }, [enabled, delayMs, scope]);
  return tut;
}

export function TutorialModal({ id, visible, onClose }: { id: TutorialId; visible: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const tut = TUTORIALS[id];
  useEffect(() => {
    if (visible) setI(0);
  }, [visible]);
  const step = tut.steps[i];
  const last = i === tut.steps.length - 1;
  return (
    <Modal
      open={visible}
      onClose={onClose}
      labelledBy={`tut-${id}`}
      width={440}
      footer={
        <>
          {!last ? <Btn variant="ghost" onClick={onClose}>Saltar</Btn> : null}
          <Btn variant="accent" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? "Entendido" : "Siguiente"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {tut.steps.map((_, n) => (
          <span key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= i ? "var(--accent)" : "var(--line)" }} />
        ))}
      </div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1.4, color: "var(--accent)", fontWeight: 600 }}>
        {tut.name.toUpperCase()} · {i + 1}/{tut.steps.length}
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, margin: "0 auto", display: "grid", placeItems: "center", background: "var(--accent-10)", fontSize: 40 }}>
          {step.icon}
        </div>
        <h2 id={`tut-${id}`} style={{ margin: "16px 0 6px", fontSize: 22, letterSpacing: -0.3 }}>{step.title}</h2>
        <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.55 }}>{step.text}</p>
      </div>
    </Modal>
  );
}
