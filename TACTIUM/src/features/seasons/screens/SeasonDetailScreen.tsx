import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconBack,
  IconPlus,
  IconPencil,
  NeonDot,
  BottomSheet,
  DateField,
  TimeField,
  ScanSheet,
  dateToIsoDate,
  dateToIsoTime,
  isoDateToDate,
  isoTimeToDate,
} from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as SeasonsApi from '@core/services/seasons';
import { matchdayState, type MatchdayVisualState } from '@core/utils/matchday';
import { useTeamStore } from '@store/teamStore';
import type { ScannedMatchday } from '@core/services/imageRecognition';

import type { SeasonsStackScreenProps } from '@navigation/types';

// ─── Types ──────────────────────────────────────────────────────────
type FilterKey = 'all' | 'pending' | 'played';

// ─── Screen ─────────────────────────────────────────────────────────
export const SeasonDetailScreen = ({
  navigation,
  route,
}: SeasonsStackScreenProps<'SeasonDetail'>) => {
  const insets = useSafeAreaInsets();
  const seasonId = route.params.id;

  const team = useTeamStore((s) => s.team);
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays] = useState<MatchdaysApi.Matchday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<MatchdaysApi.Matchday | null>(null);

  const handleBulkMatchdays = async (scanned: ScannedMatchday[]) => {
    // El trigger BD renumera automáticamente tras cada INSERT, así que
    // solo necesitamos pasar un jornada_number temporal único por inserción.
    const baseN = matchdays.length + 1;
    for (let i = 0; i < scanned.length; i++) {
      const m = scanned[i];
      await MatchdaysApi.createMatchday(seasonId, {
        jornada_number: baseN + i,
        opponent: m.opponent.trim(),
        match_date: m.match_date,
        match_time: m.match_time,
        is_home: m.is_home,
      });
    }
    await reload();
  };

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [seasonData, list] = await Promise.all([
        SeasonsApi.fetchSeasonById(seasonId),
        MatchdaysApi.fetchMatchdays(seasonId),
      ]);
      setSeason(seasonData);
      setMatchdays(list);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refresca al volver a la pantalla (p.ej. tras cerrar acta en Jornada
  // o introducir resultados): así "Pendientes/Jugadas" se actualiza solo.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // ── Stats ──────────────────────────────────────────────────────────
  const wins   = matchdays.filter((m) => m.outcome === 'win').length;
  const draws  = matchdays.filter((m) => m.outcome === 'draw').length;
  const losses = matchdays.filter((m) => m.outcome === 'loss').length;
  const played = wins + draws + losses;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null;

  // ── Estado visual por jornada ─────────────────────────────────────
  // Memoizamos el estado por id; como las jornadas no cambian de fecha
  // dentro de un render concreto, una sola pasada basta.
  const stateById = React.useMemo(() => {
    const map = new Map<string, MatchdayVisualState>();
    matchdays.forEach((m) => map.set(m.id, matchdayState(m)));
    return map;
  }, [matchdays]);

  const upcomingCount = matchdays.filter(
    (m) => stateById.get(m.id) === 'upcoming',
  ).length;
  const playedOrPendingCount = matchdays.length - upcomingCount;

  // ── Next matchday: primera futura por fecha, no la más antigua sin acta ──
  const nextMatchday = React.useMemo(() => {
    const upcoming = matchdays.filter(
      (m) => stateById.get(m.id) === 'upcoming',
    );
    if (upcoming.length === 0) return undefined;
    return upcoming.slice().sort((a, b) => {
      // Sin fecha al final
      if (!a.match_date && !b.match_date) return a.jornada_number - b.jornada_number;
      if (!a.match_date) return 1;
      if (!b.match_date) return -1;
      return a.match_date.localeCompare(b.match_date);
    })[0];
  }, [matchdays, stateById]);

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = matchdays.filter((m) => {
    const s = stateById.get(m.id) ?? 'upcoming';
    if (filter === 'pending') return s === 'upcoming';
    // "Jugadas" = ya disputadas (con o sin acta cargada todavía)
    if (filter === 'played')  return s !== 'upcoming';
    return true;
  });

  return (
    <View style={styles.root}>
      {/* ── Nav bar ── */}
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('SeasonsRoot');
          }}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.navBtnLabel}>Temporadas</Text>
        </Pressable>
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
            accessibilityLabel="Añadir jornada"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <IconPlus size={16} color={Colors.accent} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Eyebrow */}
          <View style={styles.eyebrowRow}>
            {season?.active && <NeonDot size={6} />}
            <Text style={styles.eyebrow}>
              {season?.active ? 'ACTIVA' : 'HISTÓRICA'}
              {season?.phase ? ` · ${season.phase.toUpperCase()}` : ''}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{season?.name ?? 'Temporada'}</Text>

          {/* Stat strip */}
          <View style={styles.statStrip}>
            <StatCell label="Jornadas" value={`${played}/${matchdays.length}`} />
            <View style={styles.statDivider} />
            <StatCell label="V" value={String(wins)} highlight />
            <StatCell label="E" value={String(draws)} />
            <StatCell label="D" value={String(losses)} />
            <View style={styles.statDivider} />
            <StatCell label="Tasa V" value={winRate !== null ? `${winRate}%` : '—'} />
          </View>
        </View>

        {/* ── Filter tabs ── */}
        <View style={styles.filterWrap}>
          {([
            ['all',     'Todas',      matchdays.length],
            ['pending', 'Pendientes', upcomingCount],
            ['played',  'Jugadas',    playedOrPendingCount],
          ] as [FilterKey, string, number][]).map(([key, label, count]) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.filterTab, filter === key && styles.filterTabActive]}
            >
              <Text style={[styles.filterTabLabel, filter === key && styles.filterTabLabelActive]}>
                {label}
              </Text>
              <Text style={[styles.filterTabCount, filter === key && { color: Colors.accent }]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── List ── */}
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 32 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Aún no hay jornadas. Crea la primera.'
                : filter === 'pending'
                ? 'No hay jornadas pendientes.'
                : 'No hay jornadas jugadas todavía.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((m, idx) => (
              <MatchdayRow
                key={m.id}
                matchday={m}
                state={stateById.get(m.id) ?? 'upcoming'}
                isNext={m.id === nextMatchday?.id}
                isLast={idx === filtered.length - 1}
                onOpen={() =>
                  navigation.getParent()?.navigate('Home', {
                    screen: 'Jornada',
                    params: { matchdayId: m.id },
                  })
                }
                onEdit={() => setEditing(m)}
              />
            ))}
          </View>
        )}

        {/* ── Dashed add button ── */}
        {!loading && (
          <Pressable
            onPress={() => setAdding(true)}
            style={({ pressed }) => [styles.dashedAdd, pressed && { opacity: 0.7 }]}
          >
            <IconPlus size={14} color={Colors.accent} />
            <Text style={styles.dashedAddText}>Crear nueva jornada</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Sheets ── */}
      <AddMatchdaySheet
        open={adding}
        onClose={() => setAdding(false)}
        seasonId={seasonId}
        nextJornadaNumber={matchdays.length + 1}
        onCreated={() => { setAdding(false); reload(); }}
      />

      {editing && (
        <EditMatchdaySheet
          matchday={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          onDeleted={() => { setEditing(null); reload(); }}
        />
      )}

      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        mode="calendar"
        teamName={team?.name}
        onConfirm={handleBulkMatchdays}
      />
    </View>
  );
};

