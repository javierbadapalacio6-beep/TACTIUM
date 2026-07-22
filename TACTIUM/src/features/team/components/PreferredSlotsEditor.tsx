import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconX } from '@components/ui';
import { toast } from '@store/toastStore';
import { setTeamPreferredSlots } from '@core/services/clubSchedule';

// Franjas favoritas de local de un equipo. Compartido entre la hoja de editar
// equipo (pestaña Equipo, capitán) y los horarios del club (gestor). La RLS de
// `teams` (is_team_admin) deja escribir a ambos.

// Días ISO (1=Lun … 7=Dom).
export const DOW_SHORT = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DOW_NAME = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Rejilla de horas (08:00–23:00 cada 30 min). Evita un picker nativo anidado.
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    const hh = String(h).padStart(2, '0');
    out.push(`${hh}:00`, `${hh}:30`);
  }
  out.push('23:00');
  return out;
})();

// Franja: "D|HH:MM" (con día) o legacy "HH:MM".
export const parseSlot = (s: string): { dow: number | null; time: string } => {
  if (s.includes('|')) {
    const [d, t] = s.split('|');
    const n = parseInt(d, 10);
    return { dow: n >= 1 && n <= 7 ? n : null, time: t };
  }
  return { dow: null, time: s };
};
export const fmtSlot = (s: string): string => {
  const { dow, time } = parseSlot(s);
  return dow ? `${DOW_NAME[dow]} ${time}` : time;
};

export const PreferredSlotsEditor: React.FC<{
  teamId: string;
  initialSlots: string[];
  onChanged?: (slots: string[]) => void;
}> = ({ teamId, initialSlots, onChanged }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [slots, setSlots] = useState<string[]>(initialSlots);
  const [adding, setAdding] = useState(false);
  const [addDow, setAddDow] = useState(6); // sábado por defecto
  const [managing, setManaging] = useState(false);

  // Reset al cambiar de equipo.
  useEffect(() => {
    setSlots(initialSlots);
    setAdding(false);
    setManaging(false);
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (next: string[]) => {
    const uniq = Array.from(new Set(next)).sort();
    setSlots(uniq);
    onChanged?.(uniq);
    try {
      await setTeamPreferredSlots(teamId, uniq);
    } catch (e: any) {
      toast.error('No se pudo guardar la franja', e?.message ?? '');
    }
  };

  return (
    <>
      <View style={styles.favHeader}>
        <Text style={styles.sectionLabel}>FRANJAS FAVORITAS DE LOCAL</Text>
        {slots.length > 0 ? (
          <Pressable onPress={() => setManaging((v) => !v)} hitSlop={8}>
            <Text style={styles.manageLink}>{managing ? 'Listo' : 'Editar'}</Text>
          </Pressable>
        ) : null}
      </View>

      {slots.length === 0 && !adding ? (
        <Text style={styles.hint}>
          Añade las horas habituales de local (p. ej. Sáb 10:00, Sáb 17:00). El
          club las usará para poner los horarios.
        </Text>
      ) : (
        <View style={styles.chipsWrap}>
          {slots.map((s) => (
            <Pressable
              key={s}
              onPress={() => (managing ? persist(slots.filter((x) => x !== s)) : undefined)}
              style={[styles.chip, managing && { borderColor: withAlpha(c.error, 0.5) }]}
            >
              <Text style={styles.chipText}>{fmtSlot(s)}</Text>
              {managing ? <IconX size={12} color={c.error} /> : null}
            </Pressable>
          ))}
        </View>
      )}

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
                  <Text style={[styles.dowText, { color: sel ? c.textInverse : c.text }]}>
                    {DOW_SHORT[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>HORA</Text>
          <View style={styles.chipsWrap}>
            {TIME_OPTIONS.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  const slot = `${addDow}|${t}`;
                  setAdding(false);
                  if (!slots.includes(slot)) persist([...slots, slot]);
                }}
                style={styles.timeCell}
              >
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
    </>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    favHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    chipText: {
      fontFamily: Fonts.mono,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
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
  });
