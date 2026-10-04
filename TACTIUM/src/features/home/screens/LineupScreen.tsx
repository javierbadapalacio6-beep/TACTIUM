import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconBolt, IconMenu, useCompactRail, useLayout } from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import * as SeasonsApi from '@core/services/seasons';
import * as AvailabilityApi from '@core/services/availability';
import type { LineupVariant } from '@core/services/lineupVariants';
import { useMatchdayRealtime } from '@core/hooks/useMatchdayRealtime';
import { getCourtsForCompetition, requiresStrengthOrder } from '@core/data/federations';
import {
  useTeamStore,
  selectIsCaptain,
  selectIsClubAdmin,
  type Player,
} from '@store/teamStore';
import { useToastStore } from '@store/toastStore';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import {
  generateLineupOptions,
  pairKey,
  type LineupOption,
  type PairStatsMap,
} from '@core/utils/lineupGenerator';
import { fetchPairStats } from '@core/services/pairStats';
import { notifyPush } from '@core/push';
import { shortName } from '@core/utils/playerName';
import { formatShortDay } from '@core/utils/format';

import {
  benchGroupOf,
  buildEmptySlots,
  calcValidation,
  filledLen,
  fmtPts,
  ptsOfSlot,
  sortByPoints,
  type BenchGroup,
  type Selection,
  type SlotIdx,
  type SlotState,
} from '../components/lineup/lineupLogic';
import { LineupCourt, CourtGap } from '../components/lineup/LineupCourt';
import { LineupBench } from '../components/lineup/LineupBench';
import { LineupBenchPanel } from '../components/lineup/LineupBenchPanel';
import { CourtDropZone, LineupDragLayer } from '../components/lineup/LineupDrag';
import {
  GenerateSheet,
  LineupMoreSheet,
  PublishSheet,
  type PublishRow,
} from '../components/lineup/LineupSheets';
import {
  InfoBanner,
  LineupStrip,
  MyPairCard,
  NoLineupYet,
} from '../components/lineup/LineupReadView';
import { notifySuccess, notifyWarning, tapLight } from '../components/match/haptics';

import type { HomeStackScreenProps } from '@navigation/types';

/**
 * Alineación (rediseño bloque «Partido», 2026-10).
 *
 *  · Capitán: editor con una sola línea de estado («4/5 parejas · orden
 *    correcto ✓»), «≥» entre pistas y el banquillo de la CONVOCATORIA de esta
 *    jornada (Voy · Duda · Sin contestar; los «No» plegados). Publicar abre
 *    una hoja con «Avisar al equipo».
 *  · Jugador: lectura con «Tu pareja» arriba.
 *  · Club: lectura con aviso de cómo editar.
 *
 * El motor no cambia: orden por puntos, variantes, realtime, gates premium
 * (`lineup_edit` / `lineup_confirm`) y generador.
 */
