import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { Input, IconBack, IconChevron, IconSearch, IconX } from '@components/ui';
import { federationLogo } from '@core/data/federationLogos';
import {
  fetchFcpYears,
  fetchFcpGroups,
  type FcpYear,
  type FcpGroupItem,
} from '@core/services/fcpBrowse';
import {
  searchFcpTeams,
  searchFcpPlayers,
  fetchFcpRanking,
  fetchGroupTeamIds,
  catShort,
  type FcpTeamResult,
  type FcpPlayerResult,
  type FcpRankingRow,
} from '@core/services/fcpSearch';
import type { SeasonsStackScreenProps } from '@navigation/types';

type Tab = 'todo' | 'equipos' | 'jugadores' | 'rankings';
const TABS: [Tab, string][] = [
  ['todo', 'Todo'],
  ['equipos', 'Equipos'],
  ['jugadores', 'Jugadores'],
  ['rankings', 'Rankings'],
];
const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'];
const MEDAL: Record<number, string> = { 1: '#E7B93E', 2: '#AEB7C2', 3: '#CD7F45' };
const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Etiqueta corta de un grupo para el chip ("2ª CATEGORIA MASC - GRUPO A" → "2ªM·A").
const grupoChipLabel = (g: FcpGroupItem) => {
  const cat = catShort(g.nombre) ?? '';
  const gg = g.genero === 'F' ? 'F' : 'M';
  const m = g.nombre.match(/GRUPO\s+([\wÁÉÍÓÚÑ]+)/i);
  return `${cat}${gg}${m ? `·${m[1]}` : ''}` || g.nombre;
};

