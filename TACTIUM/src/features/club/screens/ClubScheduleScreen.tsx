import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron, IconCheck, IconX, BottomSheet } from '@components/ui';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';
import {
  getClubHomeSchedule,
  setTeamPreferredSlots,
  type ClubHomeMatch,
} from '@core/services/clubSchedule';
import { updateMatchday } from '@core/services/matchdays';
import { notifyPush } from '@core/push';

import type { ClubStackScreenProps } from '@navigation/types';

// Días de la semana ISO (1=Lunes … 7=Domingo).
const DOW_SHORT = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DOW_NAME = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Rejilla de horas para AÑADIR favoritos (08:00–23:00 cada 30 min). Evita un
// picker nativo anidado dentro del bottom sheet.
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    const hh = String(h).padStart(2, '0');
    out.push(`${hh}:00`, `${hh}:30`);
  }
  out.push('23:00');
  return out;
})();

const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

// Franja favorita: "D|HH:MM" (D = día ISO 1..7) o legacy "HH:MM" (sin día).
const parseSlot = (s: string): { dow: number | null; time: string } => {
  if (s.includes('|')) {
    const [d, t] = s.split('|');
    const n = parseInt(d, 10);
    return { dow: n >= 1 && n <= 7 ? n : null, time: t };
  }
  return { dow: null, time: s };
};
const fmtSlot = (s: string): string => {
  const { dow, time } = parseSlot(s);
  return dow ? `${DOW_NAME[dow]} ${time}` : time;
};