export const LineupScreen = ({
  navigation,
  route,
}: HomeStackScreenProps<'Lineup'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  // Solo el capitán edita. El club_admin ve todo pero no edita (modelo de
  // roles 2026-05-16); el override de rol desde Perfil también cuenta.
  const isCaptain = useTeamStore(selectIsCaptain);
  const isClub = useTeamStore(selectIsClubAdmin);
  const gate = usePremiumGate();
  // Tablet: rail compacto (las pistas y el banquillo necesitan el ancho).
  // Horizontal: banquillo en columna fija a la derecha. Vertical: anclado
  // abajo en columnas por grupo. Móvil: la bandeja de siempre.
  useCompactRail();
  const { mode, isTablet } = useLayout();
  const wide = mode === 'tabletLandscape';
  // Acciones del store de toasts (estables; sin suscribirse a su estado).
  const toast = useMemo(() => useToastStore.getState(), []);
  const matchdayId = route.params.matchdayId;
  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  const mustOrder = requiresStrengthOrder(team?.federation, team?.league, team?.gender);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const findPlayer = useCallback(
    (id: string | null) => (id ? playerById.get(id) ?? null : null),
    [playerById],
  );

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  // Season archivada → alineación en solo lectura (los resultados siguen
  // editables en ResultsScreen).
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [variants, setVariants] = useState<LineupVariant[]>([]);
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  // ¿Se ha EDITADO la alineación en esta sesión? Decide el valor por defecto
  // de «Avisar al equipo» (abrir y publicar sin tocar nada no avisa).
  const dirtyRef = useRef(false);
  // Último estado PERSISTIDO por pista (`court -> "aId|bId"`), para escribir
  // solo las pistas que cambian en cada edición.
  const lastPersistedRef = useRef<Map<number, string>>(new Map());
  const [slots, setSlots] = useState<SlotState[]>(() => buildEmptySlots(courts));
  // Nombres de la vista `lineup_pairs`: respaldo si la plantilla del store no
  // tiene a alguien (jugador de otro equipo, ficha borrada…).
  const [pairNames, setPairNames] = useState<Map<number, { a: string | null; b: string | null }>>(
    new Map(),
  );
  const [sel, setSel] = useState<Selection>(null);
  // Auto-orden: ON si la federación exige orden de fuerza. Vive en el menú ⋯.
  const [autoSort, setAutoSort] = useState(mustOrder);
  const [swapAnimIds, setSwapAnimIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pairStats, setPairStats] = useState<PairStatsMap | undefined>(undefined);
  // Convocatoria de la jornada. undefined = cargando · null = no se pudo leer.
  const [avail, setAvail] = useState<AvailabilityApi.AvailabilityMap | null | undefined>(
    undefined,
  );
  const [rsvpBusy, setRsvpBusy] = useState(false);
  // Hojas.
  const [genOpen, setGenOpen] = useState(false);
  const [genUsePosition, setGenUsePosition] = useState(true);
  const [includeMaybe, setIncludeMaybe] = useState(false);
  const [genKey, setGenKey] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [notify, setNotify] = useState(true);

  // ── Carga ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [md, vars] = await Promise.all([
          MatchdaysApi.fetchMatchday(matchdayId),
          LineupVariantsApi.listVariants(matchdayId),
        ]);
        if (cancelled) return;
        setMatchday(md);
        setVariants(vars);
        const initial = vars.find((v) => v.is_active) ?? vars[0] ?? null;
        setCurrentVariantId(initial?.id ?? null);
        if (md?.season_id) {
          const s = await SeasonsApi.fetchSeasonById(md.season_id);
          if (!cancelled) setSeason(s);
        }
      } catch (e) {
        console.warn('Lineup variants fetch', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchdayId]);

  const loadAvailability = useCallback(async () => {
    try {
      setAvail(await AvailabilityApi.fetchAvailability(matchdayId));
    } catch (e) {
      console.warn('Lineup availability fetch', e);
      setAvail(null);
    }
  }, [matchdayId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  // Química por historial del equipo (generador y «Tu pareja»). Best-effort.
  useEffect(() => {
    const teamId = team?.id;
    if (!teamId) return;
    let cancelled = false;
    fetchPairStats(teamId)
      .then((m) => {
        if (!cancelled) setPairStats(m);
      })
      .catch((e) => console.warn('pair stats fetch', e));
    return () => {
      cancelled = true;
    };
  }, [team?.id]);

  const applyLineupRows = useCallback(
    (lineup: LineupsApi.LineupPair[]) => {
      const arr: SlotState[] = Array.from({ length: courts }).map((_, i) => {
        const found = lineup.find((p) => p.court_number === i + 1);
        return {
          court: i + 1,
          playerAId: found?.player_a_id ?? null,
          playerBId: found?.player_b_id ?? null,
        };
      });
      setSlots(arr);
      setPairNames(
        new Map(
          lineup
            .filter((p) => p.court_number != null)
            .map((p) => [
              p.court_number as number,
              { a: p.player_a_name ?? null, b: p.player_b_name ?? null },
            ]),
        ),
      );
      return arr;
    },
    [courts],
  );

  // Cargar la alineación cada vez que cambia la variante seleccionada.
  useEffect(() => {
    if (!currentVariantId) {
      setSlots(buildEmptySlots(courts));
      setPairNames(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const lineup = await LineupsApi.fetchLineup(currentVariantId);
        if (cancelled) return;
        const arr = applyLineupRows(lineup);
        // Sembramos el «último persistido» con el estado de BD.
        lastPersistedRef.current = new Map(
          arr.map((s) => [s.court, `${s.playerAId ?? ''}|${s.playerBId ?? ''}`]),
        );
      } catch (e) {
        console.warn('Lineup fetch', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentVariantId, courts, applyLineupRows]);

  const closed = matchday?.status === 'finished';
  const seasonClosed = season ? !season.active : false;
  const canEdit = !closed && !seasonClosed && isCaptain;

  const currentVariant = variants.find((v) => v.id === currentVariantId) ?? null;
  const activeVariant = variants.find((v) => v.is_active) ?? null;
  const activeVariantId = activeVariant?.id ?? null;

  const reloadVariants = useCallback(async () => {
    const vars = await LineupVariantsApi.listVariants(matchdayId);
    setVariants(vars);
    return vars;
  }, [matchdayId]);

  // Realtime: cambios de otro dispositivo (alineación, variante activa,
  // sets, acta) → refrescamos variantes, la variante visible y el matchday.
  useMatchdayRealtime({
    matchdayId,
    onChange: async () => {
      try {
        const [vars, md] = await Promise.all([
          reloadVariants(),
          MatchdaysApi.fetchMatchday(matchdayId),
        ]);
        setMatchday(md);
        const target =
          currentVariantId ?? vars.find((v) => v.is_active)?.id ?? vars[0]?.id ?? null;
        if (target) {
          const lineup = await LineupsApi.fetchLineup(target);
          applyLineupRows(lineup);
        }
        void loadAvailability();
      } catch (e) {
        console.warn('Lineup realtime refresh', e);
      }
    },
  });

  // ── Variantes ───────────────────────────────────────────────────
  const nextVariantLabel = useCallback(() => {
    // Primer «Variante N» libre: el unique (matchday_id, label) no admite
    // repetidos aunque se hayan borrado variantes intermedias.
    const used = new Set<number>();
    for (const v of variants) {
      const m = v.label.match(/^Variante (\d+)$/);
      if (m) used.add(parseInt(m[1], 10));
    }
    let n = 1;
    while (used.has(n)) n += 1;
    return `Variante ${n}`;
  }, [variants]);

  const handleAddVariant = useCallback(async () => {
    if (variants.length >= 5 || variantBusy || !canEdit) return;
    setVariantBusy(true);
    try {
      // Variante nueva SIEMPRE vacía (empieza de cero).
      const created = await LineupVariantsApi.createVariant(matchdayId, nextVariantLabel());
      const vars = await reloadVariants();
      setCurrentVariantId(created.id);
      if (!vars.find((v) => v.is_active)) {
        setCurrentVariantId(vars[0]?.id ?? null);
      }
    } catch (e: any) {
      Alert.alert('No se pudo crear', e?.message ?? '');
    } finally {
      setVariantBusy(false);
    }
  }, [variants, variantBusy, canEdit, matchdayId, reloadVariants, nextVariantLabel]);

  const handleDuplicate = useCallback(async () => {
    if (!currentVariant || variants.length >= 5 || variantBusy || !canEdit) return;
    setMoreOpen(false);
    setVariantBusy(true);
    try {
      const created = await LineupVariantsApi.createVariantWithClone(
        matchdayId,
        nextVariantLabel(),
        currentVariant.id,
      );
      await reloadVariants();
      setCurrentVariantId(created.id);
      toast.success(`«${created.label}» creada`, `Copia de «${currentVariant.label}».`);
    } catch (e: any) {
      Alert.alert('No se pudo duplicar', e?.message ?? '');
    } finally {
      setVariantBusy(false);
    }
  }, [currentVariant, variants.length, variantBusy, canEdit, matchdayId, nextVariantLabel, reloadVariants, toast]);

  const handleRename = useCallback(
    async (label: string) => {
      if (!currentVariant || variantBusy || !canEdit) return;
      setVariantBusy(true);
      try {
        await LineupVariantsApi.updateVariantLabel(currentVariant.id, label);
        await reloadVariants();
        setMoreOpen(false);
      } catch (e: any) {
        Alert.alert(
          'No se pudo renombrar',
          /duplicate|unique/i.test(e?.message ?? '')
            ? 'Ya hay otra variante con ese nombre.'
            : e?.message ?? '',
        );
      } finally {
        setVariantBusy(false);
      }
    },
    [currentVariant, variantBusy, canEdit, reloadVariants],
  );

  const handleSetActive = useCallback(
    async (variantId: string) => {
      if (variantBusy || !canEdit) return;
      if (variantId === activeVariantId) return;
      setVariantBusy(true);
      try {
        await LineupVariantsApi.setActiveVariant(variantId);
        await reloadVariants();
      } catch (e: any) {
        Alert.alert('No se pudo marcar oficial', e?.message ?? '');
      } finally {
        setVariantBusy(false);
      }
    },
    [variantBusy, canEdit, activeVariantId, reloadVariants],
  );

  const handleDeleteVariant = useCallback(
    (variant: LineupVariant) => {
      if (variantBusy || !canEdit) return;
      if (variant.is_active) {
        Alert.alert('No se puede eliminar', 'Marca otra variante como oficial antes de eliminar esta.');
        return;
      }
      Alert.alert(
        'Eliminar variante',
        `¿Eliminar «${variant.label}»? Se perderán sus parejas.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              setVariantBusy(true);
              try {
                await LineupVariantsApi.deleteVariant(variant.id);
                // Reaprovecha la numeración 1..N sin huecos.
                await LineupVariantsApi.renumberDefaultVariants(matchdayId);
                const vars = await reloadVariants();
                if (currentVariantId === variant.id) {
                  setCurrentVariantId(vars.find((v) => v.is_active)?.id ?? vars[0]?.id ?? null);
                }
              } catch (e: any) {
                Alert.alert('No se pudo eliminar', e?.message ?? '');
              } finally {
                setVariantBusy(false);
              }
            },
          },
        ],
      );
    },
    [variantBusy, canEdit, currentVariantId, matchdayId, reloadVariants],
  );

  // ── Persistencia + gate premium (chokepoint de todas las ediciones) ──
  const persistAll = useCallback(
    async (next: SlotState[]) => {
      if (!currentVariantId) return;
      dirtyRef.current = true;
      const keyOf = (sl: SlotState) => `${sl.playerAId ?? ''}|${sl.playerBId ?? ''}`;
      const changed = next.filter((sl) => lastPersistedRef.current.get(sl.court) !== keyOf(sl));
      if (changed.length === 0) return;
      try {
        await Promise.all(
          changed.map((sl) =>
            LineupsApi.setLineupPair(matchdayId, currentVariantId, sl.court, sl.playerAId, sl.playerBId),
          ),
        );
        for (const sl of changed) lastPersistedRef.current.set(sl.court, keyOf(sl));
      } catch (e: any) {
        Alert.alert('No se pudo guardar', e?.message ?? '');
      }
    },
    [matchdayId, currentVariantId],
  );

  const commit = useCallback(
    (next: SlotState[], opts?: { skipSort?: boolean }) => {
      // El generador decide su propio orden de pistas: con skipSort se respeta.
      const final = autoSort && !opts?.skipSort ? sortByPoints(next, playerById) : next;
      // Gate premium (reverse-trial): sin sub, paywall y NO se toca el estado.
      gate(() => {
        setSlots(final);
        void persistAll(final);
      }, 'lineup_edit')();
      return final;
    },
    [autoSort, playerById, persistAll, gate],
  );

  const usedIds = useMemo(() => {
    const s = new Set<string>();
    slots.forEach((sl) => {
      if (sl.playerAId) s.add(sl.playerAId);
      if (sl.playerBId) s.add(sl.playerBId);
    });
    return s;
  }, [slots]);

  // ── Convocatoria ────────────────────────────────────────────────
  const availMap = avail === undefined ? null : avail;
  // Nadie ha contestado (o no se pudo leer): el generador cae a la marca
  // general `players.available` para no quedarse sin nadie.
  const noReplies = !availMap || Object.keys(availMap).length === 0;
  const groupOf = useCallback(
    (p: Player): BenchGroup => benchGroupOf(p, avail === undefined ? null : avail),
    [avail],
  );

  const benchGroups = useMemo(() => {
    const g: Record<BenchGroup, Player[]> = { yes: [], maybe: [], pending: [], no: [] };
    players
      .filter((p) => p.active && !usedIds.has(p.id))
      .sort((a, b) => b.pts - a.pts)
      .forEach((p) => g[groupOf(p)].push(p));
    return g;
  }, [players, usedIds, groupOf]);

  const counts = useMemo(() => {
    const r = { yes: 0, maybe: 0, no: 0, pending: 0 };
    players.filter((p) => p.active).forEach((p) => {
      r[groupOf(p)] += 1;
    });
    return r;
  }, [players, groupOf]);

  /** Aviso antes de alinear a alguien que dijo «No puedo». */
  const confirmNo = useCallback(
    (playerId: string, proceed: () => void) => {
      const p = playerById.get(playerId);
      if (!p || groupOf(p) !== 'no' || noReplies) {
        proceed();
        return;
      }
      notifyWarning();
      Alert.alert(
        `${shortName(p)} dijo que no puede`,
        'Respondió «No puedo» para esta jornada. ¿Lo alineas igualmente?',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setSel(null) },
          { text: 'Alinear', onPress: proceed },
        ],
      );
    },
    [playerById, groupOf, noReplies],
  );

  const ptsArr = useMemo(() => slots.map((s) => ptsOfSlot(s, playerById)), [slots, playerById]);
  const validation = useMemo(
    () => calcValidation(slots, playerById, mustOrder),
    [slots, playerById, mustOrder],
  );
  const filledCount = slots.filter((s) => filledLen(s) === 2).length;
  const allOk = validation.every((v) => v.state !== 'err');
  const teamPts = ptsArr.reduce((a, b) => a + b, 0);
  const firstBreak = validation.findIndex((v) => v.state === 'err');

  const flashAvatar = useCallback((...ids: (string | null)[]) => {
    const valid = ids.filter((id): id is string => Boolean(id));
    setSwapAnimIds((s) => {
      const n = new Set(s);
      valid.forEach((id) => n.add(id));
      return n;
    });
    setTimeout(() => {
      setSwapAnimIds((s) => {
        const n = new Set(s);
        valid.forEach((id) => n.delete(id));
        return n;
      });
    }, 500);
  }, []);

  /** Coloca a `benchId` en el hueco `slot` de la pista `idx` (el que hubiera
   *  vuelve al banquillo). Lo usan el toque y el arrastre (tablet). */
  const placeFromBench = (benchId: string, idx: number, slot: SlotIdx) => {
    confirmNo(benchId, () => {
      const next = slots.map((p) => ({ ...p }));
      const target = next[idx];
      const displaced = slot === 0 ? target.playerAId : target.playerBId;
      if (slot === 0) target.playerAId = benchId;
      else target.playerBId = benchId;
      tapLight();
      flashAvatar(displaced, benchId);
      commit(next);
      setSel(null);
    });
  };

  /** Tablet: soltar un jugador del banquillo sobre una pista. */
  const onBenchDrop = (benchId: string, court: number, slot: SlotIdx) => {
    if (!canEdit) return;
    const idx = slots.findIndex((s) => s.court === court);
    if (idx === -1) return;
    placeFromBench(benchId, idx, slot);
  };

  // ── Tocar y tocar ──────────────────────────────────────────────
  const onSlotTap = (court: number, slot: SlotIdx) => {
    if (!canEdit) return;
    const idx = slots.findIndex((s) => s.court === court);
    if (idx === -1) return;
    const here = slot === 0 ? slots[idx].playerAId : slots[idx].playerBId;

    if (!sel) {
      if (here) {
        tapLight();
        setSel({ kind: 'slot', court, slot });
      }
      return;
    }
    if (sel.kind === 'slot' && sel.court === court && sel.slot === slot) {
      setSel(null);
      return;
    }
    if (sel.kind === 'bench') {
      placeFromBench(sel.id, idx, slot);
      return;
    }
    const fromIdx = slots.findIndex((s) => s.court === sel.court);
    if (fromIdx === -1) return;
    const next = slots.map((p) => ({ ...p }));
    const aId = sel.slot === 0 ? next[fromIdx].playerAId : next[fromIdx].playerBId;
    const bId = slot === 0 ? next[idx].playerAId : next[idx].playerBId;
    if (sel.slot === 0) next[fromIdx].playerAId = bId;
    else next[fromIdx].playerBId = bId;
    if (slot === 0) next[idx].playerAId = aId;
    else next[idx].playerBId = aId;
    tapLight();
    if (aId && bId) flashAvatar(aId, bId);
    else flashAvatar(aId);
    commit(next);
    setSel(null);
  };

  const onBenchTap = (id: string) => {
    if (!canEdit) return;
    if (!sel) {
      tapLight();
      setSel({ kind: 'bench', id });
      return;
    }
    if (sel.kind === 'bench' && sel.id === id) {
      setSel(null);
      return;
    }
    if (sel.kind === 'slot') {
      const idx = slots.findIndex((s) => s.court === sel.court);
      if (idx === -1) return;
      const slotSel = sel;
      confirmNo(id, () => {
        const next = slots.map((p) => ({ ...p }));
        const out = slotSel.slot === 0 ? next[idx].playerAId : next[idx].playerBId;
        if (slotSel.slot === 0) next[idx].playerAId = id;
        else next[idx].playerBId = id;
        tapLight();
        flashAvatar(out, id);
        commit(next);
        setSel(null);
      });
      return;
    }
    setSel({ kind: 'bench', id });
  };

  const removeFromSlot = (court: number, slot: SlotIdx) => {
    if (!canEdit) return;
    const idx = slots.findIndex((s) => s.court === court);
    if (idx === -1) return;
    const next = slots.map((p) => ({ ...p }));
    if (slot === 0) next[idx].playerAId = null;
    else next[idx].playerBId = null;
    commit(next);
    setSel(null);
  };

  /** «Rellenar con los que van»: huecos vacíos con Voy (y si no hay nadie que
   *  haya contestado, con la disponibilidad general), de más a menos puntos. */
  const fillEmpty = () => {
    if (!canEdit) return;
    setMoreOpen(false);
    const next = slots.map((p) => ({ ...p }));
    const empties: { court: number; slot: SlotIdx }[] = [];
    next.forEach((p) => {
      if (!p.playerAId) empties.push({ court: p.court, slot: 0 });
      if (!p.playerBId) empties.push({ court: p.court, slot: 1 });
    });
    const candidates = noReplies
      ? players.filter((p) => p.available && p.active && !usedIds.has(p.id)).sort((a, b) => b.pts - a.pts)
      : benchGroups.yes;
    if (candidates.length === 0) {
      toast.info('No queda nadie que vaya', 'Los que dijeron Voy ya están en pista.');
      return;
    }
    empties.forEach((e, i) => {
      const cand = candidates[i];
      if (!cand) return;
      const idx = next.findIndex((s) => s.court === e.court);
      if (idx === -1) return;
      if (e.slot === 0) next[idx].playerAId = cand.id;
      else next[idx].playerBId = cand.id;
    });
    commit(next);
    setSel(null);
  };

  const handleResetSlots = useCallback(() => {
    if (!canEdit || !currentVariantId) return;
    setMoreOpen(false);
    if (slots.every((s) => filledLen(s) === 0)) return;
    // Vaciar escribe directo (no pasa por commit) → gate premium aquí.
    gate(() => {
      Alert.alert(
        'Vaciar alineación',
        '¿Quitar todos los jugadores de esta variante? Quedará en blanco para empezar de cero.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar',
            style: 'destructive',
            onPress: () => {
              const empty = buildEmptySlots(courts);
              setSlots(empty);
              void persistAll(empty);
              setSel(null);
            },
          },
        ],
      );
    }, 'lineup_edit')();
  }, [canEdit, currentVariantId, slots, courts, persistAll, gate]);

  const toggleAutoSort = (next: boolean) => {
    setAutoSort(next);
    // Al activar, reordenamos al instante para que se note.
    if (next && canEdit) {
      const sorted = sortByPoints(slots, playerById);
      setSlots(sorted);
      void persistAll(sorted);
    }
  };

  // ── Generador: parte de los que dijeron Voy ─────────────────────
  const genPlayers = useMemo(() => {
    if (noReplies) return players;
    return players.map((p) => {
      const g = groupOf(p);
      return { ...p, available: g === 'yes' || (includeMaybe && g === 'maybe') };
    });
  }, [players, noReplies, groupOf, includeMaybe]);

  const genOptions = useMemo<LineupOption[]>(
    () =>
      genOpen
        ? generateLineupOptions(genPlayers, courts, {
            stats: pairStats,
            usePosition: genUsePosition,
            mustOrder,
          })
        : [],
    [genOpen, genPlayers, courts, pairStats, genUsePosition, mustOrder],
  );

  const chemistryLine = useCallback(
    (opt: LineupOption): string | null => {
      if (opt.key !== 'quimica' || !pairStats) return null;
      let best: { a: Player; b: Player; wins: number; played: number } | null = null;
      for (const s of opt.result.slots) {
        if (!s.playerAId || !s.playerBId) continue;
        const st = pairStats.get(pairKey(s.playerAId, s.playerBId));
        const a = playerById.get(s.playerAId);
        const b = playerById.get(s.playerBId);
        if (!st || !a || !b || st.played === 0) continue;
        if (!best || st.wins > best.wins) best = { a, b, wins: st.wins, played: st.played };
      }
      if (!best) return null;
      return `${shortName(best.a)} y ${shortName(best.b)}: ${best.wins} de ${best.played}`;
    },
    [pairStats, playerById],
  );

  const applyOption = useCallback(
    (opt: LineupOption) => {
      const next: SlotState[] = opt.result.slots.map((g) => ({
        court: g.court,
        playerAId: g.playerAId,
        playerBId: g.playerBId,
      }));
      setGenOpen(false);
      // El generador fija el orden: Auto-orden ON si mantiene la pirámide.
      setAutoSort(opt.pyramidOrder);
      commit(next, { skipSort: true });
      setGenKey((k) => k + 1);
      setSel(null);
      if (opt.result.warnings.length > 0) {
        toast.warn('Alineación generada con avisos', opt.result.warnings.join('\n'));
      } else {
        notifySuccess();
      }
    },
    [commit, toast],
  );

  // ── Publicar ───────────────────────────────────────────────────
  const openPublish = () => {
    const changedActive = !!currentVariantId && currentVariantId !== activeVariantId;
    setNotify(dirtyRef.current || changedActive || !activeVariantId);
    setPublishDone(false);
    setPublishOpen(true);
  };

  const sortForPublish = () => {
    const sorted = sortByPoints(slots, playerById);
    commit(sorted, { skipSort: true });
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('HomeRoot');
  };

  const doPublish = gate(() => {
    void (async () => {
      setPublishBusy(true);
      // Publicar = la variante que el capitán ESTÁ viendo pasa a oficial.
      const changedActive = !!currentVariantId && currentVariantId !== activeVariantId;
      try {
        if (changedActive) await LineupVariantsApi.setActiveVariant(currentVariantId!);
      } catch {
        // best-effort: la variante sigue guardada aunque falle el flag
      }
      if (notify && matchdayId) void notifyPush('lineup_published', matchdayId);
      dirtyRef.current = false;
      setPublishBusy(false);
      setPublishDone(true);
      notifySuccess();
      setTimeout(() => {
        setPublishOpen(false);
        goBack();
      }, 900);
    })();
  }, 'lineup_confirm');

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const header = (right?: React.ReactNode) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Volver a la jornada"
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
      >
        <IconBack size={16} color={c.text} />
        <Text style={styles.backLabel}>Jornada</Text>
      </Pressable>
      {right ?? null}
    </View>
  );

  if (!matchday) {
    return <View style={styles.root}>{header()}</View>;
  }

  const dateLabel = matchday.match_date
    ? formatShortDay(new Date(`${matchday.match_date}T12:00:00`))
    : 'Fecha por confirmar';
  const stripSub = [
    dateLabel,
    matchday.match_time ? matchday.match_time.slice(0, 5) : null,
    matchday.is_home ? 'local' : 'visitante',
  ]
    .filter(Boolean)
    .join(' · ');
  const stripTitle = `J${matchday.jornada_number} · vs ${matchday.opponent}`;
  const goersPill = !noReplies && counts.yes > 0 ? `${counts.yes} van` : null;

  const statusLine = (
    <View style={styles.stat}>
      <Text style={styles.statStrong}>
        {filledCount}/{courts} parejas
      </Text>
      <Text style={styles.statSep}>·</Text>
      {!mustOrder ? (
        <Text style={styles.statMuted}>orden libre</Text>
      ) : allOk ? (
        <Text style={styles.statOk}>orden correcto ✓</Text>
      ) : (
        <Text style={styles.statWarn}>P{firstBreak + 1} rompe el orden</Text>
      )}
      {teamPts > 0 ? (
        <>
          <Text style={styles.statSep}>·</Text>
          <Text style={styles.statMono}>{fmtPts(teamPts)} pts</Text>
        </>
      ) : null}
    </View>
  );

  const courtList = (opts: { editable: boolean; highlightMe?: boolean }) => (
    <View style={{ gap: 8 }}>
      {slots.map((sl, ci) => {
        const p1 = findPlayer(sl.playerAId);
        const p2 = findPlayer(sl.playerBId);
        const names = pairNames.get(sl.court) ?? null;
        const filled = filledLen(sl) === 2;
        const prevFilled = ci > 0 && filledLen(slots[ci - 1]) === 2;
        const broken = ci > 0 && filled && prevFilled && ptsArr[ci] > ptsArr[ci - 1];
        const isMine =
          !!opts.highlightMe && !!myPlayerId && (sl.playerAId === myPlayerId || sl.playerBId === myPlayerId);
        const benchName =
          sel?.kind === 'bench' ? (findPlayer(sel.id) ? shortName(findPlayer(sel.id)!) : null) : null;
        return (
          <React.Fragment key={`${genKey}-${sl.court}`}>
            {ci > 0 ? <CourtGap broken={broken} strict={mustOrder} /> : null}
            <CourtDropZone court={sl.court}>
            <Animated.View entering={genKey > 0 ? FadeInDown.delay(ci * 40).duration(220) : undefined}>
              <LineupCourt
                court={sl.court}
                p1={p1}
                p2={p2}
                fallback={names && (!p1 || !p2) ? names : null}
                total={ptsArr[ci]}
                filled={filled}
                validation={validation[ci]}
                sel={opts.editable ? sel : null}
                benchTarget={benchName}
                disabled={!opts.editable}
                highlight={isMine}
                myPlayerId={opts.highlightMe ? myPlayerId : null}
                onSlotTap={(slot) => onSlotTap(sl.court, slot)}
                onRemove={(slot) => removeFromSlot(sl.court, slot)}
                isAnimating={(id) => swapAnimIds.has(id)}
              />
            </Animated.View>
            </CourtDropZone>
          </React.Fragment>
        );
      })}
    </View>
  );

  // ── Jugador: lectura con «Tu pareja» ─────────────────────────────
  if (!isCaptain && !isClub) {
    const published = !!activeVariantId && slots.some((s) => filledLen(s) > 0);
    const mySlot = myPlayerId
      ? slots.find((s) => s.playerAId === myPlayerId || s.playerBId === myPlayerId) ?? null
      : null;
    const me = findPlayer(myPlayerId);
    const partnerId = mySlot ? (mySlot.playerAId === myPlayerId ? mySlot.playerBId : mySlot.playerAId) : null;
    const partner = findPlayer(partnerId);
    const partnerFallback = mySlot
      ? (mySlot.playerAId === myPlayerId ? pairNames.get(mySlot.court)?.b : pairNames.get(mySlot.court)?.a) ?? 'tu pareja'
      : 'tu pareja';
    const stats = myPlayerId && partnerId && pairStats ? pairStats.get(pairKey(myPlayerId, partnerId)) ?? null : null;
    const myStatus = myPlayerId && availMap ? availMap[myPlayerId]?.status ?? null : null;

    const shareLineup = async () => {
      const lines = slots.map((s) => {
        const a = findPlayer(s.playerAId);
        const b = findPlayer(s.playerBId);
        const n = pairNames.get(s.court);
        return `P${s.court} · ${a?.name ?? n?.a ?? '—'} / ${b?.name ?? n?.b ?? '—'}`;
      });
      try {
        await Share.share({
          message: [`🎾 ${team?.name ?? ''} · ${stripTitle}`, stripSub, '', ...lines].join('\n'),
        });
      } catch {
        // cancelado
      }
    };

    const respond = async (status: AvailabilityApi.AvailabilityStatus) => {
      if (!myPlayerId) return;
      setRsvpBusy(true);
      try {
        await AvailabilityApi.respondAvailability({ matchdayId, playerId: myPlayerId, status });
        tapLight();
        await loadAvailability();
      } catch (e: any) {
        toast.error('No se pudo guardar tu respuesta', e?.message ?? '');
      } finally {
        setRsvpBusy(false);
      }
    };

    return (
      <View style={styles.root}>
        {header(
          published ? (
            <Pressable onPress={shareLineup} hitSlop={8} accessibilityRole="button">
              <Text style={styles.headerLink}>Compartir</Text>
            </Pressable>
          ) : null,
        )}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }, isTablet && styles.tabletColumn]}
          showsVerticalScrollIndicator={false}
        >
          <LineupStrip teamName={team?.name ?? ''} title={stripTitle} sub={[stripSub, matchday.location].filter(Boolean).join(' · ')} pill={published ? null : goersPill} />
          {!published ? (
            <NoLineupYet
              myStatus={myStatus}
              canRespond={!!myPlayerId && !closed}
              busy={rsvpBusy}
              onRespond={respond}
            />
          ) : (
            <>
              {mySlot ? (
                <MyPairCard
                  court={mySlot.court}
                  me={me}
                  partner={partner}
                  partnerName={partnerFallback}
                  pairPts={filledLen(mySlot) === 2 ? ptsOfSlot(mySlot, playerById) || null : null}
                  stats={stats}
                />
              ) : myPlayerId ? (
                <InfoBanner>No juegas esta jornada. Si cambia algo, el capitán te avisará.</InfoBanner>
              ) : null}
              <Text style={styles.eyebrowFaint}>ALINEACIÓN OFICIAL</Text>
              {courtList({ editable: false, highlightMe: true })}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Club: lectura con aviso ──────────────────────────────────────
  if (!isCaptain && isClub) {
    const publishedAt = activeVariant?.updated_at
      ? new Date(activeVariant.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : null;
    return (
      <View style={styles.root}>
        {header()}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }, isTablet && styles.tabletColumn]}
          showsVerticalScrollIndicator={false}
        >
          <LineupStrip
            teamName={team?.name ?? ''}
            title={stripTitle}
            sub={
              activeVariantId && slots.some((s) => filledLen(s) > 0)
                ? `${team?.name ?? ''} · publicada${publishedAt ? ` el ${publishedAt}` : ''}`
                : `${team?.name ?? ''} · sin publicar`
            }
          />
          <InfoBanner>
            Vista del club, solo lectura. Para editarla, pasa a modo capitán desde Perfil.
          </InfoBanner>
          {statusLine}
          {courtList({ editable: false })}
          {!noReplies ? (
            <Text style={styles.footNote}>
              Convocatoria: {counts.yes} van · {counts.maybe} con duda · {counts.no} no
              {counts.pending > 0 ? ` · ${counts.pending} sin contestar` : ''}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ── Capitán: editor ─────────────────────────────────────────────
  const breakInfo =
    firstBreak > 0
      ? {
          upper: firstBreak,
          lower: firstBreak + 1,
          upperPts: ptsArr[firstBreak - 1],
          lowerPts: ptsArr[firstBreak],
        }
      : null;
  const publishRows: PublishRow[] = slots.map((s, i) => {
    const a = findPlayer(s.playerAId);
    const b = findPlayer(s.playerBId);
    return {
      court: s.court,
      label: `${a ? shortName(a) : '—'} / ${b ? shortName(b) : '—'}`,
      pts: ptsArr[i],
      broken: validation[i].state === 'err' || (i + 1 < slots.length && validation[i + 1].state === 'err'),
    };
  });
  const missing = courts - filledCount;

  const moreButton = canEdit ? (
    <Pressable
      onPress={() => setMoreOpen(true)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Más opciones de la alineación"
      style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
    >
      <IconMenu size={16} color={c.text} />
    </Pressable>
  ) : null;

  const variantTabs =
    variants.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={[styles.tabsWrap, wide && { flexShrink: 1 }]}
      >
        {variants.map((v) => {
          const on = v.id === currentVariantId;
          return (
            <Pressable
              key={v.id}
              onPress={() => {
                setSel(null);
                setCurrentVariantId(v.id);
              }}
              onLongPress={() => {
                if (!canEdit) return;
                setCurrentVariantId(v.id);
                setMoreOpen(true);
              }}
              disabled={variantBusy}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && { color: c.text }]} numberOfLines={1}>
                {v.is_active ? <Text style={{ color: c.accent }}>★ </Text> : null}
                {v.label}
              </Text>
            </Pressable>
          );
        })}
        {variants.length < 5 && canEdit ? (
          <Pressable
            onPress={handleAddVariant}
            disabled={variantBusy}
            accessibilityRole="button"
            accessibilityLabel="Nueva variante"
            style={[styles.tab, variantBusy && { opacity: 0.4 }]}
          >
            <Text style={styles.tabText}>＋</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    ) : null;

  const editorScroll = (
    <ScrollView
      contentContainerStyle={styles.scrollEditor}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={(e) => e.stopPropagation()} style={{ gap: 10 }}>
        {!canEdit ? (
          <InfoBanner>
            {closed
              ? 'Acta cerrada · la alineación es de solo lectura.'
              : 'Temporada archivada · la alineación es de solo lectura.'}
          </InfoBanner>
        ) : null}

        {canEdit ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (currentVariantId) setGenOpen(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.85 }]}
          >
            <IconBolt size={14} color={c.accent} />
            <Text style={styles.generateLabel}>Generar con los que van</Text>
            <Text style={styles.generateHint}>
              {noReplies ? 'sin respuestas aún' : `${counts.yes} Voy · ${counts.maybe} Duda`}
            </Text>
          </Pressable>
        ) : null}

        {courtList({ editable: canEdit })}
      </Pressable>
    </ScrollView>
  );

  const publishButton = (
    <Pressable
      disabled={missing > 0}
      onPress={openPublish}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.cta,
        missing > 0 && styles.ctaDisabled,
        missing === 0 && !allOk && styles.ctaWarn,
        pressed && missing === 0 && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.ctaLabel,
          missing > 0 && { color: c.textFaint },
          missing === 0 && !allOk && { color: c.warning },
        ]}
      >
        {missing > 0
          ? `Falta${missing > 1 ? 'n' : ''} ${missing} pareja${missing > 1 ? 's' : ''}`
          : 'Publicar'}
      </Text>
    </Pressable>
  );

  const yesPlaced = players.filter(
    (p) => p.active && usedIds.has(p.id) && groupOf(p) === 'yes',
  ).length;

  const sheets = (
    <>
      <GenerateSheet
        open={genOpen}
        onClose={() => setGenOpen(false)}
        options={genOptions}
        playerById={playerById}
        usePosition={genUsePosition}
        onUsePosition={setGenUsePosition}
        includeMaybe={includeMaybe}
        onIncludeMaybe={setIncludeMaybe}
        maybeCount={counts.maybe}
        goersCount={counts.yes}
        noReplies={noReplies}
        chemistryLine={chemistryLine}
        onUse={applyOption}
      />

      <PublishSheet
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        jornada={matchday.jornada_number}
        rows={publishRows}
        mustOrder={mustOrder}
        breakInfo={breakInfo}
        onSort={sortForPublish}
        notify={notify}
        onNotify={setNotify}
        convocados={filledCount * 2}
        busy={publishBusy}
        done={publishDone}
        onPublish={doPublish}
      />

      <LineupMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        variant={currentVariant}
        canAddVariant={variants.length < 5}
        autoSort={autoSort}
        onAutoSort={toggleAutoSort}
        filledCount={filledCount}
        onMarkOfficial={() => {
          setMoreOpen(false);
          if (currentVariant) void handleSetActive(currentVariant.id);
        }}
        onDuplicate={handleDuplicate}
        onRename={handleRename}
        onDelete={() => {
          setMoreOpen(false);
          if (currentVariant) handleDeleteVariant(currentVariant);
        }}
        onFill={fillEmpty}
        onClear={handleResetSlots}
      />
    </>
  );

  // Móvil (y tablet sin sitio): la pantalla de siempre.
  const phoneBody = (
    <>
      {header(moreButton)}

      <View style={styles.top}>
        <LineupStrip teamName={team?.name ?? ''} title={stripTitle} sub={stripSub} pill={goersPill} />
        {variantTabs}
        {statusLine}
      </View>

      {editorScroll}

      {canEdit ? (
        <>
          {isTablet ? (
            <LineupBenchPanel
              layout="grid"
              jornada={matchday.jornada_number}
              groups={benchGroups}
              yesPlaced={yesPlaced}
              sel={sel}
              disabled={!canEdit}
              draggable
              onTap={onBenchTap}
              isAnimating={(id) => swapAnimIds.has(id)}
            />
          ) : (
            <LineupBench
              jornada={matchday.jornada_number}
              groups={benchGroups}
              sel={sel}
              disabled={!canEdit}
              bottomInset={0}
              onTap={onBenchTap}
              isAnimating={(id) => swapAnimIds.has(id)}
            />
          )}
          <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {publishButton}
          </View>
        </>
      ) : null}
    </>
  );

  // Tablet horizontal: pistas en el centro y banquillo fijo a la derecha.
  const wideBody = (
    <>
      {header(moreButton)}
      <View style={styles.wideRow}>
        <View style={styles.wideMain}>
          <View style={styles.top}>
            <LineupStrip teamName={team?.name ?? ''} title={stripTitle} sub={stripSub} pill={goersPill} />
            <View style={styles.wideTabsRow}>
              {variantTabs}
              <View style={{ flexShrink: 0 }}>{statusLine}</View>
            </View>
          </View>
          {editorScroll}
          {canEdit ? (
            <View style={[styles.wideFoot, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <Text style={styles.wideFootHint} numberOfLines={2}>
                Cada cambio se guarda solo. Publicar avisa al equipo.
              </Text>
              <View style={styles.wideCta}>{publishButton}</View>
            </View>
          ) : null}
        </View>
        {canEdit ? (
          <LineupBenchPanel
            layout="column"
            jornada={matchday.jornada_number}
            groups={benchGroups}
            yesPlaced={yesPlaced}
            sel={sel}
            disabled={!canEdit}
            draggable
            onTap={onBenchTap}
            isAnimating={(id) => swapAnimIds.has(id)}
          />
        ) : null}
      </View>
    </>
  );

  return (
    <Pressable onPress={() => setSel(null)} style={styles.root} android_disableSound>
      {isTablet ? (
        <LineupDragLayer enabled={canEdit} onDrop={onBenchDrop}>
          {wide ? wideBody : phoneBody}
        </LineupDragLayer>
      ) : (
        phoneBody
      )}

      {sheets}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    // Tablet · lectura (jugador y club): columna de 720 centrada.
    tabletColumn: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    wideRow: { flex: 1, flexDirection: 'row' },
    wideMain: { flex: 1, minWidth: 0 },
    wideTabsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    wideFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairStrong,
      backgroundColor: c.bgRaised,
    },
    wideFootHint: { flex: 1, color: c.textFaint, fontSize: 12 },
    wideCta: { width: 280 },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    backBtn: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    headerLink: { color: c.accent, fontSize: 14, fontWeight: '700' },
    moreBtn: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    top: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
    tabsWrap: { flexGrow: 0 },
    tabs: {
      gap: 4,
      padding: 3,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 9,
      minWidth: 44,
      alignItems: 'center',
    },
    tabOn: { backgroundColor: c.bgCard2 },
    tabText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    statStrong: { color: c.text, fontSize: 13, fontWeight: '700' },
    statSep: { color: c.textFaint, fontSize: 13 },
    statOk: { color: c.accent, fontSize: 13, fontWeight: '700' },
    statWarn: { color: c.warning, fontSize: 13, fontWeight: '700' },
    statMuted: { color: c.textMuted, fontSize: 13 },
    statMono: { color: c.textMuted, fontSize: 12.5, fontFamily: Fonts.mono },
    scroll: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
    scrollEditor: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
    eyebrowFaint: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '500',
      marginTop: 4,
    },
    footNote: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 4 },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    generateLabel: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    generateHint: {
      marginLeft: 'auto',
      color: c.textFaint,
      fontSize: 11,
      fontFamily: Fonts.mono,
    },
    ctaWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: c.bgRaised,
    },
    cta: {
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaDisabled: { backgroundColor: c.bgCard2 },
    ctaWarn: {
      backgroundColor: 'rgba(242,201,76,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(242,201,76,0.45)',
    },
    ctaLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
  });