export const FederacionScreen = ({ navigation }: SeasonsStackScreenProps<'Federacion'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const [years, setYears] = useState<FcpYear[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [allGroups, setAllGroups] = useState<FcpGroupItem[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);

  const [tab, setTab] = useState<Tab>('todo');
  const [query, setQuery] = useState('');
  const [genderF, setGenderF] = useState<'all' | 'M' | 'F'>('all');
  const [catF, setCatF] = useState<string>('all');
  const [selGrupo, setSelGrupo] = useState<string>('all');
  const [grupoTeamIds, setGrupoTeamIds] = useState<number[]>([]);

  const [teams, setTeams] = useState<FcpTeamResult[]>([]);
  const [players, setPlayers] = useState<FcpPlayerResult[]>([]);
  const [ranking, setRanking] = useState<FcpRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  // Años disponibles.
  useEffect(() => {
    let alive = true;
    fetchFcpYears()
      .then((ys) => {
        if (!alive) return;
        setYears(ys);
        setYear(ys[0]?.idLiga ?? null);
      })
      .catch(() => alive && setYears([]))
      .finally(() => alive && setLoadingYears(false));
    return () => {
      alive = false;
    };
  }, []);

  // Grupos del año (para el filtro de grupo y para acotar equipos/jugadores).
  useEffect(() => {
    if (year == null) return;
    let alive = true;
    fetchFcpGroups(year)
      .then((g) => alive && setAllGroups(g))
      .catch(() => alive && setAllGroups([]));
    return () => {
      alive = false;
    };
  }, [year]);

  const term = query.trim();

  // Opciones del filtro de grupo: grupos regulares que casan con año+género+cat.
  const grupoOptions = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          !g.esPlayoff &&
          (genderF === 'all' || g.genero === genderF) &&
          (catF === 'all' || catShort(g.nombre) === catF),
      ),
    [allGroups, genderF, catF],
  );

  // Si el grupo seleccionado deja de casar con los filtros, lo reseteamos.
  useEffect(() => {
    if (selGrupo !== 'all' && !grupoOptions.some((g) => g.idGrupo === selGrupo)) {
      setSelGrupo('all');
    }
  }, [grupoOptions, selGrupo]);

  // Equipos del grupo seleccionado → para acotar jugadores por grupo.
  useEffect(() => {
    if (selGrupo === 'all') {
      setGrupoTeamIds([]);
      return;
    }
    let alive = true;
    fetchGroupTeamIds(selGrupo)
      .then((ids) => alive && setGrupoTeamIds(ids))
      .catch(() => alive && setGrupoTeamIds([]));
    return () => {
      alive = false;
    };
  }, [selGrupo]);

  const regularGroupIds = useMemo(() => grupoOptions.map((g) => g.idGrupo), [grupoOptions]);

  // Búsqueda (según pestaña) con debounce + token anti-parpadeo.
  useEffect(() => {
    const id = ++reqRef.current;
    const filtersActive = genderF !== 'all' || catF !== 'all' || selGrupo !== 'all';
    const clear = () => {
      setTeams([]);
      setPlayers([]);
      setRanking([]);
    };

    if (
      (tab === 'todo' && term.length < 2) ||
      (tab === 'equipos' && term.length < 2 && !filtersActive) ||
      (tab === 'jugadores' && term.length < 2 && selGrupo === 'all')
    ) {
      clear();
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const needTeams = tab === 'todo' || tab === 'equipos';
        const needPlayers = tab === 'todo' || tab === 'jugadores';
        const needRanking = tab === 'rankings';
        const scoped = selGrupo !== 'all' ? [selGrupo] : undefined;

        const [tRes, pRes, rRes] = await Promise.all([
          needTeams
            ? searchFcpTeams(term, {
                idLiga: year,
                genero: genderF,
                categoria: catF,
                grupoIds: term.length < 2 ? scoped ?? regularGroupIds : undefined,
                limit: tab === 'todo' ? 6 : 40,
              })
            : Promise.resolve([] as FcpTeamResult[]),
          needPlayers
            ? searchFcpPlayers(term, {
                idEquipos: selGrupo !== 'all' ? grupoTeamIds : undefined,
                limit: tab === 'todo' ? 6 : 40,
              })
            : Promise.resolve([] as FcpPlayerResult[]),
          needRanking
            ? fetchFcpRanking({ genero: genderF, categoria: catF, query: term, limit: 150 })
            : Promise.resolve([] as FcpRankingRow[]),
        ]);
        if (reqRef.current !== id) return;
        // Si hay grupo seleccionado y término, acotamos equipos a ese grupo.
        setTeams(scoped && term.length >= 2 ? tRes.filter((t) => t.idGrupo === selGrupo) : tRes);
        setPlayers(pRes);
        setRanking(rRes);
      } catch {
        if (reqRef.current === id) clear();
      } finally {
        if (reqRef.current === id) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tab, term, year, genderF, catF, selGrupo, grupoTeamIds, regularGroupIds]);

  const openTeam = (t: FcpTeamResult) =>
    navigation.navigate('FcpTeam', { idEquipo: t.idEquipo, name: t.equipo });
  const openPlayer = (p: FcpPlayerResult) =>
    navigation.navigate('FcpPlayer', { idJugador: p.idJugador, name: p.name });
  const openGroup = (g: FcpGroupItem) =>
    navigation.navigate('FcpGroup', { idGrupo: g.idGrupo, nombre: g.nombre });

  // Grupos que casan con los filtros (género/categoría). Para "Todo":
  //  - sin término → se listan TODOS (browse, se va acotando por categoría).
  //  - con término → se filtran además por nombre y se recortan a unos pocos.
  const browseGroups = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          (genderF === 'all' || g.genero === genderF) &&
          (catF === 'all' || catShort(g.nombre) === catF),
      ),
    [allGroups, genderF, catF],
  );
  const todoGroups = useMemo(() => {
    const t = term.toLowerCase();
    if (t.length < 2) return [];
    return browseGroups.filter((g) => g.nombre.toLowerCase().includes(t)).slice(0, 4);
  }, [browseGroups, term]);

  const selGrupoObj = grupoOptions.find((g) => g.idGrupo === selGrupo) ?? null;
  const filtersActive =
    genderF !== 'all' ||
    catF !== 'all' ||
    selGrupo !== 'all' ||
    (years.length > 0 && year !== years[0].idLiga);
  const resetFilters = () => {
    setGenderF('all');
    setCatF('all');
    setSelGrupo('all');
    setYear(years[0]?.idLiga ?? null);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        {navigation.canGoBack() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          >
            <IconBack size={16} color={c.text} />
            <Text style={styles.navBtnLabel}>Atrás</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <View style={styles.fedHead}>
          {federationLogo('FCantP') ? (
            <Image
              source={federationLogo('FCantP')!}
              style={styles.fedLogo}
              resizeMode="contain"
            />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>FEDERACIÓN CÁNTABRA</Text>
            <Text style={styles.title}>Explorar</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={
              tab === 'jugadores' || tab === 'rankings'
                ? 'Busca un jugador'
                : tab === 'equipos'
                ? 'Busca un equipo'
                : 'Busca equipos o jugadores…'
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            containerStyle={{ marginBottom: 0 }}
            rightSlot={
              query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={10}>
                  <IconX size={15} color={c.textMuted} />
                </Pressable>
              ) : (
                <IconSearch size={16} color={c.textMuted} />
              )
            }
          />
        </View>

        {/* Pestañas */}
        <View style={styles.tabs}>
          {TABS.map(([key, label]) => {
            const on = tab === key;
            return (
              <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filtros inline visibles. En Rankings solo Género + Categoría
            (eligen la lista); Temporada y Grupo no aplican a un ranking. */}
        {loadingYears ? null : (
          <View style={styles.filters}>
            {filtersActive ? (
              <View style={styles.filtersHead}>
                <Pressable onPress={resetFilters} hitSlop={8} style={styles.resetBtn}>
                  <IconX size={12} color={c.accent} />
                  <Text style={styles.resetText}>Restablecer filtros</Text>
                </Pressable>
              </View>
            ) : null}
            {tab !== 'rankings' ? (
              <FilterRow styles={styles} label="Temporada">
                {years.map((y) => (
                  <FilterChip
                    key={`y${y.idLiga}`}
                    styles={styles}
                    label={y.temporada || y.nombre}
                    on={year === y.idLiga}
                    onPress={() => setYear(y.idLiga)}
                  />
                ))}
              </FilterRow>
            ) : null}
            <FilterRow styles={styles} label="Género">
              {([
                ['all', 'Ambos'],
                ['M', 'Masc'],
                ['F', 'Fem'],
              ] as ['all' | 'M' | 'F', string][]).map(([v, l]) => (
                <FilterChip key={`g${v}`} styles={styles} label={l} on={genderF === v} onPress={() => setGenderF(v)} />
              ))}
            </FilterRow>
            <FilterRow styles={styles} label="Categoría">
              <FilterChip styles={styles} label="Todas" on={catF === 'all'} onPress={() => setCatF('all')} />
              {CATS.map((x) => (
                <FilterChip key={`c${x}`} styles={styles} label={x} on={catF === x} onPress={() => setCatF(x)} />
              ))}
            </FilterRow>
            {tab !== 'rankings' && (genderF !== 'all' || catF !== 'all') ? (
              <FilterRow styles={styles} label="Grupo">
                <FilterChip styles={styles} label="Todos" on={selGrupo === 'all'} onPress={() => setSelGrupo('all')} />
                {grupoOptions.map((g) => (
                  <FilterChip
                    key={g.idGrupo}
                    styles={styles}
                    label={grupoChipLabel(g)}
                    on={selGrupo === g.idGrupo}
                    onPress={() => setSelGrupo(g.idGrupo)}
                  />
                ))}
              </FilterRow>
            ) : null}
          </View>
        )}

        {/* Acceso al grupo seleccionado (clasificación / jornadas / cuadro) */}
        {selGrupoObj ? (
          <Pressable
            onPress={() =>
              navigation.navigate('FcpGroup', { idGrupo: selGrupoObj.idGrupo, nombre: selGrupoObj.nombre })
            }
            style={({ pressed }) => [styles.grupoLink, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.grupoLinkText} numberOfLines={1}>
              Ver {selGrupoObj.nombre}
            </Text>
            <IconChevron size={14} color={c.accent} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loadingYears ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />
        ) : years.length === 0 ? (
          <Text style={styles.empty}>Aún no hay datos federativos sincronizados.</Text>
        ) : loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />
        ) : tab === 'rankings' ? (
          <ResultsRanking styles={styles} ranking={ranking} />
        ) : tab === 'equipos' ? (
          <ResultsTeams styles={styles} c={c} teams={teams} onPress={openTeam} emptyHint={teamHint(term)} />
        ) : tab === 'jugadores' ? (
          <ResultsPlayers styles={styles} c={c} players={players} onPress={openPlayer} emptyHint={playerHint(term, selGrupo)} />
        ) : term.length < 2 ? (
          // Sin término: browse de TODOS los grupos (se va acotando por filtros).
          browseGroups.length > 0 ? (
            <Section styles={styles} title={`GRUPOS · ${browseGroups.length}`}>
              <ResultsGroups styles={styles} c={c} groups={browseGroups} onPress={openGroup} />
            </Section>
          ) : (
            <Text style={styles.hint}>No hay grupos con esos filtros.</Text>
          )
        ) : teams.length + players.length + todoGroups.length === 0 ? (
          <Text style={styles.hint}>Sin resultados para “{term}”.</Text>
        ) : (
          <View style={{ gap: 22 }}>
            {teams.length > 0 ? (
              <Section styles={styles} title="EQUIPOS" onMore={() => setTab('equipos')}>
                <ResultsTeams styles={styles} c={c} teams={teams} onPress={openTeam} />
              </Section>
            ) : null}
            {players.length > 0 ? (
              <Section styles={styles} title="JUGADORES" onMore={() => setTab('jugadores')}>
                <ResultsPlayers styles={styles} c={c} players={players} onPress={openPlayer} />
              </Section>
            ) : null}
            {todoGroups.length > 0 ? (
              <Section styles={styles} title="GRUPOS">
                <ResultsGroups styles={styles} c={c} groups={todoGroups} onPress={openGroup} />
              </Section>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const teamHint = (term: string) =>
  term.length < 2 ? 'Escribe un nombre o filtra por género, categoría o grupo.' : `Sin equipos para “${term}”.`;
const playerHint = (term: string, selGrupo: string) =>
  term.length < 2 && selGrupo === 'all'
    ? 'Escribe el nombre de un jugador o elige un grupo.'
    : `Sin jugadores para esa búsqueda.`;

// ─── Bloques de resultados ────────────────────────────────────────────────────

const Section: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  title: string;
  onMore?: () => void;
  children: React.ReactNode;
}> = ({ styles, title, onMore, children }) => (
  <View>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={8}>
          <Text style={styles.sectionMore}>Ver todo</Text>
        </Pressable>
      ) : null}
    </View>
    {children}
  </View>
);

const ResultsTeams: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  teams: FcpTeamResult[];
  onPress: (t: FcpTeamResult) => void;
  emptyHint?: string;
}> = ({ styles, c, teams, onPress, emptyHint }) => {
  if (teams.length === 0) return emptyHint ? <Text style={styles.hint}>{emptyHint}</Text> : null;
  return (
    <View style={{ gap: 6 }}>
      {teams.map((t) => (
        <Pressable
          key={t.idEquipo}
          onPress={() => onPress(t)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.dot, { backgroundColor: t.genero === 'F' ? '#FF6BAE' : '#4C8DFF' }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowName} numberOfLines={1}>{t.equipo}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {[t.categoria, t.genero === 'F' ? 'Femenino' : 'Masculino', t.temporada]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <IconChevron size={14} color={c.textFaint} />
        </Pressable>
      ))}
    </View>
  );
};

const ResultsPlayers: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  players: FcpPlayerResult[];
  onPress: (p: FcpPlayerResult) => void;
  emptyHint?: string;
}> = ({ styles, c, players, onPress, emptyHint }) => {
  if (players.length === 0) return emptyHint ? <Text style={styles.hint}>{emptyHint}</Text> : null;
  return (
    <View style={{ gap: 6 }}>
      {players.map((p) => (
        <Pressable
          key={p.idJugador}
          onPress={() => onPress(p)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {[p.categoria, p.equipo].filter(Boolean).join(' · ') || 'Jugador'}
            </Text>
          </View>
          {p.puntos != null ? <Text style={styles.pts}>{p.puntos} pts</Text> : null}
          <IconChevron size={14} color={c.textFaint} />
        </Pressable>
      ))}
    </View>
  );
};

const ResultsRanking: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  ranking: FcpRankingRow[];
}> = ({ styles, ranking }) => {
  if (ranking.length === 0)
    return <Text style={styles.hint}>No hay ranking para esa combinación de género y categoría.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {ranking.map((r) => {
        const medal = MEDAL[r.posicion];
        return (
          <View key={`${r.posicion}-${r.name}`} style={styles.row}>
            <View
              style={[
                styles.posBadge,
                medal ? { backgroundColor: medal + '22', borderColor: medal + '66' } : null,
              ]}
            >
              <Text style={[styles.posText, medal ? { color: medal } : null]}>{r.posicion}</Text>
            </View>
            <Text style={[styles.rowName, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
              {r.name}
            </Text>
            {r.puntos != null ? <Text style={styles.pts}>{fmtN(r.puntos)} pts</Text> : null}
          </View>
        );
      })}
    </View>
  );
};

const ResultsGroups: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  groups: FcpGroupItem[];
  onPress: (g: FcpGroupItem) => void;
}> = ({ styles, c, groups, onPress }) => (
  <View style={{ gap: 6 }}>
    {groups.map((g) => (
      <Pressable
        key={g.idGrupo}
        onPress={() => onPress(g)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.dot, { backgroundColor: g.genero === 'F' ? '#FF6BAE' : '#4C8DFF' }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowName} numberOfLines={2}>{g.nombre}</Text>
          {g.esPlayoff ? <Text style={styles.playoffTag}>PLAY OFF</Text> : null}
        </View>
        <IconChevron size={14} color={c.textFaint} />
      </Pressable>
    ))}
  </View>
);

const FilterChip: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  label: string;
  on: boolean;
  onPress: () => void;
}> = ({ styles, label, on, onPress }) => (
  <Pressable onPress={onPress} style={[styles.fchip, on && styles.fchipOn]}>
    <Text style={[styles.fchipText, on && styles.fchipTextOn]}>{label}</Text>
  </Pressable>
);

// Una fila de filtro: etiqueta + chips en scroll horizontal (una línea, visible).
const FilterRow: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  label: string;
  children: React.ReactNode;
}> = ({ styles, label, children }) => (
  <View style={styles.filterRow}>
    <Text style={styles.filterRowLabel}>{label}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 7, paddingRight: 8 }}
      style={{ flex: 1 }}
    >
      {children}
    </ScrollView>
  </View>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
      marginTop: 4,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
    fedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    fedLogo: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    empty: { color: c.textMuted, fontSize: 13.5, marginTop: 24, textAlign: 'center' },
    hint: { color: c.textMuted, fontSize: 13.5, marginTop: 24, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 14,
      backgroundColor: c.bgCard,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
    tabOn: { backgroundColor: c.accent },
    tabText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    tabTextOn: { color: c.textInverse },
    filters: { marginTop: 12, gap: 8 },
    filtersHead: { flexDirection: 'row', justifyContent: 'flex-end' },
    resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    resetText: { color: c.accent, fontSize: 12.5, fontWeight: '700' },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterRowLabel: {
      width: 74,
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      color: c.textFaint,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    fchip: {
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    fchipOn: { backgroundColor: c.accent, borderColor: c.accent },
    fchipText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    fchipTextOn: { color: c.textInverse },
    playoffTag: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 1.2,
      color: c.warning,
      fontWeight: '700',
      marginTop: 3,
    },
    grupoLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      alignSelf: 'flex-start',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    grupoLinkText: { color: c.accent, fontSize: 12.5, fontWeight: '700', maxWidth: 260 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '700',
    },
    sectionMore: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dot: { width: 8, height: 8, borderRadius: 999 },
    posBadge: {
      minWidth: 30,
      height: 28,
      paddingHorizontal: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 13, fontWeight: '800' },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.accent, fontSize: 14, fontWeight: '800' },
    rowName: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    rowMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
    pts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '800' },
  });