// ─── StatCell ────────────────────────────────────────────────────────
const StatCell: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, highlight && { color: Colors.accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── MatchdayRow ─────────────────────────────────────────────────────
const MatchdayRow: React.FC<{
  matchday: MatchdaysApi.Matchday;
  state: MatchdayVisualState;
  isNext: boolean;
  isLast: boolean;
  onOpen: () => void;
  onEdit: () => void;
}> = ({ matchday: m, state, isNext, isLast, onOpen, onEdit }) => {
  const outcomeMeta = m.outcome
    ? {
        win:  { color: Colors.accent,  bg: Colors.accent15,              border: Colors.accent40, label: 'V' },
        draw: { color: Colors.warning, bg: 'rgba(242,201,76,0.15)',       border: 'rgba(242,201,76,0.40)', label: 'E' },
        loss: { color: Colors.error,   bg: 'rgba(255,107,107,0.15)',      border: 'rgba(255,107,107,0.40)', label: 'D' },
      }[m.outcome]
    : null;

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      {/* Tap area → open Jornada */}
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.8 }]}
      >
        {/* Badge J## */}
        <View style={[styles.jornadaBadge, isNext && styles.jornadaBadgeNext]}>
          <Text style={[styles.jornadaBadgeText, isNext && { color: Colors.accent }]}>
            J{String(m.jornada_number).padStart(2, '0')}
          </Text>
          {isNext && (
            <View style={styles.neonDotAbsolute}>
              <NeonDot size={5} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowRival} numberOfLines={1}>
            {m.is_home ? '' : '@ '}{m.opponent}
          </Text>
          <Text style={styles.rowMeta}>
            {m.match_date ?? '—'}
            {m.match_time ? ` · ${m.match_time.slice(0, 5)}` : ''}
            {' · '}{m.is_home ? 'CASA' : 'FUERA'}
          </Text>
        </View>

        {/* Outcome / state badge */}
        {outcomeMeta ? (
          <View style={[
            styles.outcomeBadge,
            { backgroundColor: outcomeMeta.bg, borderColor: outcomeMeta.border },
          ]}>
            <Text style={[styles.outcomeBadgeText, { color: outcomeMeta.color }]}>
              {outcomeMeta.label}
            </Text>
          </View>
        ) : state === 'pending-acta' ? (
          <View style={styles.actaBadge}>
            <Text style={styles.actaBadgeText}>ACTA</Text>
          </View>
        ) : (
          <View style={styles.upcomingBadge}>
            <NeonDot size={4} />
            <Text style={styles.upcomingText}>PRÓXIMA</Text>
          </View>
        )}
      </Pressable>

      {/* Edit button */}
      <Pressable
        onPress={onEdit}
        hitSlop={8}
        style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.5 }]}
      >
        <IconPencil size={14} color={Colors.textFaint} />
      </Pressable>
    </View>
  );
};

