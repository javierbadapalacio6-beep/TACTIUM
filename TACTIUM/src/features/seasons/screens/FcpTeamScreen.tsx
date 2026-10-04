import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron, IconStar, IconStarFilled } from '@components/ui';
import { StatCell, FormChips, ListHeader, Segmented } from '../components/fcpUi';
import { useFavoritesStore } from '@store/favoritesStore';
import { useTeamStore } from '@store/teamStore';
import { toggleFavorite } from '@core/services/favorites';
import { fetchFcpTeamProfile, type FcpTeamProfile } from '@core/services/fcpProfiles';
import { fetchGroupSchedule, type FcpBrowseMatch } from '@core/services/fcpBrowse';
import { fetchFcpActa, normFcpName, type FcpActaPartido } from '@core/services/fcpSeason';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { groupZones, zoneIn, zoneColor } from '@core/data/fcpZones';
import { useFcpStanding, fmtDay, shortGroupName } from '../components/ligaParts';
import type { CompetirStackScreenProps } from '@navigation/types';

const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Iniciales de un nombre ("Central Padel A" → "CP", "Nuria Hernández" → "NH").
const initials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

type Sort = 'puntos' | 'nombre';
type Tab = 'resumen' | 'partidos' | 'plantilla';

/** Un enfrentamiento del equipo, ya en su perspectiva. */
interface TeamMatch {
  idPartido: string;
  jornada: number | null;
  fecha: string | null;
  hora: string | null;
  rival: string;
  home: boolean;
  us: number | null;
  them: number | null;
  won: boolean | null;
  played: boolean;
}

function toTeamMatches(rows: FcpBrowseMatch[], equipo: string): TeamMatch[] {
  const me = normFcpName(equipo);
  const out: TeamMatch[] = [];
  for (const r of rows) {
    const home = normFcpName(r.local) === me;
    const away = normFcpName(r.visit) === me;
    if (!home && !away) continue;
    const m = (r.resultado ?? '').match(/(\d+)\s*[/\-–]\s*(\d+)/);
    const l = m ? Number(m[1]) : null;
    const v = m ? Number(m[2]) : null;
    const played = l != null && v != null;
    out.push({
      idPartido: r.idPartido,
      jornada: r.jornada,
      fecha: r.fecha,
      hora: r.hora,
      rival: home ? r.visit : r.local,
      home,
      us: played ? (home ? l : v) : null,
      them: played ? (home ? v : l) : null,
      won:
        r.ganador === 'local' ? home : r.ganador === 'visitante' ? away : played ? (home ? l! > v! : v! > l!) : null,
      played,
    });
  }
  return out;
}

