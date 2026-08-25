import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { Input, IconBack, IconChevron, IconSearch, IconX, IconStar, IconStarFilled, IconCheck } from '@components/ui';
import { BottomSheet } from '@components/ui';
import { Segmented, Caret } from '../components/fcpUi';
import { federationLogo } from '@core/data/federationLogos';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import {
  fetchFcpYears,
  fetchFcpGroups,
  fetchFcpGroupMetas,
  type FcpYear,
  type FcpGroupItem,
  type FcpGroupMeta,
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
  ['rankings', 'Ranking'],
];
const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'];
const CAT_ORDER = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'];
const MEDAL: Record<number, string> = { 1: '#E7B93E', 2: '#AEB7C2', 3: '#CD7F45' };
const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const GENDER_LABEL: Record<'all' | 'M' | 'F', string> = { all: 'AMBOS', M: 'MASC', F: 'FEM' };
const estadoLabel = (e: FcpGroupMeta['estado']) =>
  e === 'finalizada' ? 'FINALIZADA' : e === 'en_curso' ? 'EN CURSO' : '—';

// Meta mono de una fila de grupo: "6 EQUIPOS · J·10/10 · FINALIZADA".
const groupMetaLine = (g: FcpGroupItem, m?: FcpGroupMeta): string => {
  if (!m) return g.genero === 'F' ? 'FEMENINO' : 'MASCULINO';
  const parts: string[] = [];
  if (m.equiposCount) parts.push(`${m.equiposCount} EQUIPOS`);
  if (m.jornadaTotal) parts.push(`J·${m.jornadaActual}/${m.jornadaTotal}`);
  parts.push(estadoLabel(m.estado));
  return parts.join(' · ');
};