// Día ISO (1=Lun..7=Dom) de una fecha 'YYYY-MM-DD'.
const isoDow = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=Dom..6=Sáb
  return js === 0 ? 7 : js;
};
// Mueve una fecha al día `targetDow` DENTRO de su misma semana.
const snapToDow = (iso: string, targetDow: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const cur = dt.getDay() === 0 ? 7 : dt.getDay();
  dt.setDate(dt.getDate() + (targetDow - cur));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const dateLabel = (iso: string | null): string => {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-');
  return d && m ? `${DOW_NAME[isoDow(iso)]} ${d}/${m}/${y?.slice(2) ?? ''}` : iso;
};

export const ClubScheduleScreen = ({
  navigation,
}: ClubStackScreenProps<'ClubSchedule'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);

  const [matches, setMatches] = useState<ClubHomeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClubHomeMatch | null>(null);

  const load = useCallback(async () => {
    if (!club) return;
    try {
      setMatches(await getClubHomeSchedule(club.id));
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [club]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const groups = useMemo(() => {
    const map = new Map<string, ClubHomeMatch[]>();
    for (const m of matches) {
      const k = m.match_date ?? '—';
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [matches]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>HORARIOS DE LOCAL</Text>
          <Text style={styles.title} numberOfLines={1}>
            {matches.length} partido{matches.length === 1 ? '' : 's'} en casa
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Sin partidos de local</Text>
          <Text style={styles.emptyText}>
            Cuando tus equipos tengan jornadas en casa por jugar, aparecerán aquí
            para ponerles día y hora.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(([date, items]) => (
            <View key={date} style={{ marginTop: 18 }}>
              <Text style={styles.groupDate}>
                {dateLabel(date === '—' ? null : date)}
              </Text>
              <View style={{ gap: 8 }}>
                {items.map((m) => (
                  <Pressable
                    key={m.matchday_id}
                    onPress={() => setEditing(m)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTeam} numberOfLines={1}>
                        {m.team_name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {m.jornada_number ? `J${m.jornada_number}` : 'Jornada'}
                        {m.opponent ? ` · vs ${m.opponent}` : ''}
                      </Text>
                    </View>
                    <View style={styles.rowTimeWrap}>
                      {m.match_time ? (
                        <Text style={styles.rowTime}>{hhmm(m.match_time)}</Text>
                      ) : (
                        <Text style={styles.rowTimeEmpty}>Sin hora</Text>
                      )}
                      {m.location ? (
                        <Text style={styles.rowCourt} numberOfLines={1}>
                          {m.location}
                        </Text>
                      ) : null}
                    </View>
                    <IconChevron size={14} color={c.textFaint} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <EditScheduleSheet
        match={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────
const EditScheduleSheet: React.FC<{
  match: ClubHomeMatch | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [slots, setSlots] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // "D|HH:MM"
  const [court, setCourt] = useState('');
  const [adding, setAdding] = useState(false);
  const [addDow, setAddDow] = useState<number>(6); // sábado por defecto
  const [managing, setManaging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setSlots([...(match.preferred_home_slots ?? [])]);
    // Estado inicial: si el partido ya tiene hora, lo reflejamos como slot
    // con el día actual de la jornada.
    if (match.match_time) {
      const dow = match.match_date ? isoDow(match.match_date) : null;
      setSelected(dow ? `${dow}|${hhmm(match.match_time)}` : hhmm(match.match_time));
    } else {
      setSelected(null);
    }
    setAddDow(match.match_date ? isoDow(match.match_date) : 6);
    setAdding(false);
    setManaging(false);
  }, [match]);

  const persistSlots = async (next: string[]) => {
    if (!match) return;
    const uniq = Array.from(new Set(next)).sort();
    setSlots(uniq);
    try {
      await setTeamPreferredSlots(match.team_id, uniq);
    } catch (e: any) {
      toast.error('No se pudo guardar la franja', e?.message ?? '');
    }
  };

  const addFavorite = (time: string) => {
    const slot = `${addDow}|${time}`;
    setSelected(slot);
    setAdding(false);
    if (!slots.includes(slot)) persistSlots([...slots, slot]);
  };

  const save = async () => {
    if (!match || !selected) {
      toast.error('Elige día y hora');
      return;
    }
    const { dow, time } = parseSlot(selected);
    setSaving(true);
    try {
      const patch: {
        match_time: string;
        location: string | null;
        match_date?: string | null;
      } = {
        match_time: `${time}:00`,
        location: court.trim() || null,
      };
      // Si la franja lleva día y la jornada tiene fecha, ajustamos la fecha a
      // ese día dentro de su semana.
      if (dow && match.match_date) patch.match_date = snapToDow(match.match_date, dow);
      await updateMatchday(match.matchday_id, patch);
      notifyPush('schedule_set', match.matchday_id);
      toast.success('Horario enviado al equipo');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={!!match}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !selected}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !selected) && { opacity: 0.5 },
            pressed && !saving && selected && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar y avisar al equipo</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>HORARIO DE LOCAL</Text>
      <Text style={styles.sheetTitle} numberOfLines={1}>
        {match?.team_name ?? ''}
      </Text>
      <Text style={styles.sheetSub}>
        {match?.jornada_number ? `J${match.jornada_number}` : 'Jornada'}
        {match?.opponent ? ` · vs ${match.opponent}` : ''} ·{' '}
        {dateLabel(match?.match_date ?? null)}
      </Text>

      {/* Franjas favoritas (día + hora) */}
      <View style={styles.favHeader}>
        <Text style={styles.sectionLabel}>FRANJAS FAVORITAS</Text>
        {slots.length > 0 ? (
          <Pressable onPress={() => setManaging((v) => !v)} hitSlop={8}>
            <Text style={styles.manageLink}>{managing ? 'Listo' : 'Editar'}</Text>
          </Pressable>
        ) : null}
      </View>

      {slots.length === 0 && !adding ? (
        <Text style={styles.hint}>
          Añade las franjas habituales de este equipo (p. ej. Sáb 10:00, Sáb
          17:00) para asignarlas de un toque.
        </Text>
      ) : (
        <View style={styles.chipsWrap}>
          {slots.map((s) => {
            const sel = selected === s;
            return (
              <Pressable
                key={s}
                onPress={() =>
                  managing ? persistSlots(slots.filter((x) => x !== s)) : setSelected(s)
                }
                style={[
                  styles.chip,
                  sel && !managing && { backgroundColor: c.accent, borderColor: c.accent },
                  managing && { borderColor: withAlpha(c.error, 0.5) },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: sel && !managing ? c.textInverse : c.text },
                  ]}
                >
                  {fmtSlot(s)}
                </Text>
                {managing ? <IconX size={12} color={c.error} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Añadir franja: día + hora */}
      {adding ? (
        <View style={styles.addBox}>
          <Text style={styles.sectionLabel}>DÍA</Text>
          <View style={styles.dowRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const sel = addDow === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setAddDow(d)}
                  style={[
                    styles.dowCell,
                    sel && { backgroundColor: c.accent, borderColor: c.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dowText,
                      { color: sel ? c.textInverse : c.text },
                    ]}
                  >
                    {DOW_SHORT[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>HORA</Text>
          <View style={styles.chipsWrap}>
            {TIME_OPTIONS.map((t) => (
              <Pressable key={t} onPress={() => addFavorite(t)} style={styles.timeCell}>
                <Text style={styles.timeCellText}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setAdding(false)} hitSlop={8}>
            <Text style={[styles.manageLink, { marginTop: 6 }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.addBtnText}>+ Añadir franja favorita</Text>
        </Pressable>
      )}

      {/* Franja elegida */}
      <View style={styles.selectedRow}>
        <Text style={styles.sectionLabel}>DÍA Y HORA ELEGIDOS</Text>
        <Text style={[styles.selectedTime, !selected && { color: c.textFaint }]}>
          {selected ? fmtSlot(selected) : '—'}
        </Text>
      </View>

      {/* Pista (opcional) */}
      <Text style={styles.sectionLabel}>PISTA / LUGAR · OPCIONAL</Text>
      <View style={styles.courtInput}>
        <TextInput
          value={court}
          onChangeText={setCourt}
          placeholder="Pista 1, Central…"
          placeholderTextColor={c.textFaint}
          style={styles.courtInputField}
          maxLength={40}
        />
        {court ? <IconCheck size={14} color={c.accent} /> : null}
      </View>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 2,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 8,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    groupDate: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      color: c.textFaint,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowTeam: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    rowTimeWrap: { alignItems: 'flex-end' },
    rowTime: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 16,
      fontWeight: '700',
    },
    rowTimeEmpty: { color: c.textFaint, fontFamily: Fonts.mono, fontSize: 12 },
    rowCourt: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    // Sheet
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    sheetTitle: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
    },
    sheetSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    favHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 8,
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    manageLink: { color: c.accent, fontSize: 13, fontWeight: '600' },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 42,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    chipText: { fontFamily: Fonts.mono, fontSize: 15, fontWeight: '600' },
    addBtn: { marginTop: 10 },
    addBtnText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    addBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      gap: 8,
    },
    dowRow: { flexDirection: 'row', gap: 6 },
    dowCell: {
      flex: 1,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dowText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    timeCell: {
      paddingHorizontal: 12,
      height: 38,
      borderRadius: Radius.sm,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeCellText: {
      fontFamily: Fonts.mono,
      fontSize: 14,
      color: c.text,
      fontWeight: '600',
    },
    selectedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 16,
    },
    selectedTime: {
      fontFamily: Fonts.mono,
      fontSize: 20,
      fontWeight: '800',
      color: c.accent,
      letterSpacing: 0.5,
    },
    courtInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
    },
    courtInputField: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 0,
    },
    saveBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