// ─── AddMatchdaySheet ─────────────────────────────────────────────────
const AddMatchdaySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  seasonId: string;
  nextJornadaNumber: number;
  onCreated: () => void;
}> = ({ open, onClose, seasonId, nextJornadaNumber, onCreated }) => {
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [matchDate, setMatchDate] = useState<Date | null>(null);
  const [matchTime, setMatchTime] = useState<Date | null>(null);
  const [isHome, setIsHome] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setOpponent('');
      setLocation('');
      setMatchDate(null);
      setMatchTime(null);
      setIsHome(true);
    }
  }, [open]);

  const submit = async () => {
    if (!opponent.trim() || submitting) return;
    setSubmitting(true);
    try {
      await MatchdaysApi.createMatchday(seasonId, {
        jornada_number: nextJornadaNumber,
        opponent: opponent.trim(),
        match_date: matchDate ? dateToIsoDate(matchDate) : undefined,
        match_time: matchTime ? dateToIsoTime(matchTime) : undefined,
        is_home: isHome,
        location: location.trim() || undefined,
      });
      // Renumera por fecha: si la nueva jornada es retroactiva, se "encaja"
      // en su posición cronológica y las posteriores se desplazan.
      await MatchdaysApi.renumberSeasonMatchdays(seasonId);
      onCreated();
    } catch (e: any) {
      Alert.alert('Error al crear jornada', e?.message ?? '');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          disabled={submitting || !opponent.trim()}
          onPress={submit}
          style={({ pressed }) => [
            styles.sheetCta,
            (submitting || !opponent.trim()) && { opacity: 0.4 },
            pressed && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={styles.sheetCtaLabel}>Crear jornada</Text>}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>
        NUEVA JORNADA · J{String(nextJornadaNumber).padStart(2, '0')}
      </Text>
      <Text style={styles.sheetTitle}>Añadir jornada</Text>

      <Text style={styles.sheetLabel}>RIVAL</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={opponent}
          onChangeText={setOpponent}
          placeholder="Club Visitante"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
          autoFocus
        />
      </View>

      <Text style={styles.sheetLabel}>LOCALIZACIÓN</Text>
      <View style={styles.venueRow}>
        <Pressable
          onPress={() => setIsHome(true)}
          style={[styles.venueCell, isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: isHome ? Colors.textInverse : Colors.text }]}>
            Local
          </Text>
          <Text style={[styles.venueSub, { color: isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint }]}>
            En nuestras pistas
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsHome(false)}
          style={[styles.venueCell, !isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: !isHome ? Colors.textInverse : Colors.text }]}>
            Visitante
          </Text>
          <Text style={[styles.venueSub, { color: !isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint }]}>
            Fuera de casa
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sheetLabel}>LUGAR (OPCIONAL)</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Ej. Club Pádel Indoor, Pista 3"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
        />
      </View>

      <Text style={styles.sheetLabel}>FECHA</Text>
      <DateField
        value={matchDate}
        onChange={setMatchDate}
        placeholder="Seleccionar fecha"
        label="FECHA DEL PARTIDO"
        allowClear
      />

      <Text style={styles.sheetLabel}>HORA</Text>
      <TimeField
        value={matchTime}
        onChange={setMatchTime}
        placeholder="Seleccionar hora"
        label="HORA DEL PARTIDO"
        allowClear
      />

    </BottomSheet>
  );
};

