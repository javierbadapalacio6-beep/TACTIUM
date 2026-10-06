import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconBell } from '@components/ui';
import * as NotificationsApi from '@core/services/notifications';
import type { AppNotification } from '@core/services/notifications';
import { useNotificationStore } from '@store/notificationStore';
import { toast } from '@store/toastStore';
import type { RootStackScreenProps } from '@navigation/types';
import { goToTarget, type NavTarget } from '../notifActions';
import { NotificationList } from '../components/NotificationList';

const PAGE = 20;

/**
 * «Todos los avisos»: la campana entera, paginada de 20 en 20 (como `/avisos`
 * en la web). Misma lista que la hoja (agrupada por día, botones en línea);
 * aquí se ven también los antiguos. Cada cambio pasa por la store de la
 * campana para que el contador siga cuadrando.
 */
export const NotificationsScreen = ({ navigation }: RootStackScreenProps<'Notifications'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const storeItems = useNotificationStore((s) => s.items);
  const storeMarkOne = useNotificationStore((s) => s.markOneRead);
  const storeDelete = useNotificationStore((s) => s.deleteNotification);
  const storeDeleteAll = useNotificationStore((s) => s.deleteAllNotifications);
  const storeLoad = useNotificationStore((s) => s.load);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setError(null);
    try {
      const rows = await NotificationsApi.fetchNotifications(PAGE, 0);
      setItems(rows);
      setMore(rows.length === PAGE);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar los avisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  // Llega un aviso nuevo (realtime de la store): se añade arriba sin perder
  // las páginas ya cargadas.
  const newestId = storeItems[0]?.id;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const fresh = useNotificationStore.getState().items;
    setItems((cur) => {
      const seen = new Set(cur.map((n) => n.id));
      const add = fresh.filter((n) => !seen.has(n.id));
      return add.length ? [...add, ...cur] : cur;
    });
  }, [newestId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const rows = await NotificationsApi.fetchNotifications(PAGE, items.length);
      setItems((cur) => {
        const seen = new Set(cur.map((n) => n.id));
        return [...cur, ...rows.filter((n) => !seen.has(n.id))];
      });
      setMore(rows.length === PAGE);
    } catch (e: any) {
      toast.error('No se pudieron cargar más', e?.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRead = (id: string) => {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)));
    // Si está en la campana, la store lo marca y baja el contador; si es uno
    // antiguo (fuera de los 50 de la campana), directo al servicio.
    if (useNotificationStore.getState().items.some((n) => n.id === id)) {
      void storeMarkOne(id);
    } else {
      NotificationsApi.markOneRead(id).catch(() => {});
    }
  };

  const onDelete = async (ids: string[]) => {
    setItems((cur) => cur.filter((n) => !ids.includes(n.id)));
    for (const id of ids) await storeDelete(id);
  };

  const markAll = async () => {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    try {
      await NotificationsApi.markAllRead();
    } catch (e: any) {
      toast.error('No se pudieron marcar', e?.message);
    }
    void storeLoad();
  };

  const clearAll = () => {
    Alert.alert('Vaciar notificaciones', 'Se borrarán todos tus avisos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          setItems([]);
          setMore(false);
          try {
            await storeDeleteAll();
          } catch (err: any) {
            toast.error('No se pudieron borrar', err?.message);
            void loadFirst();
          }
        },
      },
    ]);
  };

  const go = (t: NavTarget) => goToTarget(t);

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />
        }
      >
        <Text style={styles.eyebrow}>NOTIFICACIONES</Text>
        <Text style={styles.title}>Avisos</Text>
        <Text style={styles.lede}>Convocatorias, alineaciones, torneos y gente que te sigue.</Text>

        {items.length > 0 ? (
          <View style={styles.headActions}>
            {unread > 0 ? (
              <Pressable
                onPress={() => void markAll()}
                hitSlop={6}
                accessibilityRole="button"
                style={({ pressed }) => [styles.headBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.headBtnText}>Marcar leídos</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={clearAll}
              hitSlop={6}
              accessibilityRole="button"
              style={({ pressed }) => [styles.headBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.headBtnText, { color: c.error }]}>Vaciar</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {unread > 0 ? <Text style={styles.count}>{unread} sin leer</Text> : null}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={c.textMuted} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <IconBell size={26} color={c.textFaint} />
            <Text style={styles.emptyTitle}>No se pudieron cargar los avisos</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void loadFirst();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.headBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.headBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <IconBell size={26} color={c.textFaint} />
            <Text style={styles.emptyTitle}>Estás al día</Text>
            <Text style={styles.emptyText}>
              Cuando tu capitán publique una alineación, te convoquen o alguien te siga, lo
              verás aquí.
            </Text>
          </View>
        ) : (
          <>
            <NotificationList
              items={items}
              active
              onNavigate={go}
              onRead={onRead}
              onDelete={onDelete}
            />
            {more ? (
              <Pressable
                onPress={() => void loadMore()}
                disabled={loadingMore}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.moreBtn,
                  (pressed || loadingMore) && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.moreBtnText}>
                  {loadingMore ? 'Cargando…' : 'Ver más antiguos'}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.hint}>Mantén pulsado un aviso para borrarlo.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    scroll: { paddingHorizontal: 22, paddingTop: 14, gap: 0 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 6,
    },
    lede: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      marginBottom: 14,
    },
    headActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    headBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    headBtnText: { color: c.text, fontSize: 12, fontWeight: '600' },
    count: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 0.4,
    },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      paddingHorizontal: 20,
    },
    moreBtn: {
      marginTop: 16,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    moreBtnText: { color: c.text, fontSize: 13, fontWeight: '600' },
    hint: {
      color: c.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 14,
    },
  });
