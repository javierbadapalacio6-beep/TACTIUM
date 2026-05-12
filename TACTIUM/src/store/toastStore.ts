import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastState {
  current: Toast | null;
  // Cola simple: si llega un toast con uno visible, lo encola para
  // mostrarlo cuando el actual termine. Evita pisar feedback importante.
  queue: Toast[];

  show: (
    kind: ToastKind,
    title: string,
    description?: string,
    durationMs?: number,
  ) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
  dismiss: () => void;
}

let nextId = 1;
const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 5500;

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  queue: [],

  show: (kind, title, description, durationMs) => {
    const toast: Toast = {
      id: nextId++,
      kind,
      title,
      description,
      durationMs:
        durationMs ??
        (kind === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS),
    };
    const { current, queue } = get();
    if (current) {
      // Ya hay un toast visible — encolar.
      set({ queue: [...queue, toast] });
    } else {
      set({ current: toast });
    }
  },

  success: (title, description) => get().show('success', title, description),
  error: (title, description) => get().show('error', title, description),
  info: (title, description) => get().show('info', title, description),
  warn: (title, description) => get().show('warn', title, description),

  dismiss: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ current: next, queue: rest });
    } else {
      set({ current: null });
    }
  },
}));

// Helper para uso fuera de componentes (servicios, catches):
//   toast.error('Algo falló')
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().success(title, description),
  error: (title: string, description?: string) =>
    useToastStore.getState().error(title, description),
  info: (title: string, description?: string) =>
    useToastStore.getState().info(title, description),
  warn: (title: string, description?: string) =>
    useToastStore.getState().warn(title, description),
};