export const FcpTeamScreen = ({ navigation, route }: CompetirStackScreenProps<'FcpTeam'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idEquipo, name } = route.params;
  const isFav = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'team' && f.refId === String(idEquipo)),
  );
  // ¿Es mi equipo? (para «TU EQUIPO» y «Abrir en Liga»).
  const myTeam = useTeamStore((s) => s.team);
  const { data: mine } = useFcpStanding(
    myTeam?.id,
    myTeam?.federation === FCP_FEDERATION_CODE,
  );
  const isMine = mine.me?.id_equipo === idEquipo || mine.idEquipo === idEquipo;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FcpTeamProfile | null>(null);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [sort, setSort] = useState<Sort>('puntos');
  const [tab, setTab] = useState<Tab>('resumen');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFcpTeamProfile(idEquipo)
      .then(async (d) => {
        if (!alive) return;
        setData(d);
        // Próximo y últimos: las jornadas del grupo (las de FcpGroup),
        // filtradas por este equipo. Consulta de cliente, sin servidor nuevo.
        if (d?.idGrupo) {
          const rows = await fetchGroupSchedule(d.idGrupo).catch(() => [] as FcpBrowseMatch[]);
          if (alive) setMatches(toTeamMatches(rows, d.equipo));
        } else if (alive) {
          setMatches([]);
        }
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idEquipo]);

  const sd = data ? data.setsFavor - data.setsContra : 0;

  const roster = useMemo(() => {
    if (!data) return [];
    const r = [...data.roster];
    if (sort === 'nombre') r.sort((a, b) => a.name.localeCompare(b.name));
    else r.sort((a, b) => b.puntos - a.puntos);
    return r;
  }, [data, sort]);

  const zone = useMemo(() => {
    if (!data?.grupo) return null;
    const genero = /FEM/i.test(data.grupo) ? 'F' : 'M';
    return zoneIn(
      groupZones({ fed: FCP_FEDERATION_CODE, idGrupo: data.idGrupo, nombre: data.grupo, genero }),
      data.posicion,
    );
  }, [data]);

  const played = useMemo(
    () => matches.filter((m) => m.played).sort((a, b) => (b.jornada ?? 0) - (a.jornada ?? 0)),
    [matches],
  );
  const next = useMemo(
    () =>
      matches
        .filter((m) => !m.played)
        .sort((a, b) => (a.jornada ?? 999) - (b.jornada ?? 999))[0],
    [matches],
  );

  const preseason = !!data?.preseason;
  const backLabel = shortGroupName(data?.grupo)?.split(' · ').pop() || 'Atrás';
  const openPlayer = (id: string, n: string) =>
    navigation.navigate('FcpPlayer', { idJugador: id, name: n });

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.textMuted} />
          <Text style={styles.navBtnLabel} numberOfLines={1}>
            {backLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            toggleFavorite({
              kind: 'team',
              refId: String(idEquipo),
              label: data?.equipo || name || 'Equipo',
              meta: shortGroupName(data?.grupo),
            })
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Dejar de seguir' : 'Seguir equipo'}
          style={({ pressed }) => [styles.favBtn, isFav && styles.favBtnOn, pressed && { opacity: 0.7 }]}
        >
          {isFav ? <IconStarFilled size={16} color={c.accent} /> : <IconStar size={16} color={c.textFaint} />}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : !data ? (
        <Text style={styles.empty}>No se pudo cargar el equipo.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroTile}>
              <Text style={styles.heroTileText}>{initials(data.equipo || name || '?')}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={styles.heroName} numberOfLines={2}>{data.equipo || name || 'Equipo'}</Text>
              {data.grupo ? (
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {(preseason ? data.grupo : shortGroupName(data.grupo) ?? data.grupo).toUpperCase()}
                </Text>
              ) : null}
            </View>
            {data.posicion != null ? (
              <View style={styles.posBadge}>
                <Text style={styles.posBadgeNum}>{data.posicion}º</Text>
                <Text style={styles.posBadgeLabel}>GRUPO</Text>
              </View>
            ) : null}
          </View>

          {/* Zona + racha corta + «tu equipo» */}
          {!preseason && (zone || data.form.length > 0 || isMine) ? (
            <View style={styles.zoneRow}>
              {zone ? (
                <Text style={[styles.zoneTag, { color: zoneColor(zone.key, c) }]}>
                  {zone.label.toUpperCase()}
                </Text>
              ) : null}
              {isMine ? <Text style={styles.mineTag}>TU EQUIPO</Text> : null}
              <View style={{ flex: 1 }} />
              {data.form.length > 0 ? <FormChips form={data.form.slice(-3)} box={18} /> : null}
            </View>
          ) : null}

          {isMine ? (
            <Pressable
              onPress={() =>
                // La ficha vive en varias pilas (Inicio, Equipo, Competir): se va
                // a la pestaña Competir › Liga desde la raíz.
                (navigation as any).navigate('Competir', {
                  screen: 'CompetirRoot',
                  params: { segment: 'liga' },
                })
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.openLiga, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.openLigaText}>Abrir en Liga</Text>
              <IconChevron size={13} color={c.accent} />
            </Pressable>
          ) : null}

          {preseason ? (
            <>
              {/* Pretemporada: sin sorteo no hay grupo, calendario ni tabla. */}
              <View style={styles.preCard}>
                <Text style={styles.preEyebrow}>EN INSCRIPCIÓN</Text>
                <Text style={styles.preText}>
                  La federación aún no ha hecho el sorteo: este equipo todavía no tiene
                  grupo, calendario ni clasificación.
                </Text>
                <View style={styles.preRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.preValue} numberOfLines={1}>
                      {data.preseason?.sede || '—'}
                    </Text>
                    <Text style={styles.preLabel}>SEDE DE LOCAL</Text>
                  </View>
                  <View>
                    <Text style={styles.preValue}>{data.roster.length}</Text>
                    <Text style={styles.preLabel}>PLANTILLA</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.preState,
                    { color: data.preseason?.confirmado ? c.accent : c.textFaint },
                  ]}
                >
                  {data.preseason?.confirmado ? 'Confirmado por el club' : 'Sin confirmar'}
                </Text>
              </View>
              <Roster
                styles={styles}
                c={c}
                roster={roster}
                total={data.roster.length}
                sort={sort}
                onSort={() => setSort((s) => (s === 'puntos' ? 'nombre' : 'puntos'))}
                onPlayer={openPlayer}
              />
            </>
          ) : (
            <>
              <View style={{ marginTop: 16 }}>
                <Segmented
                  items={[
                    ['resumen', 'Resumen'],
                    ['partidos', 'Partidos'],
                    ['plantilla', `Plantilla · ${data.roster.length}`],
                  ]}
                  value={tab}
                  onChange={setTab}
                  size="sm"
                />
              </View>

              {tab === 'resumen' ? (
                <>
                  <View style={styles.statBlock}>
                    {([
                      { k: 'PUNTOS', v: String(data.puntos), color: c.accent },
                      { k: 'PJ', v: String(data.pj) },
                      { k: 'PG', v: String(data.pg) },
                      {
                        k: 'DIF',
                        v: sd >= 0 ? `+${sd}` : String(sd),
                        color: sd > 0 ? c.accent : sd < 0 ? c.error : undefined,
                      },
                    ] as { k: string; v: string; color?: string }[]).map((s) => (
                      <View key={s.k} style={{ flex: 1 }}>
                        <StatCell label={s.k} value={s.v} color={s.color} valueSize={20} />
                      </View>
                    ))}
                  </View>

                  {next ? (
                    <View style={styles.nextCard}>
                      <Text style={styles.cardEyebrow}>PRÓXIMO</Text>
                      <View style={styles.nextRow}>
                        <View style={styles.jBadge}>
                          <Text style={styles.jBadgeText}>
                            J{String(next.jornada ?? 0).padStart(2, '0')}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.nextRival} numberOfLines={1}>
                            vs {next.rival}
                          </Text>
                          <Text style={styles.nextMeta} numberOfLines={1}>
                            {[fmtDay(next.fecha), next.hora?.slice(0, 5), next.home ? 'En casa' : 'Fuera']
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {played.length > 0 ? (
                    <View style={{ marginTop: 22 }}>
                      <ListHeader title="ÚLTIMOS" action="TODOS ›" onAction={() => setTab('partidos')} />
                      <View style={{ gap: 6, marginTop: 10 }}>
                        {played.slice(0, 3).map((m) => (
                          <ResultRow key={m.idPartido} styles={styles} c={c} m={m} onPress={() => setTab('partidos')} />
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {roster.length > 0 ? (
                    <View style={{ marginTop: 22 }}>
                      <ListHeader title="MÁS PUNTOS" action="PLANTILLA ›" onAction={() => setTab('plantilla')} />
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {[...data.roster]
                          .sort((a, b) => b.puntos - a.puntos)
                          .slice(0, 3)
                          .map((p, i) => (
                            <PlayerRow
                              key={p.idJugador}
                              styles={styles}
                              c={c}
                              rank={i + 1}
                              podium
                              p={p}
                              onPress={openPlayer}
                            />
                          ))}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : tab === 'partidos' ? (
                played.length === 0 ? (
                  <Text style={styles.note}>Aún no ha jugado ninguna jornada.</Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 16 }}>
                    {played.map((m, i) => (
                      <MatchActa key={m.idPartido} styles={styles} c={c} m={m} initiallyOpen={i === 0} />
                    ))}
                  </View>
                )
              ) : (
                <Roster
                  styles={styles}
                  c={c}
                  roster={roster}
                  total={data.roster.length}
                  sort={sort}
                  onSort={() => setSort((s) => (s === 'puntos' ? 'nombre' : 'puntos'))}
                  onPlayer={openPlayer}
                />
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

type S = ReturnType<typeof makeStyles>;

const ResultRow: React.FC<{ styles: S; c: Palette; m: TeamMatch; onPress: () => void }> = ({
  styles,
  c,
  m,
  onPress,
}) => {
  const col = m.won ? c.accent : m.won === false ? c.error : c.textMuted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.85 }]}>
      <Text style={styles.resultJ}>J{String(m.jornada ?? 0).padStart(2, '0')}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.resultRival} numberOfLines={1}>
          {m.rival}
        </Text>
        <Text style={styles.resultMeta}>{m.home ? 'Casa' : 'Fuera'}</Text>
      </View>
      <Text style={[styles.resultScore, { color: col }]}>
        {m.us}–{m.them}
      </Text>
    </Pressable>
  );
};

/** Jornada desplegable con las 5 parejas del acta y sus parciales. */
const MatchActa: React.FC<{ styles: S; c: Palette; m: TeamMatch; initiallyOpen?: boolean }> = ({
  styles,
  c,
  m,
  initiallyOpen,
}) => {
  const [open, setOpen] = useState(!!initiallyOpen);
  const [acta, setActa] = useState<FcpActaPartido[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!open || acta) return;
    let alive = true;
    // El acta se guarda con el id base del enfrentamiento.
    fetchFcpActa(m.idPartido)
      .then((r) => alive && setActa(r))
      .catch(() => alive && setActa([]));
    return () => {
      alive = false;
    };
  }, [open, acta, m.idPartido]);
  const col = m.won ? c.accent : m.won === false ? c.error : c.textMuted;
  const pairs = acta ?? [];
  const visible = showAll ? pairs : pairs.slice(0, 3);
  return (
    <View style={styles.actaCard}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.actaHead, pressed && { opacity: 0.85 }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.actaHeadEyebrow} numberOfLines={1}>
            {`JORNADA ${m.jornada ?? '—'}${m.fecha ? ` · ${fmtDay(m.fecha, false).toUpperCase()}` : ''}`}
          </Text>
          <Text style={styles.actaHeadRival} numberOfLines={1}>
            {m.home ? 'vs' : 'en'} {m.rival}
          </Text>
        </View>
        <Text style={[styles.resultScore, { color: col }]}>
          {m.us}–{m.them}
        </Text>
      </Pressable>
      {open ? (
        acta == null ? (
          <ActivityIndicator color={c.accent} style={{ marginVertical: 10 }} />
        ) : pairs.length === 0 ? (
          <Text style={styles.actaPending}>Acta pendiente</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {visible.map((p) => {
              const usL = m.home;
              const ours = usL ? [p.local_j1, p.local_j2] : [p.visit_j1, p.visit_j2];
              const theirs = usL ? [p.visit_j1, p.visit_j2] : [p.local_j1, p.local_j2];
              const sUs = usL ? p.sets_local : p.sets_visit;
              const sThem = usL ? p.sets_visit : p.sets_local;
              const won = (sUs ?? 0) > (sThem ?? 0);
              const surname = (n: string | null) => (n ?? '').trim().split(/\s+/).slice(-1)[0] || '—';
              return (
                <View key={p.partido_num} style={styles.pairRow}>
                  <View
                    style={[
                      styles.wl,
                      { backgroundColor: won ? c.accent15 : withAlpha(c.error, 0.14) },
                    ]}
                  >
                    <Text style={[styles.wlText, { color: won ? c.accent : c.error }]}>{won ? 'V' : 'D'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pairUs} numberOfLines={1}>
                      {ours.map(surname).join(' / ')}
                    </Text>
                    <Text style={styles.pairThem} numberOfLines={1}>
                      vs {theirs.map(surname).join(' / ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.pairSets}>
                      {sUs ?? 0}-{sThem ?? 0}
                    </Text>
                    {p.parciales ? (
                      <Text style={styles.pairParc} numberOfLines={1}>
                        {p.parciales.replace(/\//g, '-').replace(/\s*-\s*(?=\d+-)/g, ' ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {pairs.length > 3 && !showAll ? (
              <Pressable onPress={() => setShowAll(true)} hitSlop={6}>
                <Text style={styles.morePairs}>+ {pairs.length - 3} parejas más</Text>
              </Pressable>
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
};

const PlayerRow: React.FC<{
  styles: S;
  c: Palette;
  rank: number;
  /** Podio de «Más puntos»: 1º 2º 3º, el primero en el color de acento. */
  podium?: boolean;
  p: FcpTeamProfile['roster'][number];
  onPress: (id: string, name: string) => void;
}> = ({ styles, c, rank, podium, p, onPress }) => (
  <Pressable
    onPress={() => onPress(p.idJugador, p.name)}
    style={({ pressed }) => [styles.playerRow, pressed && { opacity: 0.85 }]}
  >
    <Text
      style={[
        styles.rank,
        podium && { width: 24 },
        podium && rank === 1 && { color: c.accent },
      ]}
    >
      {podium ? `${rank}º` : rank}
    </Text>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(p.name)}</Text>
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
      {p.categoria ? <Text style={styles.playerMeta} numberOfLines={1}>{p.categoria.toUpperCase()}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Text style={styles.playerPts}>{fmtN(p.puntos)}</Text>
      <Text style={styles.playerPtsLabel}>PUNTOS</Text>
    </View>
    <IconChevron size={14} color={c.textFaint} />
  </Pressable>
);

const Roster: React.FC<{
  styles: S;
  c: Palette;
  roster: FcpTeamProfile['roster'];
  total: number;
  sort: Sort;
  onSort: () => void;
  onPlayer: (id: string, name: string) => void;
}> = ({ styles, c, roster, total, sort, onSort, onPlayer }) => (
  <>
    <View style={{ marginTop: 22 }}>
      <ListHeader
        title={`PLANTILLA · ${total}`}
        action={sort === 'puntos' ? 'POR PUNTOS ▾' : 'POR NOMBRE ▾'}
        onAction={onSort}
      />
    </View>
    <View style={{ gap: 6, marginTop: 10 }}>
      {roster.map((p, i) => (
        <PlayerRow key={p.idJugador} styles={styles} c={c} rank={i + 1} p={p} onPress={onPlayer} />
      ))}
    </View>
  </>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    navBtnLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    favBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favBtnOn: { borderColor: c.accent40, backgroundColor: c.accent10 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
    note: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 16 },

    // Hero
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
    heroTile: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTileText: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700', color: c.accent },
    heroName: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 27 },
    heroMeta: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: c.textFaint },
    posBadge: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posBadgeNum: { fontFamily: Fonts.mono, fontSize: 18, fontWeight: '700', color: c.accent, lineHeight: 20 },
    posBadgeLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1.2, color: c.accent, marginTop: 2 },
    zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    zoneTag: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.6, fontWeight: '700' },
    mineTag: {
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.4,
      fontWeight: '800',
      color: c.accent,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c.accent10,
      overflow: 'hidden',
    },
    openLiga: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 10,
    },
    openLigaText: { color: c.accent, fontSize: 13.5, fontWeight: '700' },

    // Resumen
    statBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    nextCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    cardEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.accent, fontWeight: '700' },
    nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    jBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.accent10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    jBadgeText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 12.5, fontWeight: '800' },
    nextRival: { color: c.text, fontSize: 15, fontWeight: '700' },
    nextMeta: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11, marginTop: 3 },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    resultJ: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11.5, fontWeight: '700' },
    resultRival: { color: c.text, fontSize: 14, fontWeight: '600' },
    resultMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10.5, marginTop: 2 },
    resultScore: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '800' },

    // Partidos (acta)
    actaCard: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    actaHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    actaHeadEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.6, color: c.textFaint, fontWeight: '600' },
    actaHeadRival: { color: c.text, fontSize: 14.5, fontWeight: '700', marginTop: 3 },
    actaPending: { color: c.textMuted, fontSize: 12.5, marginTop: 10 },
    pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    wl: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    wlText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '700' },
    pairUs: { color: c.text, fontSize: 13, fontWeight: '600' },
    pairThem: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    pairSets: { fontFamily: Fonts.mono, color: c.text, fontSize: 13, fontWeight: '800' },
    pairParc: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10, marginTop: 1 },
    morePairs: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, fontWeight: '700', marginTop: 2 },

    // Pretemporada
    preCard: {
      marginTop: 18,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    preEyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.warning, fontWeight: '700' },
    preText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
    preRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
    preValue: { color: c.text, fontSize: 15, fontWeight: '700' },
    preLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.2, color: c.textFaint, marginTop: 3 },
    preState: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', marginTop: 12 },

    // Plantilla
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    rank: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 12, fontWeight: '700', width: 16, textAlign: 'center' },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 12, fontWeight: '700' },
    playerName: { color: c.text, fontSize: 14, fontWeight: '600' },
    playerMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 1, marginTop: 2 },
    playerPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 14, fontWeight: '700' },
    playerPtsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 8.5, letterSpacing: 1 },
  });
