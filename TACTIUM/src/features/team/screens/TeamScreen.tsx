import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconPlus,
  IconChevron,
  IconX,
  IconSearch,
  BottomSheet,
  ScanSheet,
  Toggle,
} from '@components/ui';
import { useTeamStore, type Player, type Side } from '@store/teamStore';
import { toast } from '@store/toastStore';
import {
  NAME_MAX_LENGTH,
  isValidName,
  normalizeName,
  parsePts,
  sanitizePtsInput,
} from '@core/utils/validation';
import type { ScannedPlayer } from '@core/services/imageRecognition';

const SIDES: Side[] = ['Drive', 'Revés', 'Ambos'];

export const TeamScreen = () => {
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);

  const team = useTeamStore((s) => s.team);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleBulkPlayers = async (scanned: ScannedPlayer[]) => {
    for (const p of scanned) {
      await addPlayer({
        name: p.name.trim(),
        pts: p.pts ?? 0,
        position: p.position ?? 'Ambos',
        available: true,
      });
    }
  };

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco
  // desde otra pantalla (tab o stack nested).
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didMountRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        didMountRef.current = true;
      }
    }, []),
  );

  const sorted = useMemo(
    () => [...players].sort((a, b) => b.pts - a.pts),
    [players],
  );
  const shown = sorted.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPts = players.reduce((a, p) => a + p.pts, 0);
  const avg = players.length ? Math.round(totalPts / players.length) : 0;


  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {[team?.name, team?.category].filter(Boolean).join(' · ').toUpperCase() ||
            'EQUIPO'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setScanning(true)}
            style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.scanBtnIcon}>📷</Text>
            <Text style={styles.scanBtnLabel}>Escanear</Text>
          </Pressable>
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Añadir jugador"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <IconPlus size={16} color={Colors.accent} />
          </Pressable>
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Plantilla</Text>
        <View style={styles.kpis}>
          <Kpi label="Jugadores" value={String(players.length)} />
          <View style={styles.kpiSep} />
          <Kpi label="Σ pts" value={String(totalPts)} highlight />
          <View style={styles.kpiSep} />
          <Kpi label="Media" value={String(avg)} />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <IconSearch size={14} color={Colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar jugador"
            placeholderTextColor={Colors.textFaint}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={6}>
              <IconX size={12} color={Colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          // Reserva el alto del tab bar flotante (~64) + offset (12) + colchón (32)
          // para que el último item no quede pegado al pill cristal.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {shown.length === 0 ? (
            players.length === 0 ? (
              // Empty real: equipo sin jugadores. Mostramos CTAs para
              // que la primera acción sea evidente.
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Plantilla vacía</Text>
                <Text style={styles.emptySubtitle}>
                  Añade jugadores manualmente o escanea un ranking FEP para
                  importarlos.
                </Text>
                <View style={styles.emptyActions}>
                  <Pressable
                    onPress={() => setAdding(true)}
                    style={({ pressed }) => [
                      styles.emptyCtaPrimary,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Añadir jugador"
                  >
                    <IconPlus size={14} color={Colors.textInverse} />
                    <Text style={styles.emptyCtaPrimaryLabel}>
                      Añadir jugador
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setScanning(true)}
                    style={({ pressed }) => [
                      styles.emptyCtaSecondary,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Escanear ranking"
                  >
                    <Text style={styles.emptyCtaSecondaryLabel}>
                      Escanear ranking
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              // Hay jugadores pero el filtro no devuelve nada → sugerir
              // limpiar búsqueda.
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Sin coincidencias</Text>
                <Text style={styles.emptySubtitle}>
                  Ningún jugador coincide con "{search}".
                </Text>
                <Pressable
                  onPress={() => setSearch('')}
                  style={({ pressed }) => [
                    styles.emptyCtaSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar búsqueda"
                >
                  <Text style={styles.emptyCtaSecondaryLabel}>
                    Limpiar búsqueda
                  </Text>
                </Pressable>
              </View>
            )
          ) : (
            shown.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setEditing(p)}
                style={({ pressed }) => [
                  styles.row,
                  i < shown.length - 1 && styles.rowDividerInline,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.rank}>
                  <Text style={styles.rankText}>
                    #{String(i + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName}>{p.name}</Text>
                    {!p.available ? (
                      <View style={styles.bajaBadge}>
                        <Text style={styles.bajaBadgeText}>BAJA</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowMeta}>
                    {p.position} · {p.pts} pts
                  </Text>
                </View>
                <View
                  style={[
                    styles.ptsPill,
                    i < 2 && {
                      backgroundColor: Colors.accent10,
                      borderColor: Colors.accent40,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ptsPillText,
                      { color: i < 2 ? Colors.accent : Colors.text },
                    ]}
                  >
                    {p.pts}
                  </Text>
                </View>
                <IconChevron size={14} color={Colors.textFaint} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <EditPlayerSheet
        player={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) {
            updatePlayer(editing.id, patch);
            toast.success('Jugador actualizado', editing.name);
          }
          setEditing(null);
        }}
        onRemove={() => {
          // Confirmación destructiva antes de borrar — el botón estaba
          // disparando remove directamente sin preguntar.
          if (!editing) return;
          const target = editing;
          Alert.alert(
            'Eliminar jugador',
            `Vas a borrar a "${target.name}" de la plantilla. Esta acción no se puede deshacer.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => {
                  removePlayer(target.id);
                  toast.success('Jugador eliminado', target.name);
                  setEditing(null);
                },
              },
            ],
          );
        }}
      />

      <AddPlayerSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(data) => {
          addPlayer({ ...data, available: true })
            .then(() => {
              toast.success(`Jugador añadido`, data.name);
            })
            .catch((e: any) => {
              console.warn('addPlayer failed', e);
              toast.error(
                'No se pudo añadir el jugador',
                e?.message ?? 'Inténtalo de nuevo.',
              );
            });
          setAdding(false);
        }}
      />

      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        mode="ranking"
        teamName={team?.name}
        onConfirm={handleBulkPlayers}
      />
    </View>
  );
};

const Kpi: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <View>
    <Text
      style={[
        styles.kpiValue,
        { color: highlight ? Colors.accent : Colors.text },
      ]}
    >
      {value}
    </Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

interface EditProps {
  player: Player | null;
  onClose: () => void;
  onSave: (patch: Partial<Player>) => void;
  onRemove: () => void;
}
const EditPlayerSheet: React.FC<EditProps> = ({
  player,
  onClose,
  onSave,
  onRemove,
}) => {
  const [name, setName] = useState('');
  const [pts, setPts] = useState('');
  const [pos, setPos] = useState<Side>('Drive');
  const [avail, setAvail] = useState(true);

  React.useEffect(() => {
    if (player) {
      setName(player.name);
      setPts(String(player.pts));
      setPos(player.position);
      setAvail(player.available);
    }
  }, [player]);

  return (
    <BottomSheet
      open={player != null}
      onClose={onClose}
      footer={
        <View style={styles.sheetActions}>
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.removeBtnText}>Eliminar</Text>
          </Pressable>
          <Pressable
            disabled={!isValidName(name)}
            onPress={() =>
              onSave({
                name: normalizeName(name),
                pts: parsePts(pts),
                position: pos,
                available: avail,
              })
            }
            style={({ pressed }) => [
              styles.saveBtn,
              !isValidName(name) && { opacity: 0.4 },
              pressed && isValidName(name) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>EDITAR</Text>
      <Text style={styles.sheetTitle}>{player?.name ?? ''}</Text>

      <FormRow label="NOMBRE">
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          style={styles.sheetInput}
          placeholderTextColor={Colors.textFaint}
        />
      </FormRow>
      <FormRow label="PUNTOS FEP">
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(sanitizePtsInput(v))}
          keyboardType="number-pad"
          maxLength={4}
          style={[styles.sheetInput, { fontFamily: Fonts.mono }]}
          placeholderTextColor={Colors.textFaint}
        />
      </FormRow>
      <FormRow label="POSICIÓN">
        <View style={styles.posRow}>
          {SIDES.slice(0, 2).map((p) => {
            const sel = pos === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPos(p)}
                style={[
                  styles.posBtn,
                  sel && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.posBtnText,
                    { color: sel ? '#000' : Colors.text },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormRow>
      <FormRow label="DISPONIBILIDAD">
        <View style={styles.availRow}>
          <Text
            style={[
              styles.availLabel,
              { color: avail ? Colors.text : Colors.textMuted },
            ]}
          >
            {avail ? 'Disponible' : 'No disponible'}
          </Text>
          <Toggle value={avail} onChange={setAvail} />
        </View>
      </FormRow>
    </BottomSheet>
  );
};

interface AddProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; pts: number; position: Side }) => void;
}
const AddPlayerSheet: React.FC<AddProps> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [pts, setPts] = useState('300');
  const [pos, setPos] = useState<Side>('Drive');

  React.useEffect(() => {
    if (open) {
      setName('');
      setPts('300');
      setPos('Drive');
    }
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          disabled={!isValidName(name)}
          onPress={() =>
            onAdd({
              name: normalizeName(name),
              pts: parsePts(pts),
              position: pos,
            })
          }
          style={({ pressed }) => [
            styles.saveBtnFull,
            !isValidName(name) && { opacity: 0.4 },
            pressed && isValidName(name) && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.saveBtnText}>Añadir al equipo</Text>
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>NUEVO</Text>
      <Text style={styles.sheetTitle}>Añadir jugador</Text>

      <FormRow label="NOMBRE">
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          placeholder="Player 13"
          style={styles.sheetInput}
          placeholderTextColor={Colors.textFaint}
        />
      </FormRow>
      <FormRow label="PUNTOS FEP">
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(sanitizePtsInput(v))}
          keyboardType="number-pad"
          maxLength={4}
          style={[styles.sheetInput, { fontFamily: Fonts.mono }]}
        />
      </FormRow>
      <FormRow label="POSICIÓN">
        <View style={styles.posRow}>
          {SIDES.slice(0, 2).map((p) => {
            const sel = pos === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPos(p)}
                style={[
                  styles.posBtn,
                  sel && { backgroundColor: Colors.accent, borderColor: Colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.posBtnText,
                    { color: sel ? '#000' : Colors.text },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormRow>
    </BottomSheet>
  );
};

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.formLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
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
  scanBtnIcon: { fontSize: 14 },
  scanBtnLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  intro: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  kpis: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  kpiSep: {
    width: 1,
    backgroundColor: Colors.hair,
  },
  kpiValue: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  kpiLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  search: {
    height: 38,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  list: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
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
  rowDividerInline: {
    borderBottomWidth: 1,
    borderColor: Colors.hair,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bajaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(242,201,76,0.18)',
  },
  bajaBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.warning,
    letterSpacing: 0.5,
  },
  rowMeta: {
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  ptsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  ptsPillText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  empty: {
    paddingVertical: 30,
    color: Colors.textFaint,
    textAlign: 'center',
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  emptyCtaPrimaryLabel: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  emptyCtaSecondary: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaSecondaryLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sheetEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 12,
  },
  formLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    paddingLeft: 4,
    marginBottom: 6,
  },
  sheetInput: {
    width: '100%',
    height: 46,
    borderRadius: 11,
    paddingHorizontal: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  posRow: {
    flexDirection: 'row',
    gap: 6,
  },
  posBtn: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  availLabel: {
    fontSize: 14,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  removeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  saveBtnFull: {
    height: 52,
    marginTop: 8,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  saveBtnText: {
    color: '#001810',
    fontSize: 15,
    fontWeight: '700',
  },
});
