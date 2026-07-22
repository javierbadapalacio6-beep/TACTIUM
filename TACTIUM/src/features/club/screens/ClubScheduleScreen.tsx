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

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron, IconCheck, IconPencil, BottomSheet } from '@components/ui';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';
import {
  getClubHomeSchedule,
  currentRoundMatches,
  type ClubHomeMatch,
} from '@core/services/clubSchedule';
import { updateMatchday } from '@core/services/matchdays';
import { notifyPush } from '@core/push';
import {
  PreferredSlotsEditor,
  parseSlot,
  fmtSlot,
  DOW_NAME,
} from '@features/team/components/PreferredSlotsEditor';

import type { ClubStackScreenProps } from '@navigation/types';

const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

const isoDow = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay();
  return js === 0 ? 7 : js;
};
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

// Franjas favoritas de un equipo del store (el campo aún no está en los tipos).
const teamSlotsOf = (t: unknown): string[] =>
  (t as { preferred_home_slots?: string[] })?.preferred_home_slots ?? [];

export const ClubScheduleScreen = ({
  navigation,
}: ClubStackScreenProps<'ClubSchedule'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  const [matches, setMatches] = useState<ClubHomeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClubHomeMatch | null>(null);
  const [editTeam, setEditTeam] = useState<{ id: string; name: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Franjas favoritas por equipo (override local sobre lo del store).
  const [slotsByTeam, setSlotsByTeam] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const t of clubTeams) init[t.id] = teamSlotsOf(t);
    setSlotsByTeam(init);
  }, [clubTeams]);

  const load = useCallback(async () => {
    if (!club) return;
    try {
      const data = await getClubHomeSchedule(club.id);
      setMatches(data);
      setSlotsByTeam((prev) => {
        const next = { ...prev };
        for (const m of data) next[m.team_id] = m.preferred_home_slots ?? [];
        return next;
      });
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

  const roundMatches = useMemo(() => currentRoundMatches(matches), [matches]);
  const hasMore = matches.length > roundMatches.length;
  const visible = showAll ? matches : roundMatches;

  const groups = useMemo(() => {
    const map = new Map<string, ClubHomeMatch[]>();
    for (const m of visible) {
      const k = m.match_date ?? '—';
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  const onSlotsSaved = (teamId: string, slots: string[]) => {
    setSlotsByTeam((prev) => ({ ...prev, [teamId]: slots }));
    load();
  };

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
            {visible.length} partido{visible.length === 1 ? '' : 's'} en casa
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Franjas favoritas por equipo */}
          {clubTeams.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.sectionLabel}>FRANJAS FAVORITAS POR EQUIPO</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {clubTeams.map((t) => {
                  const slots = slotsByTeam[t.id] ?? teamSlotsOf(t);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setEditTeam({ id: t.id, name: t.name })}
                      style={({ pressed }) => [
                        styles.favTeamRow,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.favTeamName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        {slots.length > 0 ? (
                          <Text style={styles.favTeamSlots} numberOfLines={1}>
                            {slots.map(fmtSlot).join(' · ')}
                          </Text>
                        ) : (
                          <Text style={styles.favTeamEmpty}>Sin franjas favoritas</Text>
                        )}
                      </View>
                      <IconPencil size={14} color={c.textFaint} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Partidos de local */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
            PARTIDOS DE LOCAL
          </Text>
          {hasMore ? (
            <View style={styles.segment}>
              {[
                { id: false, label: 'Jornada actual' },
                { id: true, label: 'Todas' },
              ].map((opt) => {
                const sel = showAll === opt.id;
                return (
                  <Pressable
                    key={String(opt.id)}
                    onPress={() => setShowAll(opt.id)}
                    style={[styles.segmentBtn, sel && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: sel ? c.textInverse : c.textMuted },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {matches.length === 0 ? (
            <Text style={styles.emptyText}>
              Cuando tus equipos tengan jornadas en casa por jugar, aparecerán
              aquí para ponerles día y hora.
            </Text>
          ) : (
            groups.map(([date, items]) => (
              <View key={date} style={{ marginTop: 16 }}>
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
            ))
          )}
        </ScrollView>
      )}

      <EditScheduleSheet
        match={editing}
        slots={editing ? slotsByTeam[editing.team_id] ?? editing.preferred_home_slots : []}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      <TeamSlotsSheet
        team={editTeam}
        slots={editTeam ? slotsByTeam[editTeam.id] ?? [] : []}
        onClose={() => setEditTeam(null)}
        onSaved={onSlotsSaved}
      />
    </View>
  );
};

// Hoja de franjas favoritas de un equipo (desde la sección de arriba).
const TeamSlotsSheet: React.FC<{
  team: { id: string; name: string } | null;
  slots: string[];
  onClose: () => void;
  onSaved: (teamId: string, slots: string[]) => void;
}> = ({ team, slots, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <BottomSheet
      open={!!team}
      onClose={onClose}
      footer={
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveLabel}>Listo</Text>
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>FRANJAS FAVORITAS</Text>
      <Text style={styles.sheetTitle} numberOfLines={1}>
        {team?.name ?? ''}
      </Text>
      <Text style={styles.sheetSub}>
        Se usan al poner la hora de los partidos de local de este equipo.
      </Text>
      <View style={{ marginTop: 16 }}>
        {team ? (
          <PreferredSlotsEditor
            teamId={team.id}
            initialSlots={slots}
            onChanged={(s) => onSaved(team.id, s)}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
};

// ─────────────────────────────────────────────────────────────────────────
const EditScheduleSheet: React.FC<{
  match: ClubHomeMatch | null;
  slots: string[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, slots, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [selected, setSelected] = useState<string | null>(null); // "D|HH:MM"
  const [court, setCourt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    if (match.match_time) {
      const dow = match.match_date ? isoDow(match.match_date) : null;
      setSelected(dow ? `${dow}|${hhmm(match.match_time)}` : hhmm(match.match_time));
    } else {
      setSelected(null);
    }
    setCourt(match.location ?? '');
  }, [match]);

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
      } = { match_time: `${time}:00`, location: court.trim() || null };
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

      <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 8 }]}>
        ELIGE UNA FRANJA
      </Text>
      {slots.length === 0 ? (
        <Text style={styles.hint}>
          Este equipo aún no tiene franjas favoritas. Añádelas en la sección de
          arriba (Franjas favoritas por equipo) o desde el equipo.
        </Text>
      ) : (
        <View style={styles.chipsWrap}>
          {slots.map((s) => {
            const sel = selected === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSelected(s)}
                style={[
                  styles.chip,
                  sel && { backgroundColor: c.accent, borderColor: c.accent },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: sel ? c.textInverse : c.text }]}
                >
                  {fmtSlot(s)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.selectedRow}>
        <Text style={styles.sectionLabel}>DÍA Y HORA</Text>
        <Text style={[styles.selectedTime, !selected && { color: c.textFaint }]}>
          {selected ? fmtSlot(selected) : '—'}
        </Text>
      </View>

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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    favTeamRow: {
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
    favTeamName: { color: c.text, fontSize: 15, fontWeight: '600' },
    favTeamSlots: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 12,
      marginTop: 2,
    },
    favTeamEmpty: { color: c.textFaint, fontSize: 12, marginTop: 2 },
    segment: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      padding: 4,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    segmentBtn: {
      flex: 1,
      height: 34,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentBtnActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, fontWeight: '600' },
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
