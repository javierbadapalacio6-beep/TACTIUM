import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@core/supabase/client';
import * as NotificationsApi from '@core/services/notifications';

interface NotificationState {
  items: NotificationsApi.AppNotification[];
  unread: number;
  loading: boolean;
  channel: RealtimeChannel | null;

  load: () => Promise<void>;
  markAllRead: () => Promise<void>;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  channel: null,

  load: async () => {
    set({ loading: true });
    try {
      const items = await NotificationsApi.fetchNotifications();
      set({
        items,
        unread: items.filter((n) => !n.read_at).length,
        loading: false,
      });
    } catch (e) {
      console.warn('notifications load', e);
      set({ loading: false });
    }
  },

  markAllRead: async () => {
    const { items, unread } = get();
    if (unread === 0) return;
    const now = new Date().toISOString();
    // Optimista: pintamos todas como leídas ya.
    set({
      items: items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      unread: 0,
    });
    try {
      await NotificationsApi.markAllRead();
    } catch (e) {
      console.warn('markAllRead', e);
    }
  },

  // Canal realtime: mismo patrón que teamStore (removeChannel + topic con
  // sufijo random para sobrevivir a StrictMode). Ante un INSERT para este
  // usuario, recargamos (sube el badge en vivo).
  subscribe: (userId) => {
    const existing = get().channel;
    if (existing) supabase.removeChannel(existing);
    const topic = `notif:${userId}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void get().load();
        },
      )
      .subscribe();
    set({ channel });
  },

  unsubscribe: () => {
    const ch = get().channel;
    if (ch) {
      supabase.removeChannel(ch);
      set({ channel: null });
    }
  },

  reset: () => {
    const ch = get().channel;
    if (ch) supabase.removeChannel(ch);
    set({ items: [], unread: 0, channel: null });
  },
}));
