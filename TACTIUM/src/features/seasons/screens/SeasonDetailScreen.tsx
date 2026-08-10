import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { useColors, type Palette } from '@core/theme';
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
  isoTimeToDate, IconCamera, IconHome, IconPlane } from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as SeasonsApi from '@core/services/seasons';
import * as LineupsApi from '@core/services/lineups';
import { matchdayState, type MatchdayVisualState } from '@core/utils/matchday';
import { tandasOptions } from '@core/utils/tandas';
import { getCourtsForCompetition } from '@core/data/federations';
import { notifyPush } from '@core/push';
import { useTeamStore, selectIsCaptain } from '@store/teamStore';
import type { ScannedMatchday } from '@core/services/imageRecognition';

import { usePremiumGate } from '@core/hooks/usePremiumGate';

import type { SeasonsStackScreenProps } from '@navigation/types';
import { FcpStandings } from '../components/FcpStandings';
import { FcpBracketView } from '../components/FcpBracketView';
import { fetchTeamPlayoff, type FcpTeamPlayoff } from '@core/services/fcpBracket';

// ─── Types ──────────────────────────────────────────────────────────
type FilterKey = 'all' | 'pending' | 'played';
type SeasonTab = 'clasif' | 'jornadas' | 'cuadro';

// ─── Screen ─────────────────────────────────────────────────────────
export const SeasonDetailScreen = ({
  navigation,
  route,
}: SeasonsStackScreenProps<'SeasonDetail'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const seasonId = route.params.id;

  const team = useTeamStore((s) => s.team);
  const isCaptain = useTeamStore(selectIsCaptain);
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays] = useState<MatchdaysApi.Matchday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  // Ligas federadas: la temporada se parte en dos pestañas (Clasificación |
  // Jornadas). Otras federaciones/manual: solo jornadas, como siempre.
  const isFcp = team?.federation === 'FCantP';
  const [tab, setTab] = useState<SeasonTab>('clasif');
  // Cuadro(s) de playoff del equipo (si la fase eliminatoria ya existe en la FCP).
  const [playoff, setPlayoff] = useState<FcpTeamPlayoff | null>(null);
  const [selPlayoffGroup, setSelPlayoffGroup] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // OJO: no inicializar a `autoOpen==='scan'` directamente — abriría el escaneo
  // (premium) sin pasar por el gate. Se abre vía `openScan()` en un efecto.
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<MatchdaysApi.Matchday | null>(null);
  const [closingSeason, setClosingSeason] = useState(false);

  // Reverse trial: crear jornada / escanear son acciones premium. El gate
  // comprueba la sub EN EL MOMENTO de la acción → bloquea tanto al usuario
  // nuevo como al que canceló/caducó teniendo ya la temporada creada.
  const gate = usePremiumGate();
  const openAddMatchday = gate(() => setAdding(true), 'matchday_create');
  const openScan = gate(() => setScanning(true), 'calendar_scan');

  // autoOpen desde atajo/deep-link: abre el escáner PASANDO por el gate premium
  // (no confiar en el caller). Solo al montar.
  React.useEffect(() => {
    if (route.params.autoOpen === 'scan') openScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edición permitida solo si la temporada está activa Y el usuario es
  // captain. Temporadas archivadas son siempre read-only.
  const canEditSeason = season?.active === true && isCaptain;

  const handleBulkMatchdays = async (scanned: ScannedMatchday[]) => {
    // Validamos TODO antes de insertar nada: una fila con fecha/hora mal
    // formada haría que Postgres rechazara ese INSERT a mitad del bucle,
    // dejando jornadas insertadas a medias (y reintentar duplicaría). Mejor
    // bloquear en bloque con un mensaje claro y no tocar la BD.
    const dateOk = (d: string | null | undefined) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);
    const timeOk = (t: string | null | undefined) => !t || /^\d{1,2}:\d{2}$/.test(t);
    for (let i = 0; i < scanned.length; i++) {
      const m = scanned[i];
      if (!m.opponent.trim()) throw new Error(`Fila ${i + 1}: falta el rival.`);
      if (!dateOk(m.match_date)) throw new Error(`Fila ${i + 1}: fecha inválida (AAAA-MM-DD).`);
      if (!timeOk(m.match_time)) throw new Error(`Fila ${i + 1}: hora inválida (HH:MM).`);
    }
    const baseN = matchdays.length + 1;
    try {
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
      // Reordenar por fecha (como el alta manual). En ligas FCP NO: el número
      // oficial de la Federación manda y no se debe renumerar.
      if (team?.federation !== 'FCantP') {
        await MatchdaysApi.renumberSeasonMatchdays(seasonId);
      }
    } finally {
      // Refrescamos siempre — también si un INSERT falló a mitad — para que la
      // lista refleje lo que sí entró y no quede desincronizada.
      await reload();
    }
  };

  // Spinner solo en la PRIMERA carga; los refrescos al volver a foco se hacen
  // en segundo plano para no parpadear a spinner con datos ya en pantalla.
  const didLoadRef = React.useRef(false);
  const reload = React.useCallback(async () => {
    if (!didLoadRef.current) setLoading(true);
    try {
      const [seasonData, list] = await Promise.all([
        SeasonsApi.fetchSeasonById(seasonId),
        MatchdaysApi.fetchMatchdays(seasonId),
      ]);
      setSeason(seasonData);
      setMatchdays(list);
    } finally {
      didLoadRef.current = true;
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

  // Cuadro de playoff del equipo (solo ligas FCP): si existe fase eliminatoria
  // con este equipo, habilitamos la pestaña "Cuadro" con su recorrido resaltado.
  useEffect(() => {
    if (!isFcp || !team?.id) {
      setPlayoff(null);
      return;
    }
    let alive = true;
    fetchTeamPlayoff(team.id)
      .then((p) => {
        if (!alive) return;
        setPlayoff(p);
        setSelPlayoffGroup(p?.groups[0]?.idGrupo ?? null);
      })
      .catch(() => alive && setPlayoff(null));
    return () => {
      alive = false;
    };
  }, [isFcp, team?.id]);

  // ── Stats ──────────────────────────────────────────────────────────
  const wins   = matchdays.filter((m) => m.outcome === 'win').length;
  const draws  = matchdays.filter((m) => m.outcome === 'draw').length;
  const losses = matchdays.filter((m) => m.outcome === 'loss').length;
  const played = wins + draws + losses;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null;
  const allDisputed =
    matchdays.length > 0 &&
    matchdays.every((m) => m.outcome !== null);

  // ── Cerrar temporada ──────────────────────────────────────────────
  // Cerrar una temporada con jornadas sin cerrar es VÁLIDO: la temporada
  // se archiva (no se pueden añadir jornadas nuevas, no se pueden editar
  // los meta-datos de la temporada) PERO las jornadas individuales que
  // sigan sin outcome se pueden seguir abriendo desde la lista, registrar
  // resultados y cerrar acta normalmente. El Alert lo aclara explícitamente
  // para que el capitán cierre sin miedo a "perder" jornadas pendientes.
  const confirmCloseSeason = useCallback(async () => {
    if (!season || closingSeason) return;
    setClosingSeason(true);
    try {
      // Pre-cálculo para el Alert: contamos jornadas sin alineación
      // completa y jornadas sin resultado (outcome=null). Solo cuentan
      // las jornadas que NO están ya finalizadas — una jornada finalizada
      // tiene acta cerrada y no tiene sentido marcarla como pendiente.
      const courts = getCourtsForCompetition(
        team?.federation,
        team?.league,
        team?.gender,
      );
      const liveMatchdays = matchdays.filter((m) => m.status !== 'finished');
      const lineupCompletion = await LineupsApi.fetchLineupCompletionByMatchdays(
        liveMatchdays.map((m) => m.id),
        courts,
      );
      const pendingLineup = liveMatchdays.filter(
        (m) => !lineupCompletion.get(m.id),
      ).length;
      const pendingResult = matchdays.filter((m) => m.outcome === null).length;

      const baseMsg = `La temporada "${season.name}" pasará al histórico. No podrás añadir jornadas nuevas ni editar alineaciones, pero los resultados pendientes podrás registrarlos cuando quieras.`;

      const parts: string[] = [];
      if (pendingLineup > 0) {
        parts.push(
          pendingLineup === 1
            ? '1 jornada sin alineación'
            : `${pendingLineup} jornadas sin alineación`,
        );
      }
      if (pendingResult > 0) {
        parts.push(
          pendingResult === 1
            ? '1 jornada sin resultado'
            : `${pendingResult} jornadas sin resultado`,
        );
      }
      const warning =
        parts.length > 0
          ? `\n\nTienes ${parts.join(' y ')}. Al cerrar ya no podrás editar las alineaciones, pero sí registrar los resultados pendientes.`
          : '';

      Alert.alert('Cerrar temporada', `${baseMsg}${warning}`, [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => setClosingSeason(false),
        },
        {
          text: 'Cerrar temporada',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await SeasonsApi.closeSeason(season.id);
              setSeason(updated);
            } catch (e: any) {
              Alert.alert(
                'No se pudo cerrar',
                e?.message ?? 'Inténtalo de nuevo.',
              );
            } finally {
              setClosingSeason(false);
            }
          },
        },
      ]);
    } catch (e: any) {
      setClosingSeason(false);
      Alert.alert(
        'No se pudo preparar el cierre',
        e?.message ?? 'Inténtalo de nuevo.',
      );
    }
  }, [season, matchdays, closingSeason, team]);

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
          <IconBack size={16} color={c.text} />
          <Text style={styles.navBtnLabel}>Temporadas</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canEditSeason ? (
            <>
              <Pressable
                onPress={openScan}
                style={({ pressed }) => [
                  styles.scanBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconCamera size={16} color={c.accent} />
              </Pressable>
              <Pressable
                onPress={openAddMatchday}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Añadir jornada"
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconPlus size={16} color={c.accent} />
              </Pressable>
            </>
          ) : null}
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
            <StatCell label="V" value={String(wins)} color={c.accent} />
            <StatCell label="E" value={String(draws)} />
            <StatCell label="D" value={String(losses)} color={c.error} />
            <View style={styles.statDivider} />
            <StatCell label="Tasa V" value={winRate !== null ? `${winRate}%` : '—'} color={c.warning} />
          </View>
        </View>

        {/* ── Section tabs (Clasificación | Jornadas) · solo ligas FCP ── */}
        {isFcp ? (
          <View style={styles.sectionTabs}>
            {(
              (playoff
                ? [
                    ['clasif', 'Clasificación'],
                    ['jornadas', 'Jornadas'],
                    ['cuadro', 'Cuadro'],
                  ]
                : [
                    ['clasif', 'Clasificación'],
                    ['jornadas', 'Jornadas'],
                  ]) as [SeasonTab, string][]
            ).map(([key, label]) => {
              const on = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.sectionTab, on && styles.sectionTabOn]}
                >
                  <Text style={[styles.sectionTabText, on && styles.sectionTabTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isFcp && tab === 'clasif' && team ? (
          <View style={{ marginHorizontal: 20, marginTop: 16 }}>
            <FcpStandings
              teamId={team.id}
              onTeamPress={(idEquipo, teamName) =>
                navigation.navigate('FcpTeam', { idEquipo, name: teamName })
              }
            />
          </View>
        ) : isFcp && tab === 'cuadro' && playoff ? (
          <View style={{ marginHorizontal: 20, marginTop: 16 }}>
            {playoff.groups.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingBottom: 12 }}
              >
                {playoff.groups.map((g) => {
                  const on = g.idGrupo === selPlayoffGroup;
                  return (
                    <Pressable
                      key={g.idGrupo}
                      onPress={() => setSelPlayoffGroup(g.idGrupo)}
                      style={[styles.cuadroChip, on && styles.cuadroChipOn]}
                    >
                      <Text style={[styles.cuadroChipText, on && styles.cuadroChipTextOn]} numberOfLines={1}>
                        {g.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <FcpBracketView
              idGrupo={selPlayoffGroup ?? playoff.groups[0].idGrupo}
              highlightTeam={playoff.teamName}
            />
          </View>
        ) : (
          <>
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
              <Text style={[styles.filterTabCount, filter === key && { color: c.accent }]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── List ── */}
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginVertical: 32 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? canEditSeason
                  ? 'Aún no hay jornadas. Crea la primera.'
                  : 'El capitán aún no ha añadido jornadas.'
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
                onOpen={() => navigation.navigate('Jornada', { matchdayId: m.id })}
                onEdit={
                  canEditSeason
                    ? gate(() => setEditing(m), 'matchday_edit')
                    : undefined
                }
              />
            ))}
          </View>
        )}

        {/* ── Dashed add button (solo si captain + temporada activa) ── */}
        {!loading && canEditSeason ? (
          <Pressable
            onPress={openAddMatchday}
            style={({ pressed }) => [styles.dashedAdd, pressed && { opacity: 0.7 }]}
          >
            <IconPlus size={14} color={c.accent} />
            <Text style={styles.dashedAddText}>Crear nueva jornada</Text>
          </Pressable>
        ) : null}

        {/* ── Cerrar temporada (solo captain con temporada activa) ──
            Disponible siempre que esté activa; si quedan jornadas sin
            disputar se avisa en el Alert pero se permite. */}
        {!loading && canEditSeason ? (
          <Pressable
            onPress={confirmCloseSeason}
            disabled={closingSeason}
            style={({ pressed }) => [
              styles.closeSeasonBtn,
              closingSeason && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {closingSeason ? (
              <ActivityIndicator color={c.error} size="small" />
            ) : (
              <Text style={styles.closeSeasonLabel}>
                {allDisputed
                  ? 'Cerrar temporada · todas disputadas'
                  : 'Cerrar temporada'}
              </Text>
            )}
          </Pressable>
        ) : null}

        {/* ── Archivada · resumen final ──
            Cuando la temporada está cerrada, una banda discreta indica
            cuándo se cerró y refuerza que la pantalla es solo lectura.
            Los stats agregados ya viven en el strip de arriba. */}
        {!loading && season && !season.active ? (
          <View style={styles.archivedNote}>
            <Text style={styles.archivedNoteTitle}>Temporada archivada</Text>
            <Text style={styles.archivedNoteText}>
              {`Cerrada${season.end_date ? ` el ${season.end_date}` : ''}. Jornadas y resultados visibles en solo lectura.`}
            </Text>
          </View>
        ) : null}
          </>
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
const StatCell: React.FC<{ label: string; value: string; highlight?: boolean; color?: string }> = ({
  label, value, highlight, color,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, highlight && { color: c.accent }, color && { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
  );
};

// Fecha ISO "YYYY-MM-DD" → "DD/MM" (compacto para la línea de info).
const shortDate = (d: string): string => {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : d;
};

// ─── MatchdayRow ─────────────────────────────────────────────────────
const MatchdayRow: React.FC<{
  matchday: MatchdaysApi.Matchday;
  state: MatchdayVisualState;
  isNext: boolean;
  isLast: boolean;
  onOpen: () => void;
  // onEdit es opcional: temporadas archivadas no muestran el botón pencil.
  onEdit?: () => void;
}> = ({ matchday: m, state, isNext, isLast, onOpen, onEdit }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const outcomeMeta = m.outcome
    ? {
        win:  { color: c.accent,  bg: c.accent15,              border: c.accent40, label: 'V' },
        draw: { color: c.warning, bg: 'rgba(242,201,76,0.15)',       border: 'rgba(242,201,76,0.40)', label: 'E' },
        loss: { color: c.error,   bg: 'rgba(255,107,107,0.15)',      border: 'rgba(255,107,107,0.40)', label: 'D' },
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
          <Text style={[styles.jornadaBadgeText, isNext && { color: c.accent }]}>
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
            {m.opponent}
          </Text>
          <View style={styles.metaRow}>
            {m.is_home ? (
              <IconHome size={12} color={c.textFaint} />
            ) : (
              <IconPlane size={12} color={c.textFaint} />
            )}
            <Text style={[styles.rowMeta, { marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
              {m.is_home ? 'Casa' : 'Fuera'}
              {m.match_date ? ` · ${shortDate(m.match_date)}` : ''}
              {m.match_time ? ` · ${m.match_time.slice(0, 5)}` : ''}
            </Text>
          </View>
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

      {/* Edit button — solo si onEdit existe (temporada activa). */}
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.5 }]}
        >
          <IconPencil size={14} color={c.textFaint} />
        </Pressable>
      ) : null}
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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((s) => s.team);
  const courts = React.useMemo(
    () => getCourtsForCompetition(team?.federation, team?.league, team?.gender),
    [team?.federation, team?.league, team?.gender],
  );
  const tandaChoices = React.useMemo(
    () => tandasOptions(courts),
    [courts],
  );

  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [matchDate, setMatchDate] = useState<Date | null>(null);
  const [matchTime, setMatchTime] = useState<Date | null>(null);
  const [isHome, setIsHome] = useState(true);
  // Distribución de tandas opcional. null = sin especificar.
  const [tandas, setTandas] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setOpponent('');
      setLocation('');
      setMatchDate(null);
      setMatchTime(null);
      setIsHome(true);
      setTandas(null);
      // Reset del flag de submitting — mismo bug que en CreateSeasonSheet:
      // sheet permanentemente montado deja el spinner residual al reabrir.
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    if (!opponent.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await MatchdaysApi.createMatchday(seasonId, {
        jornada_number: nextJornadaNumber,
        opponent: opponent.trim(),
        match_date: matchDate ? dateToIsoDate(matchDate) : undefined,
        match_time: matchTime ? dateToIsoTime(matchTime) : undefined,
        is_home: isHome,
        location: location.trim() || undefined,
        tandas,
      });
      // Renumera por fecha: si la nueva jornada es retroactiva, se "encaja"
      // en su posición cronológica y las posteriores se desplazan.
      // EXCEPTO en ligas federadas (FCantP): el jornada_number lo fija la
      // Federación y muchas jornadas van sin fecha → renumerar por fecha las
      // mandaría al final. Ahí el número oficial es el orden canónico.
      if (team?.federation !== 'FCantP') {
        await MatchdaysApi.renumberSeasonMatchdays(seasonId);
      }
      // Avisa a la plantilla de la nueva jornada (best-effort; solo alta manual,
      // NO en la importación masiva de calendario para no spamear). Se OMITE si
      // la jornada es de fecha pasada (encaje retroactivo): no tiene sentido
      // avisar de un partido ya jugado.
      const isPastDate = matchDate
        ? dateToIsoDate(matchDate) < new Date().toISOString().slice(0, 10)
        : false;
      if (!isPastDate) void notifyPush('matchday_created', created.id);
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
            ? <ActivityIndicator color={c.textInverse} />
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
          placeholderTextColor={c.textFaint}
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
          <Text style={[styles.venueLabel, { color: isHome ? c.textInverse : c.text }]}>
            Local
          </Text>
          <Text style={[styles.venueSub, { color: isHome ? 'rgba(0,24,16,0.6)' : c.textFaint }]}>
            En nuestras pistas
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsHome(false)}
          style={[styles.venueCell, !isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: !isHome ? c.textInverse : c.text }]}>
            Visitante
          </Text>
          <Text style={[styles.venueSub, { color: !isHome ? 'rgba(0,24,16,0.6)' : c.textFaint }]}>
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
          placeholderTextColor={c.textFaint}
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

      <Text style={styles.sheetLabel}>
        TANDAS · OPCIONAL ({courts} parejas)
      </Text>
      <TandasPicker
        value={tandas}
        options={tandaChoices}
        onChange={setTandas}
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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((s) => s.team);
  const courts = React.useMemo(
    () => getCourtsForCompetition(team?.federation, team?.league, team?.gender),
    [team?.federation, team?.league, team?.gender],
  );
  const tandaChoices = React.useMemo(
    () => tandasOptions(courts),
    [courts],
  );

  const [opponent, setOpponent]   = useState(m.opponent);
  const [location, setLocation]   = useState(m.location ?? '');
  const [matchDate, setMatchDate] = useState<Date | null>(
    m.match_date ? isoDateToDate(m.match_date) : null,
  );
  const [matchTime, setMatchTime] = useState<Date | null>(
    m.match_time ? isoTimeToDate(m.match_time) : null,
  );
  const [isHome, setIsHome]       = useState(m.is_home);
  const [tandas, setTandas]       = useState<string | null>(m.tandas ?? null);
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
        tandas,
      });

      // Si cambió la fecha, reordenamos toda la temporada — salvo en ligas
      // federadas (FCantP), donde el jornada_number oficial manda y las
      // jornadas sin fecha no deben irse al final.
      if (dateChanged && team?.federation !== 'FCantP') {
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
              <ActivityIndicator color={c.error} size="small" />
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
              <ActivityIndicator color={c.textInverse} />
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
          placeholderTextColor={c.textFaint}
          style={styles.sheetInput}
        />
      </View>

      <Text style={styles.sheetLabel}>LOCALIZACIÓN</Text>
      <View style={styles.venueRow}>
        <Pressable
          onPress={() => setIsHome(true)}
          style={[styles.venueCell, isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: isHome ? c.textInverse : c.text }]}>Local</Text>
          <Text style={[styles.venueSub, { color: isHome ? 'rgba(0,24,16,0.6)' : c.textFaint }]}>En nuestras pistas</Text>
        </Pressable>
        <Pressable
          onPress={() => setIsHome(false)}
          style={[styles.venueCell, !isHome && styles.venueCellActive]}
        >
          <Text style={[styles.venueLabel, { color: !isHome ? c.textInverse : c.text }]}>Visitante</Text>
          <Text style={[styles.venueSub, { color: !isHome ? 'rgba(0,24,16,0.6)' : c.textFaint }]}>Fuera de casa</Text>
        </Pressable>
      </View>

      <Text style={styles.sheetLabel}>LUGAR (OPCIONAL)</Text>
      <View style={styles.sheetInputWrap}>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Ej. Club Pádel Indoor, Pista 3"
          placeholderTextColor={c.textFaint}
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

      <Text style={styles.sheetLabel}>
        TANDAS · OPCIONAL ({courts} parejas)
      </Text>
      <TandasPicker
        value={tandas}
        options={tandaChoices}
        onChange={setTandas}
      />
    </BottomSheet>
  );
};

// ─── TandasPicker ────────────────────────────────────────────────────
// Selector visual: chip "Sin tanda" + un chip por cada composición
// posible del número de parejas. Scroll horizontal porque N≥5 genera 16+
// opciones que no caben de un golpe.
const TandasPicker: React.FC<{
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}> = ({ value, options, onChange }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 16 }}
    >
      <Pressable
        onPress={() => onChange(null)}
        style={({ pressed }) => [
          styles.tandaChip,
          value === null && styles.tandaChipActive,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text
          style={[
            styles.tandaChipLabel,
            value === null && styles.tandaChipLabelActive,
          ]}
        >
          Sin tanda
        </Text>
      </Pressable>
      {options.map((opt) => {
        const sel = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={({ pressed }) => [
              styles.tandaChip,
              sel && styles.tandaChipActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.tandaChipLabel,
                sel && styles.tandaChipLabelActive,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },

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
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtnLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    color: c.accent,
    fontWeight: '500',
  },
  title: {
    color: c.text,
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
    borderTopColor: c.hair,
  },
  statCell: { alignItems: 'flex-start' },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statDivider: { width: 1, height: 28, backgroundColor: c.hair },

  // Filter
  sectionTabs: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.hair,
    padding: 4,
  },
  sectionTab: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTabOn: { backgroundColor: c.accent },
  sectionTabText: { color: c.textMuted, fontSize: 14, fontWeight: '700' },
  sectionTabTextOn: { color: c.textInverse },
  cuadroChip: {
    maxWidth: 220,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cuadroChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  cuadroChipText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
  cuadroChipTextOn: { color: c.textInverse },
  filterWrap: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.hair,
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
  filterTabActive: { backgroundColor: c.bgRaised },
  filterTabLabel: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTabLabelActive: { color: c.text },
  filterTabCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
  },

  // List
  list: {
    marginHorizontal: 20,
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: c.hair,
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
    backgroundColor: c.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jornadaBadgeNext: {
    backgroundColor: c.accent10,
  },
  jornadaBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.text,
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
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowMeta: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  tandasBadge: {
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tandasBadgeText: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  upcomingText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.accent,
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
    color: c.warning,
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
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    alignItems: 'center',
  },
  emptyText: {
    color: c.textMuted,
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
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedAddText: { color: c.accent, fontSize: 14, fontWeight: '600' },

  // Cerrar temporada — discreto al final, color error suave para
  // marcar que es una acción no reversible. Aparece sólo cuando la
  // temporada está activa Y el usuario es captain.
  closeSeasonBtn: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${c.error}40`,
    backgroundColor: `${c.error}0D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSeasonLabel: {
    color: c.error,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Banda informativa cuando la temporada está archivada — confirma
  // visualmente que la pantalla es solo lectura y muestra la fecha de
  // cierre si está disponible.
  archivedNote: {
    marginTop: 14,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  archivedNoteTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  archivedNoteText: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  // Sheet shared
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
    marginBottom: 10,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 6,
    paddingLeft: 2,
  },
  sheetInputWrap: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetInput: {
    color: c.text,
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
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  venueCellActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
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
    borderColor: `${c.error}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnLabel: { color: c.error, fontSize: 14, fontWeight: '600' },
  sheetCta: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetCtaLabel: {
    color: c.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },

  // Tandas picker
  tandaChip: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tandaChipActive: {
    backgroundColor: c.accent10,
    borderColor: c.accent,
  },
  tandaChipLabel: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: c.textMuted,
  },
  tandaChipLabelActive: {
    color: c.accent,
  },
});
