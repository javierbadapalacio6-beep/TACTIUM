import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, Toggle } from '@components/ui';
import { ProgressRing } from '@components/ui/ProgressRing';
import { useTeamStore } from '@store/teamStore';

import type { HomeStackScreenProps } from '@navigation/types';

type Filter = 'all' | 'avail' | 'out';

export const AvailabilityScreen = ({
  navigation,
}: HomeStackScreenProps<'Availability'>) => {
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const setPlayerAvail = useTeamStore((s) => s.setPlayerAvail);
  const setSelfAvail = useTeamStore((s) => s.setSelfAvail);
  const activeRole = useTeamStore((s) => s.activeRole);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const isPlayer = activeRole === 'player';

  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const avail = players.filter((p) => p.available).length;
    return { avail, total: players.length };
  }, [players]);

  const pct = counts.total
    ? Math.round((counts.avail / counts.total) * 100)
    : 0;

  const filtered = players.filter((p) => {
    if (filter === 'avail') return p.available;
    if (filter === 'out') return !p.available;
    return true;
  });

  const markAll = async () => {
    await Promise.all(
      players
        .filter((p) => !p.available)
        .map((p) => setPlayerAvail(p.id, true).catch(() => {})),
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('HomeRoot');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.backLabel}>Inicio</Text>
        </Pressable>
        {isPlayer ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>SOLO TÚ</Text>
          </View>
        ) : (
          <Pressable
            onPress={markAll}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.resetLabel}>Marcar todo</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DISPONIBILIDAD · J·07</Text>
        <Text style={styles.title}>
          {isPlayer ? '¿Estás disponible?' : '¿Quién juega esta jornada?'}
        </Text>

        {isPlayer && !myPlayerId ? (
          <View style={styles.notLinkedBanner}>
            <Text style={styles.notLinkedTitle}>Aún no estás vinculado</Text>
            <Text style={styles.notLinkedText}>
              Pide al capitán que te añada a la plantilla, o usa la opción
              "Soy yo" en la pantalla de bienvenida.
            </Text>
          </View>
        ) : null}

        <View style={styles.summary}>
          <ProgressRing pct={pct} size={64} stroke={6} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.summaryValue}>
              <Text style={{ color: Colors.accent }}>{counts.avail}</Text>
              <Text style={{ color: Colors.textFaint }}> / {counts.total}</Text>
            </Text>
            <Text style={styles.summaryLabel}>jugadores disponibles</Text>
          </View>
        </View>

        <View style={styles.filterTabs}>
          {(['all', 'avail', 'out'] as Filter[]).map((f) => {
            const isActive = filter === f;
            const label = f === 'all' ? 'Todos' : f === 'avail' ? 'Disp.' : 'Bajas';
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? Colors.text : Colors.textMuted },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.list}>
          {filtered.map((p, i) => {
            const isMine = isPlayer && p.id === myPlayerId;
            const canEdit = !isPlayer || isMine;
            return (
              <View
                key={p.id}
                style={[
                  styles.row,
                  i < filtered.length - 1 && styles.rowDivider,
                  isMine && styles.rowMine,
                ]}
              >
                <View style={[styles.idChip, isMine && styles.idChipMine]}>
                  <Text style={[styles.idChipText, isMine && styles.idChipTextMine]}>
                    {isMine ? 'TÚ' : String(i + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {p.position} · {p.pts} pts
                  </Text>
                </View>
                <Toggle
                  value={p.available}
                  disabled={!canEdit}
                  accessibilityLabel={`Disponibilidad de ${p.name}`}
                  onChange={(v) =>
                    isPlayer ? setSelfAvail(p.id, v) : setPlayerAvail(p.id, v)
                  }
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  resetBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  roleBadge: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
  notLinkedBanner: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    gap: 4,
  },
  notLinkedTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  notLinkedText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  scroll: { paddingHorizontal: 22, paddingTop: 22 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 24,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 16,
  },
  summaryValue: {
    fontFamily: Fonts.mono,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  filterTab: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.bgRaised,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    marginTop: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: Colors.hair,
  },
  rowMine: {
    backgroundColor: Colors.accent10,
  },
  idChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idChipMine: {
    backgroundColor: Colors.accent15,
    borderColor: Colors.accent50,
  },
  idChipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  idChipTextMine: {
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
