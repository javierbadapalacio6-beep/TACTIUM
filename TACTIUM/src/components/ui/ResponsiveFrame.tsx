import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useFocusEffect } from '@react-navigation/native';

/**
 * PUNTO DE CONTROL DEL LAYOUT (móvil / tablet).
 *
 * - `useLayout()` es la ÚNICA forma de saber en qué modo está la app.
 *   Ninguna pantalla debe medir el ancho por su cuenta.
 * - `useCompactRail()` lo llama una pantalla que necesita todo el ancho
 *   (Alineación, Resultados) para que el rail lateral se quede en 76 px.
 * - `ResponsiveFrame` (en App.tsx) sigue sin pintar nada: en tablet solo
 *   desbloquea la rotación en runtime. El móvil sigue bloqueado en vertical.
 *
 * Umbrales (diseño tablet aprobado 2026-10):
 *   lado corto ≥ 700                → tablet
 *   tablet + ancho > alto + ≥ 1000  → tabletLandscape (si no, tabletPortrait)
 *   ancho ≥ 1180                    → railExpanded (rail de 220 con nombres)
 */

export type LayoutMode = 'phone' | 'tabletPortrait' | 'tabletLandscape';

/** Medidas compartidas de las piezas de layout de tablet. */
export const LayoutMetrics = {
  railCompact: 76,
  railExpanded: 220,
  splitList: 360,
  sidePanel: 420,
  modal: 560,
  contentMax: 720,
} as const;

/**
 * Pasar SIEMPRE a los <Modal> de RN: en iOS su valor por defecto es solo
 * 'portrait' y, con el iPad en horizontal, el modal fuerza un giro raro.
 * En móvil no cambia nada (la app sigue bloqueada en vertical).
 */
export const MODAL_ORIENTATIONS: (
  | 'portrait'
  | 'portrait-upside-down'
  | 'landscape-left'
  | 'landscape-right'
)[] = ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right'];

const TABLET_MIN_SHORT_SIDE = 700;
const LANDSCAPE_MIN_WIDTH = 1000;
const RAIL_EXPANDED_MIN_WIDTH = 1180;

export interface Layout {
  mode: LayoutMode;
  isTablet: boolean;
  /** Ancho ≥ 1180: el rail PUEDE ir expandido (si la pantalla no pide compacto). */
  railExpanded: boolean;
  /** Ancho de la ventana (incluye el rail). */
  width: number;
  height: number;
  /** Ancho real del rail ahora mismo (0 en móvil). */
  railWidth: number;
  /** Ancho disponible para la pantalla (ventana − rail). */
  contentWidth: number;
}

export function computeLayoutMode(width: number, height: number): LayoutMode {
  if (Math.min(width, height) < TABLET_MIN_SHORT_SIDE) return 'phone';
  if (width > height && width >= LANDSCAPE_MIN_WIDTH) return 'tabletLandscape';
  return 'tabletPortrait';
}

// ── Petición de rail compacto (store mínima, sin provider) ────────────────
let compactRequests = 0;
const listeners = new Set<() => void>();
function bumpCompact(delta: number) {
  compactRequests = Math.max(0, compactRequests + delta);
  listeners.forEach((l) => l());
}
function subscribeCompact(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getCompact = () => compactRequests > 0;

/** true si alguna pantalla enfocada ha pedido el rail compacto. */
export function useCompactRailRequested(): boolean {
  return useSyncExternalStore(subscribeCompact, getCompact, getCompact);
}

/**
 * Llamar en la pantalla que necesita todo el ancho. Mientras esté ENFOCADA,
 * el rail se queda en 76 px aunque haya sitio para 220.
 *
 *   export function LineupScreen() {
 *     useCompactRail();
 *     ...
 *   }
 *
 * Solo funciona dentro de un navigator (usa useFocusEffect).
 */
export function useCompactRail(active: boolean = true): void {
  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      bumpCompact(1);
      return () => bumpCompact(-1);
    }, [active]),
  );
}

/** Modo de layout actual. Se recalcula al girar o al cambiar de Split View. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const compactRequested = useCompactRailRequested();
  return useMemo(() => {
    const mode = computeLayoutMode(width, height);
    const isTablet = mode !== 'phone';
    const railExpanded = isTablet && width >= RAIL_EXPANDED_MIN_WIDTH;
    const railWidth = !isTablet
      ? 0
      : railExpanded && !compactRequested
        ? LayoutMetrics.railExpanded
        : LayoutMetrics.railCompact;
    return {
      mode,
      isTablet,
      railExpanded,
      width,
      height,
      railWidth,
      contentWidth: width - railWidth,
    };
  }, [width, height, compactRequested]);
}

// ── Rotación ──────────────────────────────────────────────────────────────
// `expo-screen-orientation` es NATIVO: los binarios anteriores al build de
// tablet no lo tienen y un import directo reventaría al recibir una OTA.
// Por eso se carga con require perezoso y solo si el módulo nativo existe.
type OrientationModule = typeof import('expo-screen-orientation');
let orientationModule: OrientationModule | null | undefined;
function loadOrientation(): OrientationModule | null {
  if (orientationModule !== undefined) return orientationModule;
  orientationModule = null;
  if (Platform.OS === 'web') return null;
  try {
    if (requireOptionalNativeModule('ExpoScreenOrientation')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      orientationModule = require('expo-screen-orientation') as OrientationModule;
    }
  } catch {
    orientationModule = null;
  }
  return orientationModule;
}

/** Tablet por tamaño FÍSICO de pantalla (no de ventana: en Split View el
 *  iPad sigue siendo iPad aunque la ventana sea estrecha). */
function isTabletDevice(): boolean {
  const s = Dimensions.get('screen');
  return Math.min(s.width, s.height) >= TABLET_MIN_SHORT_SIDE;
}

/**
 * app.json mantiene `"orientation": "portrait"` (móvil bloqueado). En tablet
 * desbloqueamos en runtime; si un dispositivo deja de ser tablet (plegable
 * que se cierra) se vuelve a bloquear en vertical.
 */
function useTabletOrientation() {
  // useWindowDimensions fuerza el re-render al girar/plegar.
  useWindowDimensions();
  const tablet = isTabletDevice();
  const unlocked = useRef(false);
  useEffect(() => {
    const mod = loadOrientation();
    if (!mod) return;
    if (tablet) {
      unlocked.current = true;
      mod.lockAsync(mod.OrientationLock.DEFAULT).catch(() => {});
    } else if (unlocked.current) {
      unlocked.current = false;
      mod.lockAsync(mod.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [tablet]);
}

export function ResponsiveFrame({ children }: { children: React.ReactNode }) {
  useTabletOrientation();
  return <>{children}</>;
}