export const FederacionScreen = ({ navigation }: SeasonsStackScreenProps<'Federacion'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const isFav = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'federation' && f.refId === FCP_FEDERATION_CODE),
  );

  const [years, setYears] = useState<FcpYear[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [allGroups, setAllGroups] = useState<FcpGroupItem[]>([]);
  const [groupMetas, setGroupMetas] = useState<Map<string, FcpGroupMeta>>(new Map());
  const [loadingYears, setLoadingYears] = useState(true);

  const [tab, setTab] = useState<Tab>('todo');
  const [query, setQuery] = useState('');
  const [genderF, setGenderF] = useState<'all' | 'M' | 'F'>('all');
  const [catF, setCatF] = useState<string>('all');
  const [selGrupo, setSelGrupo] = useState<string>('all');
  const [grupoTeamIds, setGrupoTeamIds] = useState<number[]>([]);
  const [sheet, setSheet] = useState<null | 'temp' | 'gen' | 'cat' | 'grupo'>(null);

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
    setGroupMetas(new Map());
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

  // Grupos que casan con los filtros (género/categoría).
  const browseGroups = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          (genderF === 'all' || g.genero === genderF) &&
          (catF === 'all' || catShort(g.nombre) === catF),
      ),
    [allGroups, genderF, catF],
  );

  // Meta (nº equipos, jornadas, estado) de los grupos visibles, por lote.
  // Solo en la pestaña "Todo", que es donde se listan los grupos.
  useEffect(() => {
    if (tab !== 'todo') return;
    const ids = browseGroups.map((g) => g.idGrupo).filter((id) => !groupMetas.has(id));
    if (ids.length === 0) return;
    let alive = true;
    fetchFcpGroupMetas(ids)
      .then((m) => {
        if (!alive || m.size === 0) return;
        setGroupMetas((prev) => {
          const n = new Map(prev);
          m.forEach((v, k) => n.set(k, v));
          return n;
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [browseGroups, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grupos agrupados por categoría (bloques con título + contador).
  const catBlocks = useMemo(() => {
    const map = new Map<string, FcpGroupItem[]>();
    for (const g of browseGroups) {
      const cat = catShort(g.nombre) ?? 'OTROS';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a[0]);
      const ib = CAT_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [browseGroups]);

  const todoGroups = useMemo(() => {
    const t = term.toLowerCase();
    if (t.length < 2) return [];
    return browseGroups.filter((g) => g.nombre.toLowerCase().includes(t)).slice(0, 4);
  }, [browseGroups, term]);

  const selGrupoObj = grupoOptions.find((g) => g.idGrupo === selGrupo) ?? null;
  const tempLabel = years.find((y) => y.idLiga === year)?.temporada || years.find((y) => y.idLiga === year)?.nombre || '—';
  const tempDefault = years.length > 0 && year === years[0].idLiga;
  const grupoValue = (() => {
    if (selGrupo === 'all') return 'TODOS';
    const g = selGrupoObj ?? allGroups.find((x) => x.idGrupo === selGrupo);
    const m = g?.nombre.match(/GRUPO\s+([\wÁÉÍÓÚÑ]+)/i);
    return m ? `GR. ${m[1]}` : catShort(g?.nombre ?? '') ?? 'SEL';
  })();

  const resetFilters = () => {
    setGenderF('all');
    setCatF('all');
    setSelGrupo('all');
    setYear(years[0]?.idLiga ?? null);
  };

  return (
    <View style={styles.root}>
      {/* Nav: atrás + favorito */}
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        {navigation.canGoBack() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          >
            <IconBack size={16} color={c.textMuted} />
            <Text style={styles.navBtnLabel}>Atrás</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() =>
            toggleFavorite({ kind: 'federation', refId: FCP_FEDERATION_CODE, label: 'Federación Cántabra' })
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          style={({ pressed }) => [styles.favBtn, isFav && styles.favBtnOn, pressed && { opacity: 0.7 }]}
        >
          {isFav ? <IconStarFilled size={16} color={c.accent} /> : <IconStar size={16} color={c.textFaint} />}
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Identidad */}
        <View style={styles.fedHead}>
          {federationLogo('FCantP') ? (
            <Image source={federationLogo('FCantP')!} style={styles.fedLogo} resizeMode="contain" />
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>FEDERACIÓN CÁNTABRA</Text>
            <Text style={styles.title}>Explorar</Text>
          </View>
        </View>

        {/* Buscador */}
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

        {/* Segmented */}
        <View style={{ marginTop: 14 }}>
          <Segmented items={TABS} value={tab} onChange={setTab} size="sm" />
        </View>

        {/* Filtros compactos (chips desplegables) */}
        {loadingYears ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            style={{ marginTop: 14 }}
          >
            {tab !== 'rankings' ? (
              <FilterPill styles={styles} label="TEMP" value={tempLabel} active={!tempDefault} onPress={() => setSheet('temp')} />
            ) : null}
            <FilterPill styles={styles} label="GÉN" value={GENDER_LABEL[genderF]} active={genderF !== 'all'} onPress={() => setSheet('gen')} />
            <FilterPill styles={styles} label="CAT" value={catF === 'all' ? 'TODAS' : catF} active={catF !== 'all'} onPress={() => setSheet('cat')} />
            {tab !== 'rankings' ? (
              <FilterPill styles={styles} label="GRUPO" value={grupoValue} active={selGrupo !== 'all'} onPress={() => setSheet('grupo')} />
            ) : null}
          </ScrollView>
        )}

        {/* Acceso rápido al grupo seleccionado (card destacada) */}
        {selGrupoObj ? (
          <Pressable
            onPress={() => navigation.navigate('FcpGroup', { idGrupo: selGrupoObj.idGrupo, nombre: selGrupoObj.nombre })}
            style={({ pressed }) => [styles.grupoCard, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.grupoCardTile}>
              <Text style={styles.grupoCardTileText}>{selGrupoObj.genero === 'F' ? 'F' : 'M'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={styles.grupoCardEyebrow}>ABRIR GRUPO</Text>
              <Text style={styles.grupoCardName} numberOfLines={1}>{selGrupoObj.nombre}</Text>
            </View>
            <IconChevron size={16} color={c.accent} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 40 }}
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
          // Browse: grupos agrupados por categoría.
          browseGroups.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <View style={styles.listHead}>
                <Text style={styles.listHeadTitle}>GRUPOS · {browseGroups.length}</Text>
              </View>
              {catBlocks.map(([cat, groups]) => (
                <View key={cat}>
                  <View style={styles.catHead}>
                    <Text style={styles.catHeadTitle}>{cat === 'OTROS' ? 'OTROS' : `${cat} CATEGORÍA`}</Text>
                    <View style={styles.catRule} />
                    <Text style={styles.catCount}>
                      {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {groups.map((g) => (
                      <GroupRow
                        key={g.idGrupo}
                        styles={styles}
                        c={c}
                        group={g}
                        meta={groupMetas.get(g.idGrupo)}
                        onPress={() => openGroup(g)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>No hay grupos con esos filtros.</Text>
          )
        ) : teams.length + players.length + todoGroups.length === 0 ? (
          <Text style={styles.hint}>Sin resultados para “{term}”.</Text>
        ) : (
          <View style={{ gap: 22, marginTop: 8 }}>
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
                <View style={{ gap: 8 }}>
                  {todoGroups.map((g) => (
                    <GroupRow key={g.idGrupo} styles={styles} c={c} group={g} meta={groupMetas.get(g.idGrupo)} onPress={() => openGroup(g)} />
                  ))}
                </View>
              </Section>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom sheets de filtro */}
      <BottomSheet open={sheet === 'temp'} onClose={() => setSheet(null)}>
        <SheetTitle styles={styles} title="Temporada" />
        {years.map((y) => (
          <SheetOption
            key={y.idLiga}
            styles={styles}
            c={c}
            label={y.temporada || y.nombre}
            on={year === y.idLiga}
            onPress={() => {
              setYear(y.idLiga);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'gen'} onClose={() => setSheet(null)}>
        <SheetTitle styles={styles} title="Género" />
        {([['all', 'Ambos'], ['M', 'Masculino'], ['F', 'Femenino']] as ['all' | 'M' | 'F', string][]).map(([v, l]) => (
          <SheetOption
            key={v}
            styles={styles}
            c={c}
            label={l}
            on={genderF === v}
            onPress={() => {
              setGenderF(v);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'cat'} onClose={() => setSheet(null)}>
        <SheetTitle styles={styles} title="Categoría" />
        <SheetOption styles={styles} c={c} label="Todas" on={catF === 'all'} onPress={() => { setCatF('all'); setSheet(null); }} />
        {CATS.map((x) => (
          <SheetOption key={x} styles={styles} c={c} label={`${x} categoría`} on={catF === x} onPress={() => { setCatF(x); setSheet(null); }} />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'grupo'} onClose={() => setSheet(null)}>
        <SheetTitle styles={styles} title="Grupo" />
        {grupoOptions.length === 0 ? (
          <Text style={styles.sheetNote}>Aún no hay grupos disponibles para esos filtros.</Text>
        ) : (
          <>
            <SheetOption styles={styles} c={c} label="Todos los grupos" on={selGrupo === 'all'} onPress={() => { setSelGrupo('all'); setSheet(null); }} />
            {grupoOptions.map((g) => (
              <SheetOption key={g.idGrupo} styles={styles} c={c} label={g.nombre} on={selGrupo === g.idGrupo} onPress={() => { setSelGrupo(g.idGrupo); setSheet(null); }} />
            ))}
          </>
        )}
        <Pressable onPress={() => { resetFilters(); setSheet(null); }} style={({ pressed }) => [styles.resetRow, pressed && { opacity: 0.7 }]}>
          <IconX size={13} color={c.accent} />
          <Text style={styles.resetText}>Restablecer todos los filtros</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
};

const teamHint = (term: string) =>
  term.length < 2 ? 'Escribe un nombre o filtra por género, categoría o grupo.' : `Sin equipos para “${term}”.`;
const playerHint = (term: string, selGrupo: string) =>
  term.length < 2 && selGrupo === 'all'
    ? 'Escribe el nombre de un jugador o elige un grupo.'
    : `Sin jugadores para esa búsqueda.`;

// ─── Fila de grupo (card con tile F/M + meta + badge EN JUEGO) ──────────────────
const GroupRow: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  group: FcpGroupItem;
  meta?: FcpGroupMeta;
  onPress: () => void;
}> = ({ styles, c, group, meta, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.85 }]}>
    <View style={styles.groupTile}>
      <Text style={styles.groupTileText}>{group.genero === 'F' ? 'F' : 'M'}</Text>
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={styles.groupName} numberOfLines={1}>{group.nombre}</Text>
      <Text style={styles.groupMeta} numberOfLines={1}>{groupMetaLine(group, meta)}</Text>
    </View>
    {group.esPlayoff ? (
      <Text style={styles.playoffTag}>PLAY OFF</Text>
    ) : meta?.live ? (
      <View style={styles.liveBadge}>
        <Text style={styles.liveBadgeText}>EN JUEGO</Text>
      </View>
    ) : null}
    <IconChevron size={14} color={c.textFaint} />
  </Pressable>
);

// ─── Filtro compacto (pill desplegable) ────────────────────────────────────────
const FilterPill: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}> = ({ styles, label, value, active, onPress }) => {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.fpill, active && styles.fpillOn]}>
      <Text style={styles.fpillLabel}>{label}</Text>
      <Text style={[styles.fpillValue, active && styles.fpillValueOn]}>{value}</Text>
      <Caret size={11} color={active ? c.accent : c.textFaint} />
    </Pressable>
  );
};

// ─── Sheet helpers ──────────────────────────────────────────────────────────────
const SheetTitle: React.FC<{ styles: ReturnType<typeof makeStyles>; title: string }> = ({ styles, title }) => (
  <Text style={styles.sheetTitle}>{title}</Text>
);

const SheetOption: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  label: string;
  on: boolean;
  onPress: () => void;
}> = ({ styles, c, label, on, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetOpt, pressed && { opacity: 0.7 }]}>
    <Text style={[styles.sheetOptText, on && { color: c.text, fontWeight: '700' }]} numberOfLines={1}>
      {label}
    </Text>
    {on ? <IconCheck size={16} color={c.accent} /> : null}
  </Pressable>
);

// ─── Bloques de resultados de búsqueda ─────────────────────────────────────────
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
    <View style={{ gap: 8 }}>
      {teams.map((t) => (
        <Pressable
          key={t.idEquipo}
          onPress={() => onPress(t)}
          style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.groupTile}>
            <Text style={styles.groupTileText}>{t.genero === 'F' ? 'F' : 'M'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.groupName} numberOfLines={1}>{t.equipo}</Text>
            <Text style={styles.groupMeta} numberOfLines={1}>
              {[t.categoria, t.genero === 'F' ? 'FEMENINO' : 'MASCULINO', t.temporada].filter(Boolean).join(' · ').toUpperCase()}
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
    <View style={{ gap: 8 }}>
      {players.map((p) => (
        <Pressable
          key={p.idJugador}
          onPress={() => onPress(p)}
          style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.groupName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.groupMeta} numberOfLines={1}>
              {([p.categoria, p.equipo].filter(Boolean).join(' · ') || 'JUGADOR').toUpperCase()}
            </Text>
          </View>
          {p.puntos != null ? <Text style={styles.pts}>{fmtN(p.puntos)}</Text> : null}
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
    <View style={{ gap: 8, marginTop: 8 }}>
      {ranking.map((r) => {
        const medal = MEDAL[r.posicion];
        return (
          <View key={`${r.posicion}-${r.name}`} style={styles.groupRow}>
            <View style={[styles.posBadge, medal ? { backgroundColor: medal + '22', borderColor: medal + '66' } : null]}>
              <Text style={[styles.posText, medal ? { color: medal } : null]}>{r.posicion}</Text>
            </View>
            <Text style={[styles.groupName, { flex: 1, minWidth: 0 }]} numberOfLines={1}>{r.name}</Text>
            {r.puntos != null ? <Text style={styles.pts}>{fmtN(r.puntos)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
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
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
      marginTop: 4,
    },
    title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
    fedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    fedLogo: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: '#F0F5F2',
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    empty: { color: c.textMuted, fontSize: 13.5, marginTop: 24, textAlign: 'center' },
    hint: { color: c.textMuted, fontSize: 13.5, marginTop: 24, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },

    // Filtros compactos
    fpill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 34,
      paddingHorizontal: 13,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    fpillOn: { backgroundColor: c.accent10, borderColor: c.accent40 },
    fpillLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.2, color: c.textFaint, fontWeight: '500' },
    fpillValue: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '600', color: c.text },
    fpillValueOn: { color: c.accent },

    grupoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    grupoCardTile: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grupoCardTileText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.accent },
    grupoCardEyebrow: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.6, fontWeight: '600', color: c.accent },
    grupoCardName: { color: c.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1 },

    // Cabecera lista + secciones por categoría
    listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.hair },
    listHeadTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: c.textMuted, fontWeight: '500' },
    catHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 },
    catHeadTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: c.textMuted, fontWeight: '600' },
    catRule: { flex: 1, height: 1, backgroundColor: c.hair },
    catCount: { fontFamily: Fonts.mono, fontSize: 11, color: c.textFaint },

    // Filas
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    groupTile: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupTileText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '700', color: c.textMuted },
    groupName: { color: c.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1 },
    groupMeta: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.4, color: c.textFaint },
    liveBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    liveBadgeText: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.2, fontWeight: '600', color: c.accent },
    playoffTag: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.2, color: c.warning, fontWeight: '700' },

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
    posBadge: {
      minWidth: 32,
      height: 30,
      paddingHorizontal: 6,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 13, fontWeight: '800' },
    pts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '800' },

    // Secciones de búsqueda
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: c.accent, fontWeight: '700' },
    sectionMore: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },

    // Sheets
    sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
    sheetOpt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    sheetOptText: { color: c.textMuted, fontSize: 15, fontWeight: '600', flex: 1, minWidth: 0 },
    sheetNote: { color: c.textMuted, fontSize: 13.5, lineHeight: 19 },
    resetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 6 },
    resetText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  });