// ─── EditMatchdaySheet ────────────────────────────────────────────────
const EditMatchdaySheet: React.FC<{
  matchday: MatchdaysApi.Matchday;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}> = ({ matchday: m, onClose, onSaved, onDeleted }) => {
  const [opponent, setOpponent]   = useState(m.opponent);
  const [location, setLocation]   = useState(m.location ?? '');
  const [matchDate, setMatchDate] = useState<Date | null>(
    m.match_date ? isoDateToDate(m.match_date) : null,
  );
  const [matchTime, setMatchTime] = useState<Date | null>(
    m.match_time ? isoTimeToDate(m.match_time) : null,
  );
  const [isHome, setIsHome]       = useState(m.is_home);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const save = async () => {
    if (!opponent.trim() || submitting) return;
    setSubmitting(true);
    try {
      // El outcome NO se edita desde aquí: solo se cambia desde la pantalla
      // de Jornada (al rellenar resultados set a set o al cerrar el acta).
      const newDateIso = matchDate ? dateToIsoDate(matchDate) : null;
      const dateChanged = newDateIso !== (m.match_date ?? null);

      await MatchdaysApi.updateMatchday(m.id, {
        opponent: opponent.trim(),
        match_date: newDateIso,
        match_time: matchTime ? dateToIsoTime(matchTime) : null,
        is_home: isHome,
        location: location.trim() || null,
      });

      // Si cambió la fecha, reordenamos toda la temporada.
      if (dateChanged) {
        await MatchdaysApi.renumberSeasonMatchdays(m.season_id);
      }
      onSaved();
    } catch (e: any) {
      Alert.alert('Error al guardar', e?.message ?? '');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar jornada',
      `¿Eliminar J${String(m.jornada_number).padStart(2, '0')}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { supabase } = await import('@core/supabase/client');
              const { error } = await supabase
                .from('matchdays')
                .delete()
                .eq('id', m.id);
              if (error) throw error;
              onDeleted();
            } catch (e: any) {
              Alert.alert('Error al eliminar', e?.message ?? '');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      footer={
        // Sticky al fondo del sheet (con paddingBottom + safe-area aplicado
        // por el propio BottomSheet) → los botones ya no se cortan abajo.
        <View style={styles.sheetActions}>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={Colors.error} size="small" />
            ) : (
              <Text style={styles.deleteBtnLabel}>Eliminar</Text>
            )}
          </Pressable>
          <Pressable
            disabled={submitting || !opponent.trim()}
            onPress={save}
            style={({ pressed }) => [
              styles.sheetCta,
              { flex: 2 },
              (submitting || !opponent.trim()) && { opacity: 0.4 },
              pressed && !submitting && { opacity: 0.85 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.sheetCtaLabel}>Guardar</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>EDITAR</Text>
      <Text style={styles.sheetTitle}>
        J{String(m.jornada_number).padStart(2, '0')} — {m.opponent}
      </Text>

      <Text style={styles.sheetLabel}>RIVAL</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={opponent}
          onChangeText={setOpponent}
          placeholder="Club Visitante"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
        />
      </View>

      <Text style={styles.sheetLabel}>LOCALIZACIÓN</Text>
      <View style={styles.venueRow}>
        <Pressable
          onPress={() => setIsHome(true)}
          style={[styles.venueCell, isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: isHome ? Colors.textInverse : Colors.text }]}>Local</Text>
          <Text style={[styles.venueSub, { color: isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint }]}>En nuestras pistas</Text>
        </Pressable>
        <Pressable
          onPress={() => setIsHome(false)}
          style={[styles.venueCell, !isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: !isHome ? Colors.textInverse : Colors.text }]}>Visitante</Text>
          <Text style={[styles.venueSub, { color: !isHome ? 'rgba(0,24,16,0.6)' : Colors.textFaint }]}>Fuera de casa</Text>
        </Pressable>
      </View>

      <Text style={styles.sheetLabel}>LUGAR (OPCIONAL)</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Ej. Club Pádel Indoor, Pista 3"
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
        />
      </View>

      <Text style={styles.sheetLabel}>FECHA</Text>
      <DateField
        value={matchDate}
        onChange={setMatchDate}
        placeholder="Seleccionar fecha"
        label="FECHA DEL PARTIDO"
        allowClear
      />

      <Text style={styles.sheetLabel}>HORA</Text>
      <TimeField
        value={matchTime}
        onChange={setMatchTime}
        placeholder="Seleccionar hora"
        label="HORA DEL PARTIDO"
        allowClear
      />
    </BottomSheet>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Nav
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtnLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
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
  scanBtnLabel: { color: Colors.text, fontSize: 13, fontWeight: '500' },

  scroll: { paddingTop: 20 },

  // Header
  header: {
    paddingHorizontal: 22,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 16,
  },

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
  },
  statCell: { alignItems: 'flex-start' },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.hair },

  // Filter
  filterWrap: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'transparent',
  },
  filterTabActive: { backgroundColor: Colors.bgRaised },
  filterTabLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTabLabelActive: { color: Colors.text },
  filterTabCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textFaint,
  },

  // List
  list: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.hair,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 14,
  },

  // J## badge
  jornadaBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: Colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jornadaBadgeNext: {
    backgroundColor: Colors.accent10,
  },
  jornadaBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.text,
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  neonDotAbsolute: {
    position: 'absolute',
    top: -2,
    right: -2,
  },

  // Row info
  rowRival: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
  },

  // Outcome badge
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  outcomeBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Upcoming badge
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.accent40,
    backgroundColor: Colors.accent10,
  },
  upcomingText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.accent,
    letterSpacing: 1,
    fontWeight: '600',
  },

  // "ACTA" badge — partido pasado sin resultados todavía (jornada retroactiva)
  actaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.40)',
    backgroundColor: 'rgba(242,201,76,0.12)',
  },
  actaBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.warning,
    letterSpacing: 1.2,
    fontWeight: '600',
  },

  // Edit button
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  empty: {
    marginHorizontal: 20,
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },

  // Dashed add
  dashedAdd: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedAddText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },

  // Sheet shared
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
    marginBottom: 10,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 6,
    paddingLeft: 2,
  },
  sheetInputWrap: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetInput: {
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },

  // Venue
  venueRow: { flexDirection: 'row', gap: 8 },
  venueCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  venueCellActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  venueLabel: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  venueSub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: 3,
  },

  // Sheet actions — el `marginTop` ya no es necesario porque ahora
  // viven en el `footer` sticky del BottomSheet (que aplica su propio
  // padding superior + bordeTop).
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnLabel: { color: Colors.error, fontSize: 14, fontWeight: '600' },
  sheetCta: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetCtaLabel: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
