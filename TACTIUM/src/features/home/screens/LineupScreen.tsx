import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconBack,
  IconBolt,
  IconAlert,
  IconCheck,
  IconPlus,
  IconTrash,
  BottomSheet,
  Toggle,
} from '@components/ui';
import * as MatchdaysApi from '@core/services/matchdays';
import * as LineupsApi from '@core/services/lineups';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import * as SeasonsApi from '@core/services/seasons';
import type { LineupVariant } from '@core/services/lineupVariants';
import { useMatchdayRealtime } from '@core/hooks/useMatchdayRealtime';
import { getCourtsForCompetition, requiresStrengthOrder } from '@core/data/federations';
import { useTeamStore, selectIsCaptain, type Player } from '@store/teamStore';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { generateLineup, type PairStatsMap } from '@core/utils/lineupGenerator';
import { fetchPairStats } from '@core/services/pairStats';
import { shortName, initialsOf, photoOf } from '@core/utils/playerName';

import type { HomeStackScreenProps } from '@navigation/types';

type SlotIdx = 0 | 1;

interface SlotState {
  court: number;
  playerAId: string | null;
  playerBId: string | null;
}

type Selection =
  | { kind: 'slot'; court: number; slot: SlotIdx }
  | { kind: 'bench'; id: string }
  | null;

type Validation =
  | { state: 'ok' }
  | { state: 'warn' }
  | { state: 'err'; msg: string; diff: number }
  | { state: 'empty' };

const filledLen = (s: SlotState) =>
  (s.playerAId ? 1 : 0) + (s.playerBId ? 1 : 0);

const buildEmptySlots = (courts: number): SlotState[] =>
  Array.from({ length: courts }).map((_, i) => ({
    court: i + 1,
    playerAId: null,
    playerBId: null,
  }));

const ptsOfSlot = (s: SlotState, byId: Map<string, Player>) =>
  (s.playerAId ? byId.get(s.playerAId)?.pts ?? 0 : 0) +
  (s.playerBId ? byId.get(s.playerBId)?.pts ?? 0 : 0);

const sortByPoints = (
  input: SlotState[],
  byId: Map<string, Player>,
): SlotState[] => {
  const normalized = input.map((p) => {
    const a = p.playerAId ? byId.get(p.playerAId) : null;
    const b = p.playerBId ? byId.get(p.playerBId) : null;
    if (a && b) {
      return a.pts >= b.pts
        ? { playerAId: a.id, playerBId: b.id }
        : { playerAId: b.id, playerBId: a.id };
    }
    if (a && !b) return { playerAId: a.id, playerBId: null };
    if (!a && b) return { playerAId: b.id, playerBId: null };
    return { playerAId: null, playerBId: null };
  });

  const indexed = normalized.map((n, i) => ({
    ...n,
    pts: ptsOfSlot({ court: i, ...n }, byId),
    fill: (n.playerAId ? 1 : 0) + (n.playerBId ? 1 : 0),
  }));

  indexed.sort((a, b) => {
    if (a.fill !== b.fill) return b.fill - a.fill;
    return b.pts - a.pts;
  });

  return indexed.map((n, i) => ({
    court: i + 1,
    playerAId: n.playerAId,
    playerBId: n.playerBId,
  }));
};

const calcBalance = (
  slots: SlotState[],
  byId: Map<string, Player>,
): number | null => {
  const ptsArr = slots.map((s) => ptsOfSlot(s, byId));
  const filled = ptsArr.filter((_, i) => filledLen(slots[i]) === 2);
  if (filled.length < 2) return null;
  let score = 0;
  for (let i = 0; i < filled.length - 1; i++) {
    const diff = filled[i] - filled[i + 1];
    if (diff < 0) score += 0;
    else if (diff === 0) score += 0.7;
    else score += Math.min(1, diff / 50 + 0.6);
  }
  return Math.round((score / (filled.length - 1)) * 100);
};

const calcValidation = (
  slots: SlotState[],
  byId: Map<string, Player>,
  mustOrder: boolean = true,
): Validation[] => {
  const ptsArr = slots.map((s) => ptsOfSlot(s, byId));
  return ptsArr.map((v, i) => {
    if (filledLen(slots[i]) !== 2) return { state: 'empty' };
    if (i === 0) return { state: 'ok' };
    if (v > ptsArr[i - 1]) {
      // El orden estricto solo es error si la federación lo exige.
      if (!mustOrder) return { state: 'ok' };
      const diff = v - ptsArr[i - 1];
      return {
        state: 'err',
        msg: `Pareja ${i + 1} más fuerte que la ${i}`,
        diff,
      };
    }
    if ((ptsArr[i - 1] - v) / Math.max(ptsArr[i - 1], 1) < 0.05) {
      return { state: 'warn' };
    }
    return { state: 'ok' };
  });
};

export const LineupScreen = ({
  navigation,
  route,
}: HomeStackScreenProps<'Lineup'>) => {
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  // Solo captain/club_admin pueden editar. El override de rol desde Profile
  // (captain previsualizando como player) también desactiva la edición —
  // RLS de Supabase de todas formas rechazaría a un player real, pero
  // queremos defense in depth y no mostrarles botones que no funcionan.
  const isCaptain = useTeamStore(selectIsCaptain);
  const gate = usePremiumGate();
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
  // La season se carga junto al matchday para saber si está archivada y
  // bloquear edición de alineación cuando lo está (los resultados siguen
  // editables — eso vive en ResultsScreen).
  const [season, setSeason] = useState<SeasonsApi.Season | null>(null);
  const [variants, setVariants] = useState<LineupVariant[]>([]);
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [slots, setSlots] = useState<SlotState[]>(() =>
    buildEmptySlots(courts),
  );
  const [sel, setSel] = useState<Selection>(null);
  // Default del auto-orden depende de la federación/liga: ON si exige orden
  // por fuerza (FEP standard), OFF si la liga deja libertad táctica al capi.
  const [autoSort, setAutoSort] = useState(mustOrder);
  const [pulseCourts, setPulseCourts] = useState<Set<number>>(new Set());
  const [swapAnimIds, setSwapAnimIds] = useState<Set<string>>(new Set());
  const [autoDelta, setAutoDelta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Química por historial (Fase 2). Best-effort: si falla, el generador
  // sigue funcionando solo con posición + puntos.
  const [pairStats, setPairStats] = useState<PairStatsMap | undefined>(
    undefined,
  );
  // Filtros del generador de parejas.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genOpts, setGenOpts] = useState({
    useChemistry: true,
    usePosition: true,
    strongestOnCourt1: true,
  });

  // Carga inicial: matchday + variantes. La variante activa pasa a ser
  // currentVariantId por defecto.
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
        // Encadenamos el fetch de la season (depende de md.season_id).
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

  // Química por historial del equipo (para el generador). Best-effort.
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

  // Cargar lineup cada vez que cambia la variante seleccionada.
  useEffect(() => {
    if (!currentVariantId) {
      setSlots(buildEmptySlots(courts));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const lineup = await LineupsApi.fetchLineup(currentVariantId);
        if (cancelled) return;
        const arr: SlotState[] = Array.from({ length: courts }).map((_, i) => {
          const found = lineup.find((p) => p.court_number === i + 1);
          return {
            court: i + 1,
            playerAId: found?.player_a_id ?? null,
            playerBId: found?.player_b_id ?? null,
          };
        });
        setSlots(arr);
      } catch (e) {
        console.warn('Lineup fetch', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentVariantId, courts]);

  const closed = matchday?.status === 'finished';
  // La season cerrada bloquea edición de alineación pero NO de resultados.
  // El usuario quiere poder ponerse al día con actas pendientes después de
  // cerrar (decisión de producto). Aquí solo nos afecta a la alineación.
  const seasonClosed = season ? !season.active : false;
  // Read-only abarca: acta cerrada, season archivada o el user no es captain.
  // A nivel funcional son indistinguibles para la UI (todo desactivado), pero
  // el copy del hint difiere.
  const canEdit = !closed && !seasonClosed && isCaptain;

  // ─── Variantes: handlers ─────────────────────────────────────
  const currentVariant = variants.find((v) => v.id === currentVariantId) ?? null;
  const activeVariantId = variants.find((v) => v.is_active)?.id ?? null;

  const reloadVariants = useCallback(async () => {
    const vars = await LineupVariantsApi.listVariants(matchdayId);
    setVariants(vars);
    return vars;
  }, [matchdayId]);

  // Realtime: cuando llega un cambio externo sobre este matchday
  // (otro device subiendo la alineación, cambiando variante activa,
  // marcando un set o cerrando acta) refrescamos variantes + lineup
  // de la variante visible + el propio matchday (para el status).
  useMatchdayRealtime({
    matchdayId,
    onChange: async () => {
      try {
        const [vars, md] = await Promise.all([
          reloadVariants(),
          MatchdaysApi.fetchMatchday(matchdayId),
        ]);
        setMatchday(md);
        // Si el lineup no cambia de variante visible, repintamos la
        // que estamos viendo. Si no había, caemos a la activa.
        const target =
          currentVariantId ??
          vars.find((v) => v.is_active)?.id ??
          vars[0]?.id ??
          null;
        if (target) {
          const lineup = await LineupsApi.fetchLineup(target);
          const arr: SlotState[] = Array.from({ length: courts }).map(
            (_, i) => {
              const found = lineup.find((p) => p.court_number === i + 1);
              return {
                court: i + 1,
                playerAId: found?.player_a_id ?? null,
                playerBId: found?.player_b_id ?? null,
              };
            },
          );
          setSlots(arr);
        }
      } catch (e) {
        console.warn('Lineup realtime refresh', e);
      }
    },
  });

  const handleAddVariant = useCallback(async () => {
    if (variants.length >= 5 || variantBusy || !canEdit) return;
    setVariantBusy(true);
    try {
      // Calculamos el primer "Variante N" libre. No basta con length+1 porque
      // si los labels quedaron desfasados por un delete pre-renumerado podría
      // colisionar con el unique (matchday_id, label).
      const used = new Set<number>();
      for (const v of variants) {
        const m = v.label.match(/^Variante (\d+)$/);
        if (m) used.add(parseInt(m[1], 10));
      }
      let nextNum = 1;
      while (used.has(nextNum)) nextNum += 1;

      // Variante nueva SIEMPRE vacía (empieza de cero), no clona la actual.
      const created = await LineupVariantsApi.createVariant(
        matchdayId,
        `Variante ${nextNum}`,
      );
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
  }, [variants, variantBusy, canEdit, matchdayId, reloadVariants]);

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
    async (variant: LineupVariant) => {
      if (variantBusy || !canEdit) return;
      if (variant.is_active) {
        Alert.alert(
          'No se puede eliminar',
          'Marca otra variante como oficial antes de eliminar esta.',
        );
        return;
      }
      Alert.alert(
        'Eliminar variante',
        `¿Eliminar "${variant.label}"? Se perderán las parejas asignadas a esta variante.`,
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
                  setCurrentVariantId(
                    vars.find((v) => v.is_active)?.id ?? vars[0]?.id ?? null,
                  );
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

  const openVariantActions = useCallback(
    (variant: LineupVariant) => {
      if (!canEdit) return;
      const isActive = variant.is_active;
      Alert.alert(
        variant.label,
        isActive ? 'Esta es la variante oficial.' : undefined,
        [
          ...(isActive
            ? []
            : [
                {
                  text: '⭐  Marcar oficial',
                  onPress: () => handleSetActive(variant.id),
                },
              ]),
          ...(isActive
            ? []
            : [
                {
                  text: '🗑  Eliminar',
                  style: 'destructive' as const,
                  onPress: () => handleDeleteVariant(variant),
                },
              ]),
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    },
    [canEdit, handleSetActive, handleDeleteVariant],
  );

  const persistAll = useCallback(
    async (next: SlotState[]) => {
      if (!currentVariantId) return;
      try {
        await Promise.all(
          next.map((sl) =>
            LineupsApi.setLineupPair(
              matchdayId,
              currentVariantId,
              sl.court,
              sl.playerAId,
              sl.playerBId,
            ),
          ),
        );
      } catch (e: any) {
        Alert.alert('No se pudo guardar', e?.message ?? '');
      }
    },
    [matchdayId, currentVariantId],
  );

  const commit = useCallback(
    (next: SlotState[]) => {
      const final = autoSort ? sortByPoints(next, playerById) : next;
      setSlots(final);
      void persistAll(final);
      return final;
    },
    [autoSort, playerById, persistAll],
  );

  const usedIds = useMemo(() => {
    const s = new Set<string>();
    slots.forEach((sl) => {
      if (sl.playerAId) s.add(sl.playerAId);
      if (sl.playerBId) s.add(sl.playerBId);
    });
    return s;
  }, [slots]);

  const benchPlayers = useMemo(
    () =>
      players
        .filter((p) => p.available && p.active && !usedIds.has(p.id))
        .sort((a, b) => b.pts - a.pts),
    [players, usedIds],
  );

  const ptsArr = useMemo(
    () => slots.map((s) => ptsOfSlot(s, playerById)),
    [slots, playerById],
  );

  const balance = useMemo(
    () => calcBalance(slots, playerById),
    [slots, playerById],
  );

  const validation = useMemo(
    () => calcValidation(slots, playerById, mustOrder),
    [slots, playerById, mustOrder],
  );

  const filledCount = slots.filter((s) => filledLen(s) === 2).length;
  const allOk = validation.every((v) => v.state !== 'err');

  const pulseCourt = useCallback((idx: number) => {
    setPulseCourts((s) => new Set(s).add(idx));
    setTimeout(() => {
      setPulseCourts((s) => {
        const n = new Set(s);
        n.delete(idx);
        return n;
      });
    }, 500);
  }, []);

  const pulseAll = useCallback(() => {
    setPulseCourts(new Set(slots.map((_, i) => i)));
    setTimeout(() => setPulseCourts(new Set()), 500);
  }, [slots]);

  const handleResetSlots = useCallback(() => {
    if (!canEdit || !currentVariantId) return;
    const isAlreadyEmpty = slots.every((s) => filledLen(s) === 0);
    if (isAlreadyEmpty) return;
    Alert.alert(
      'Vaciar alineación',
      '¿Quitar todos los jugadores de la variante actual? Quedará en blanco para empezar de cero.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: () => {
            const empty = buildEmptySlots(courts);
            setSlots(empty);
            void persistAll(empty);
            pulseAll();
            setSel(null);
          },
        },
      ],
    );
  }, [canEdit, currentVariantId, slots, courts, persistAll, pulseAll]);

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

  const onSlotTap = (court: number, slot: SlotIdx) => {
    if (!canEdit) return;
    const idx = slots.findIndex((s) => s.court === court);
    if (idx === -1) return;
    const here = slot === 0 ? slots[idx].playerAId : slots[idx].playerBId;

    if (!sel) {
      if (here) setSel({ kind: 'slot', court, slot });
      return;
    }
    if (sel.kind === 'slot' && sel.court === court && sel.slot === slot) {
      setSel(null);
      return;
    }
    if (sel.kind === 'bench') {
      const next = slots.map((p) => ({ ...p }));
      const target = next[idx];
      const displaced = slot === 0 ? target.playerAId : target.playerBId;
      if (slot === 0) target.playerAId = sel.id;
      else target.playerBId = sel.id;
      flashAvatar(displaced, sel.id);
      commit(next);
      pulseAll();
      setSel(null);
      return;
    }
    const fromIdx = slots.findIndex((s) => s.court === sel.court);
    if (fromIdx === -1) return;
    const next = slots.map((p) => ({ ...p }));
    const aId =
      sel.slot === 0 ? next[fromIdx].playerAId : next[fromIdx].playerBId;
    const bId = slot === 0 ? next[idx].playerAId : next[idx].playerBId;
    if (sel.slot === 0) next[fromIdx].playerAId = bId;
    else next[fromIdx].playerBId = bId;
    if (slot === 0) next[idx].playerAId = aId;
    else next[idx].playerBId = aId;
    if (aId && bId) flashAvatar(aId, bId);
    commit(next);
    pulseAll();
    setSel(null);
  };

  const onSlotEmpty = (court: number, slot: SlotIdx) => {
    if (!canEdit || !sel) return;
    const idx = slots.findIndex((s) => s.court === court);
    if (idx === -1) return;
    const next = slots.map((p) => ({ ...p }));
    if (sel.kind === 'bench') {
      if (slot === 0) next[idx].playerAId = sel.id;
      else next[idx].playerBId = sel.id;
      flashAvatar(sel.id);
      commit(next);
      pulseAll();
      setSel(null);
      return;
    }
    const fromIdx = slots.findIndex((s) => s.court === sel.court);
    if (fromIdx === -1) return;
    const moved =
      sel.slot === 0 ? next[fromIdx].playerAId : next[fromIdx].playerBId;
    if (slot === 0) next[idx].playerAId = moved;
    else next[idx].playerBId = moved;
    if (sel.slot === 0) next[fromIdx].playerAId = null;
    else next[fromIdx].playerBId = null;
    if (moved) flashAvatar(moved);
    commit(next);
    pulseAll();
    setSel(null);
  };

  const onBenchTap = (id: string) => {
    if (!canEdit) return;
    if (!sel) {
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
      const next = slots.map((p) => ({ ...p }));
      const out =
        sel.slot === 0 ? next[idx].playerAId : next[idx].playerBId;
      if (sel.slot === 0) next[idx].playerAId = id;
      else next[idx].playerBId = id;
      flashAvatar(out, id);
      commit(next);
      pulseAll();
      setSel(null);
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
    pulseCourt(idx);
    setSel(null);
  };

  const fillEmpty = () => {
    if (!canEdit) return;
    const next = slots.map((p) => ({ ...p }));
    const empties: { court: number; slot: SlotIdx }[] = [];
    next.forEach((p) => {
      if (!p.playerAId) empties.push({ court: p.court, slot: 0 });
      if (!p.playerBId) empties.push({ court: p.court, slot: 1 });
    });
    const candidates = [...benchPlayers];
    empties.forEach((e, i) => {
      const cand = candidates[i];
      if (!cand) return;
      const idx = next.findIndex((s) => s.court === e.court);
      if (idx === -1) return;
      if (e.slot === 0) next[idx].playerAId = cand.id;
      else next[idx].playerBId = cand.id;
    });
    commit(next);
    pulseAll();
    setSel(null);
  };

  // Genera una alineación completa consciente de la posición (Drive+Revés).
  // A diferencia de `fillEmpty` (solo puntos), esto arma TODAS las parejas
  // desde cero respetando posición. Si ya hay parejas montadas, confirma
  // antes de sobrescribir el trabajo manual del capitán.
  const runGenerate = useCallback(() => {
    const { slots: generated, warnings } = generateLineup(players, courts, {
      stats: genOpts.useChemistry ? pairStats : undefined,
      usePosition: genOpts.usePosition,
      strongestOnCourt1: genOpts.strongestOnCourt1,
    });
    const next: SlotState[] = generated.map((g) => ({
      court: g.court,
      playerAId: g.playerAId,
      playerBId: g.playerBId,
    }));
    setFiltersOpen(false);
    commit(next);
    pulseAll();
    setSel(null);
    if (warnings.length > 0) {
      Alert.alert('Alineación generada con avisos', warnings.join('\n'));
    } else {
      setAutoDelta('alineación generada');
      setTimeout(() => setAutoDelta(null), 2400);
    }
  }, [players, courts, pairStats, genOpts, commit, pulseAll]);

  // El botón abre el panel de filtros; el generado real se lanza desde ahí.
  const handleGenerate = useCallback(() => {
    if (!canEdit || !currentVariantId) return;
    setFiltersOpen(true);
  }, [canEdit, currentVariantId]);

  const suggestion = useMemo(() => {
    if (!allOk || filledCount < courts || benchPlayers.length === 0)
      return null;
    const currentBalance = balance ?? 0;
    if (currentBalance >= 92) return null;
    let best: {
      gain: number;
      out: Player;
      in: Player;
      court: number;
      slot: SlotIdx;
    } | null = null;
    for (let c = 0; c < courts; c++) {
      for (const s of [0, 1] as SlotIdx[]) {
        const slotId = s === 0 ? slots[c].playerAId : slots[c].playerBId;
        if (!slotId) continue;
        const out = playerById.get(slotId);
        if (!out) continue;
        for (const bp of benchPlayers) {
          const next = slots.map((p) => ({ ...p }));
          if (s === 0) next[c].playerAId = bp.id;
          else next[c].playerBId = bp.id;
          const sorted = sortByPoints(next, playerById);
          const newBal = calcBalance(sorted, playerById);
          if (newBal != null && newBal > currentBalance + 4) {
            const gain = newBal - currentBalance;
            if (!best || gain > best.gain) {
              best = {
                gain,
                out,
                in: bp,
                court: slots[c].court,
                slot: s,
              };
            }
          }
        }
      }
    }
    return best;
  }, [
    slots,
    benchPlayers,
    allOk,
    filledCount,
    balance,
    courts,
    playerById,
  ]);

  const applySuggestion = () => {
    if (!suggestion || !canEdit) return;
    const idx = slots.findIndex((s) => s.court === suggestion.court);
    if (idx === -1) return;
    const next = slots.map((p) => ({ ...p }));
    if (suggestion.slot === 0) next[idx].playerAId = suggestion.in.id;
    else next[idx].playerBId = suggestion.in.id;
    flashAvatar(suggestion.out.id, suggestion.in.id);
    commit(next);
    pulseAll();
    setAutoDelta(`+${suggestion.gain} equilibrio`);
    setTimeout(() => setAutoDelta(null), 2400);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!matchday) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('HomeRoot');
            }}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconBack size={16} color={Colors.text} />
            <Text style={styles.backLabel}>Atrás</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const teamPts = ptsArr.reduce((a, b) => a + b, 0);
  const maxPts = Math.max(...ptsArr.filter((v) => v > 0), 1);

  const hint = autoDelta
    ? `⚡ ${autoDelta}`
    : sel?.kind === 'slot'
    ? 'Toca otro jugador para intercambiar · o el banquillo'
    : sel?.kind === 'bench'
    ? `Toca un slot para colocar a ${
        findPlayer(sel.id)?.name.split(' ')[0] ?? '—'
      }`
    : closed
    ? 'Acta cerrada · solo lectura.'
    : seasonClosed
    ? 'Temporada archivada · alineación en solo lectura.'
    : !isCaptain
    ? 'Solo el capitán puede editar la alineación.'
    : autoSort
    ? 'Las parejas se ordenan por puntos automáticamente'
    : 'Toca un jugador para seleccionar';

  return (
    <Pressable
      onPress={() => setSel(null)}
      style={styles.root}
      android_disableSound
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('HomeRoot');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={Colors.text} />
          <Text style={styles.backLabel}>Jornada</Text>
        </Pressable>

        <View style={styles.headerRight}>
          {isCaptain ? (
            <>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleResetSlots();
                }}
                disabled={!canEdit || filledCount === 0}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.resetBtn,
                  (!canEdit || filledCount === 0) && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconTrash size={14} color={Colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setAutoSort((prev) => {
                    const next = !prev;
                    // Al activar, reordenamos las parejas existentes al instante
                    // para que el toggle se sienta inmediato y predecible.
                    if (next) {
                      const sorted = sortByPoints(slots, playerById);
                      setSlots(sorted);
                      void persistAll(sorted);
                      pulseAll();
                    }
                    return next;
                  });
                }}
                disabled={!canEdit}
                style={({ pressed }) => [
                  styles.autoSortBtn,
                  autoSort && styles.autoSortBtnOn,
                  pressed && { opacity: 0.85 },
                  !canEdit && { opacity: 0.5 },
                ]}
              >
            <IconBolt
              size={12}
              color={autoSort ? Colors.accent : Colors.textMuted}
            />
            <Text
              style={[
                styles.autoSortLabel,
                { color: autoSort ? Colors.accent : Colors.textMuted },
              ]}
            >
              Auto-orden {autoSort ? '· ON' : '· OFF'}
            </Text>
          </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={styles.titleSection}
      >
        <Text style={styles.eyebrow}>
          JORNADA · J·{String(matchday.jornada_number).padStart(2, '0')} · ALINEACIÓN
        </Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {filledCount}/{courts} parejas
          </Text>
          <View style={styles.dotsRow}>
            {validation.map((v, i) => {
              const color =
                v.state === 'ok'
                  ? Colors.accent
                  : v.state === 'warn'
                  ? Colors.warning
                  : v.state === 'err'
                  ? Colors.error
                  : Colors.hairStrong;
              return (
                <View key={i} style={[styles.dot, { backgroundColor: color }]} />
              );
            })}
          </View>
        </View>

        {balance != null ? (
          <View style={styles.balanceRow}>
            <View style={styles.balanceTrack}>
              <BalanceFill
                value={balance}
                color={
                  balance >= 80
                    ? Colors.accent
                    : balance >= 50
                    ? Colors.warning
                    : Colors.error
                }
              />
            </View>
            <Text
              style={[
                styles.balanceLabel,
                {
                  color: balance >= 80 ? Colors.accent : Colors.textMuted,
                },
              ]}
            >
              {balance}/100 EQUI.
            </Text>
          </View>
        ) : null}

        <Animated.Text
          key={hint}
          entering={FadeInUp.duration(200)}
          style={[
            styles.hintText,
            autoDelta != null && { color: Colors.accent, fontWeight: '600' },
          ]}
        >
          {hint}
        </Animated.Text>
      </Pressable>

      <View style={styles.variantStripContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.variantStrip}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {variants.map((v) => {
          const isCurrent = v.id === currentVariantId;
          const isActive = v.is_active;
          return (
            <Pressable
              key={v.id}
              onPress={() => setCurrentVariantId(v.id)}
              onLongPress={() => openVariantActions(v)}
              disabled={variantBusy}
              style={[
                styles.variantChip,
                isCurrent && styles.variantChipCurrent,
                isActive && styles.variantChipActive,
              ]}
            >
              {isActive ? (
                <Text style={styles.variantChipStar}>★</Text>
              ) : null}
              <Text
                style={[
                  styles.variantChipLabel,
                  isCurrent && { color: Colors.accent },
                ]}
                numberOfLines={1}
              >
                {v.label}
              </Text>
            </Pressable>
          );
        })}
        {variants.length < 5 && canEdit ? (
          <Pressable
            onPress={handleAddVariant}
            disabled={variantBusy}
            style={[styles.variantChipAdd, variantBusy && { opacity: 0.4 }]}
          >
            <Text style={styles.variantChipAddText}>+ NUEVA</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ gap: 8 }}
        >
          {canEdit ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleGenerate();
              }}
              style={({ pressed }) => [
                styles.generateBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <IconBolt size={14} color={Colors.accent} />
              <Text style={styles.generateLabel}>
                Generar alineación
              </Text>
              <Text style={styles.generateHint}>Drive + Revés · por fuerza</Text>
            </Pressable>
          ) : null}

          {slots.map((sl, ci) => {
            const v = validation[ci];
            const total = ptsArr[ci];
            const filled = filledLen(sl) === 2;
            const pulsing = pulseCourts.has(ci);
            const top = ci === 0 && filled && v.state !== 'err';
            return (
              <CourtRow
                key={sl.court}
                court={sl.court}
                p1={findPlayer(sl.playerAId)}
                p2={findPlayer(sl.playerBId)}
                total={total}
                maxPts={maxPts}
                filled={filled}
                validation={v}
                top={top}
                pulsing={pulsing}
                sel={sel}
                disabled={!canEdit}
                onSlotTap={(slot) => onSlotTap(sl.court, slot)}
                onSlotEmpty={(slot) => onSlotEmpty(sl.court, slot)}
                onRemove={(slot) => removeFromSlot(sl.court, slot)}
                isAnimating={(id) => swapAnimIds.has(id)}
              />
            );
          })}

          {canEdit && filledCount < courts ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                fillEmpty();
              }}
              style={({ pressed }) => [
                styles.fillEmptyBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconBolt size={12} color={Colors.accent} />
              <Text style={styles.fillEmptyLabel}>
                Completar con mejores del banquillo
              </Text>
            </Pressable>
          ) : null}
        </Pressable>
      </ScrollView>

      {suggestion && !sel && canEdit ? (
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={styles.suggestionWrap}
        >
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              applySuggestion();
            }}
            style={({ pressed }) => [
              styles.suggestionBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.suggestionIcon}>
              <IconBolt size={14} color={Colors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.suggestionEyebrow}>
                Sugerencia · +{suggestion.gain} equilibrio
              </Text>
              <Text style={styles.suggestionText} numberOfLines={1}>
                Cambia {suggestion.out.name.split(' ')[0]} ↔{' '}
                {suggestion.in.name.split(' ')[0]}
              </Text>
            </View>
            <View style={styles.suggestionApply}>
              <Text style={styles.suggestionApplyText}>APLICAR</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <BenchBar
        players={benchPlayers}
        sel={sel}
        teamPts={teamPts}
        onTap={onBenchTap}
        isAnimating={(id) => swapAnimIds.has(id)}
        disabled={!canEdit}
      />

      <View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 18) },
        ]}
      >
        <Pressable
          disabled={canEdit && filledCount < courts}
          // Read-only modes (acta cerrada O usuario no capitán): el botón
          // actúa como "Volver" sin paywall ni save.
          // Captain con acta abierta: gate envuelve la acción y dispara
          // paywall si no es premium.
          onPress={
            !canEdit
              ? () => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate('HomeRoot');
                }
              : gate(() => {
                  const back = () => {
                    if (navigation.canGoBack()) navigation.goBack();
                    else navigation.navigate('HomeRoot');
                  };
                  // Soft warning: si la federación exige orden y se incumple,
                  // pedimos confirmación pero permitimos guardar.
                  if (!allOk && mustOrder) {
                    Alert.alert(
                      'Orden de parejas',
                      'Las parejas no van en orden de fuerza decreciente. La federación puede rechazar el acta. ¿Guardar igualmente?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Guardar igual', style: 'destructive', onPress: back },
                      ],
                    );
                    return;
                  }
                  back();
                }, 'lineup_confirm')
          }
          style={({ pressed }) => [
            styles.cta,
            canEdit && filledCount < courts && styles.ctaDisabled,
            canEdit && !allOk && filledCount === courts && styles.ctaWarn,
            pressed && (!canEdit || filledCount === courts) && { opacity: 0.85 },
          ]}
        >
          {!canEdit ? (
            // Read-only (acta cerrada o no capitán): el botón siempre vuelve.
            <>
              <IconCheck size={15} color="#000" />
              <Text style={styles.ctaLabel}>Volver</Text>
            </>
          ) : filledCount < courts ? (
            <Text style={styles.ctaLabelDisabled}>
              Faltan {courts - filledCount}
            </Text>
          ) : !allOk ? (
            <>
              <IconAlert size={15} color="#1a0f00" />
              <Text style={styles.ctaLabelWarn}>Guardar con aviso</Text>
            </>
          ) : (
            <>
              <IconCheck size={15} color="#000" />
              <Text style={styles.ctaLabel}>Confirmar alineación</Text>
            </>
          )}
        </Pressable>
      </View>

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <Text style={styles.filterEyebrow}>GENERAR</Text>
        <Text style={styles.filterTitle}>Crear parejas</Text>
        <Text style={styles.filterLede}>
          Elige cómo formar las parejas. Puedes ajustarlo y volver a generar
          cuando quieras.
        </Text>

        <FilterRow
          label="Emparejar Drive + Revés"
          hint="Si lo desactivas, empareja solo por nivel"
          value={genOpts.usePosition}
          onChange={(v) => setGenOpts((o) => ({ ...o, usePosition: v }))}
        />
        <FilterRow
          label="Priorizar química"
          hint={
            pairStats && pairStats.size > 0
              ? 'Mantiene juntas las parejas que más ganan'
              : 'Aún no hay historial de jornadas cerradas'
          }
          value={genOpts.useChemistry}
          onChange={(v) => setGenOpts((o) => ({ ...o, useChemistry: v }))}
        />
        <FilterRow
          label="Pareja fuerte en la pista 1"
          hint="Pirámide. Desactiva para ponerla en la última pista"
          value={genOpts.strongestOnCourt1}
          onChange={(v) =>
            setGenOpts((o) => ({ ...o, strongestOnCourt1: v }))
          }
        />

        <Pressable
          onPress={runGenerate}
          style={({ pressed }) => [
            styles.filterCta,
            pressed && { opacity: 0.85 },
          ]}
        >
          <IconBolt size={15} color="#001810" />
          <Text style={styles.filterCtaText}>Generar alineación</Text>
        </Pressable>
      </BottomSheet>
    </Pressable>
  );
};

const FilterRow: React.FC<{
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, value, onChange }) => (
  <View style={styles.filterRow}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Text style={styles.filterHint}>{hint}</Text>
    </View>
    <Toggle value={value} onChange={onChange} />
  </View>
);

// ============= BALANCE FILL =============

const BalanceFill: React.FC<{ value: number; color: string }> = ({
  value,
  color,
}) => {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(value, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, w]);
  const aStyle = useAnimatedStyle(() => ({
    width: `${w.value}%`,
  }));
  return (
    <Animated.View
      style={[styles.balanceFill, { backgroundColor: color }, aStyle]}
    />
  );
};

// ============= COURT BAR =============

const CourtBarFill: React.FC<{ pct: number; color: string }> = ({
  pct,
  color,
}) => {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, w]);
  const aStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <Animated.View
      style={[styles.courtBarFill, { backgroundColor: color }, aStyle]}
    />
  );
};

// ============= AVATAR =============

const Avatar: React.FC<{
  initials: string;
  selected: boolean;
  animating: boolean;
  size?: number;
  fontSize?: number;
  photoUrl?: string | null;
}> = ({
  initials,
  selected,
  animating,
  size = 26,
  fontSize = 10,
  photoUrl,
}) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (animating) {
      scale.value = withSequence(
        withTiming(1.18, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );
      rotate.value = withSequence(
        withTiming(8, { duration: 200 }),
        withTiming(0, { duration: 200 }),
      );
    }
  }, [animating, scale, rotate]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  const bg = selected || animating ? Colors.accent : Colors.accent15;
  const fg = selected || animating ? '#000' : Colors.accent;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          overflow: 'hidden',
        },
        aStyle,
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize,
            fontWeight: '600',
            color: fg,
          }}
        >
          {initials}
        </Text>
      )}
    </Animated.View>
  );
};

// ============= COURT ROW =============

interface CourtRowProps {
  court: number;
  p1: Player | null;
  p2: Player | null;
  total: number;
  maxPts: number;
  filled: boolean;
  validation: Validation;
  top: boolean;
  pulsing: boolean;
  sel: Selection;
  disabled: boolean;
  onSlotTap: (slot: SlotIdx) => void;
  onSlotEmpty: (slot: SlotIdx) => void;
  onRemove: (slot: SlotIdx) => void;
  isAnimating: (id: string) => boolean;
}

const CourtRow: React.FC<CourtRowProps> = ({
  court,
  p1,
  p2,
  total,
  maxPts,
  filled,
  validation,
  top,
  pulsing,
  sel,
  disabled,
  onSlotTap,
  onSlotEmpty,
  onRemove,
  isAnimating,
}) => {
  const pctOfMax = maxPts ? Math.min(100, (total / maxPts) * 100) : 0;
  const tint =
    validation.state === 'err'
      ? Colors.error
      : validation.state === 'warn'
      ? Colors.warning
      : top
      ? Colors.accent
      : Colors.text;

  const errorMsg = validation.state === 'err' ? validation.msg : null;
  const ghostHint = sel != null;

  const borderColor =
    validation.state === 'err'
      ? 'rgba(255,107,107,0.6)'
      : pulsing
      ? Colors.accent
      : top
      ? Colors.accent40
      : Colors.hair;

  return (
    <View style={[styles.courtRow, { borderColor }]}>
      <View style={styles.courtHeader}>
        <View
          style={[
            styles.courtBadge,
            validation.state === 'err'
              ? { backgroundColor: 'rgba(255,107,107,0.15)' }
              : top
              ? { backgroundColor: Colors.accent15 }
              : null,
          ]}
        >
          <Text
            style={[
              styles.courtBadgeText,
              validation.state === 'err'
                ? { color: Colors.error }
                : top
                ? { color: Colors.accent }
                : null,
            ]}
          >
            P{court}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.courtBar}>
            <CourtBarFill pct={pctOfMax} color={tint} />
          </View>
          {top && validation.state !== 'err' ? (
            <Text style={styles.titularLabel}>PAREJA Nº1</Text>
          ) : null}
          {errorMsg ? (
            <Animated.Text
              entering={FadeInUp.duration(200)}
              style={styles.errorMsg}
            >
              {errorMsg}
            </Animated.Text>
          ) : null}
        </View>

        <Animated.View
          key={`pts-${total}`}
          entering={FadeInDown.duration(240)}
          style={styles.totalWrap}
        >
          <Text style={[styles.totalValue, { color: tint }]}>
            {filled ? total : '—'}
          </Text>
          <Text style={styles.totalLabel}>PTS</Text>
        </Animated.View>
      </View>

      <View style={styles.slotsRow}>
        <SlotTile
          player={p1}
          selected={
            sel?.kind === 'slot' && sel.court === court && sel.slot === 0
          }
          error={validation.state === 'err'}
          ghost={ghostHint && !p1}
          disabled={disabled}
          onTap={() => (p1 ? onSlotTap(0) : onSlotEmpty(0))}
          onLongPress={p1 ? () => onRemove(0) : undefined}
          animating={p1 ? isAnimating(p1.id) : false}
        />
        <SlotTile
          player={p2}
          selected={
            sel?.kind === 'slot' && sel.court === court && sel.slot === 1
          }
          error={validation.state === 'err'}
          ghost={ghostHint && !p2}
          disabled={disabled}
          onTap={() => (p2 ? onSlotTap(1) : onSlotEmpty(1))}
          onLongPress={p2 ? () => onRemove(1) : undefined}
          animating={p2 ? isAnimating(p2.id) : false}
        />
      </View>
    </View>
  );
};

// ============= SLOT TILE =============

interface SlotTileProps {
  player: Player | null;
  selected: boolean;
  error: boolean;
  ghost: boolean;
  disabled: boolean;
  animating: boolean;
  onTap: () => void;
  onLongPress?: () => void;
}

const SlotTile: React.FC<SlotTileProps> = ({
  player,
  selected,
  error,
  ghost,
  disabled,
  animating,
  onTap,
  onLongPress,
}) => {
  if (!player) {
    return (
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          if (disabled) return;
          onTap();
        }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.slotEmpty,
          ghost && styles.slotEmptyGhost,
          pressed && { transform: [{ scale: 0.97 }] },
          disabled && { opacity: 0.6 },
        ]}
      >
        {ghost ? (
          <Text style={styles.slotEmptyGhostText}>↓ Colocar aquí</Text>
        ) : (
          <>
            <IconPlus size={12} color={Colors.textFaint} />
            <Text style={styles.slotEmptyText}>Vacío</Text>
          </>
        )}
      </Pressable>
    );
  }

  const initials = initialsOf(player);

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onTap();
      }}
      onLongPress={() => {
        if (disabled || !onLongPress) return;
        onLongPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.slotTile,
        selected && styles.slotTileSelected,
        error && !selected && styles.slotTileError,
        pressed && { transform: [{ scale: 0.97 }] },
        disabled && { opacity: 0.7 },
      ]}
    >
      <Avatar
        initials={initials}
        selected={selected}
        animating={animating}
        photoUrl={photoOf(player)}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.slotName} numberOfLines={1}>
          {shortName(player)}
        </Text>
        <Text style={styles.slotMeta}>
          {player.position} · <Text style={styles.slotPts}>{player.pts}</Text>
        </Text>
      </View>
      {selected && onLongPress ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onLongPress();
          }}
          hitSlop={8}
          style={styles.removeChip}
        >
          <IconTrash size={12} color={Colors.error} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

// ============= BENCH BAR =============

interface BenchBarProps {
  players: Player[];
  sel: Selection;
  teamPts: number;
  onTap: (id: string) => void;
  isAnimating: (id: string) => boolean;
  disabled: boolean;
}

const BenchBar: React.FC<BenchBarProps> = ({
  players,
  sel,
  teamPts,
  onTap,
  isAnimating,
  disabled,
}) => {
  const slotSelected = sel?.kind === 'slot';
  return (
    <Pressable
      onPress={(e) => e.stopPropagation()}
      style={[
        styles.benchBar,
        slotSelected && {
          borderTopColor: 'rgba(0,223,130,0.4)',
          backgroundColor: Colors.accent10,
        },
      ]}
    >
      <View style={styles.benchHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={[
              styles.benchEyebrow,
              slotSelected && { color: Colors.accent },
            ]}
          >
            BANQUILLO · {players.length}
          </Text>
          {slotSelected ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={styles.benchHint}
            >
              <Text style={styles.benchHintText}>↓ TOCA UNO</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text style={styles.benchTeamPts}>
          Σ EQUIPO <Text style={{ color: Colors.text }}>{teamPts}</Text>
        </Text>
      </View>

      {players.length === 0 ? (
        <Text style={styles.benchEmpty}>
          Todos los jugadores disponibles están alineados
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.benchScroll}
        >
          {players.map((p) => (
            <BenchChip
              key={p.id}
              player={p}
              selected={sel?.kind === 'bench' && sel.id === p.id}
              dimmed={
                sel != null && !(sel.kind === 'bench' && sel.id === p.id)
              }
              animating={isAnimating(p.id)}
              disabled={disabled}
              onTap={() => onTap(p.id)}
            />
          ))}
        </ScrollView>
      )}
    </Pressable>
  );
};

interface BenchChipProps {
  player: Player;
  selected: boolean;
  dimmed: boolean;
  animating: boolean;
  disabled: boolean;
  onTap: () => void;
}

const BenchChip: React.FC<BenchChipProps> = ({
  player,
  selected,
  dimmed,
  animating,
  disabled,
  onTap,
}) => {
  const initials = initialsOf(player);
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onTap();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.benchChip,
        selected && styles.benchChipSelected,
        dimmed && !selected && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.96 }] },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Avatar
        initials={initials}
        selected={selected}
        animating={animating}
        size={26}
        fontSize={10}
        photoUrl={photoOf(player)}
      />
      <View>
        <Text style={styles.benchChipName} numberOfLines={1}>
          {shortName(player)}
        </Text>
        <Text style={styles.benchChipMeta}>
          {player.position} · {player.pts}
        </Text>
      </View>
    </Pressable>
  );
};

// ============= STYLES =============

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
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
  backLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoSortBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoSortBtnOn: {
    borderColor: Colors.accent50,
    backgroundColor: Colors.accent10,
  },
  autoSortLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '500',
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  balanceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.hair,
    overflow: 'hidden',
  },
  balanceFill: { height: '100%' },
  balanceLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    minWidth: 64,
    textAlign: 'right',
  },
  hintText: {
    marginTop: 6,
    minHeight: 16,
    fontSize: 11,
    color: Colors.textMuted,
  },
  variantStripContainer: {
    height: 52,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  variantStrip: {
    paddingHorizontal: 20,
    gap: 6,
    alignItems: 'center',
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  variantChipCurrent: {
    borderColor: Colors.accent50,
    backgroundColor: Colors.accent10,
  },
  variantChipActive: {
    borderColor: Colors.accent,
  },
  variantChipStar: {
    color: Colors.accent,
    fontSize: 12,
    lineHeight: 14,
  },
  variantChipLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.textMuted,
  },
  variantChipAdd: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantChipAddText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.textFaint,
  },
  ruleBanner: {
    marginHorizontal: 20,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  ruleBannerStrict: {
    backgroundColor: Colors.accent10,
    borderColor: Colors.accent40,
  },
  ruleBannerLoose: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.hair,
  },
  ruleBannerText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  courtRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  courtHeader: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  courtBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  courtBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.hair,
    overflow: 'hidden',
  },
  courtBarFill: { height: '100%' },
  titularLabel: {
    fontSize: 9,
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  errorMsg: {
    fontSize: 10,
    color: Colors.error,
    fontFamily: Fonts.mono,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  totalWrap: { minWidth: 50, alignItems: 'flex-end' },
  totalValue: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.6,
    lineHeight: 22,
  },
  totalLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.textFaint,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  slotsRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    gap: 6,
  },
  slotEmpty: {
    flex: 1,
    height: 52,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  slotEmptyGhost: {
    borderColor: 'rgba(0,223,130,0.6)',
    backgroundColor: Colors.accent10,
  },
  slotEmptyText: { color: Colors.textFaint, fontSize: 12, fontWeight: '500' },
  slotEmptyGhostText: { color: Colors.accent, fontSize: 12, fontWeight: '500' },
  slotTile: {
    flex: 1,
    height: 52,
    borderRadius: 11,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  slotTileSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent10,
  },
  slotTileError: {
    borderColor: 'rgba(255,107,107,0.4)',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  slotName: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: Colors.text,
    lineHeight: 15,
  },
  slotMeta: {
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 0.5,
    marginTop: 2,
    fontFamily: Fonts.mono,
  },
  slotPts: { color: Colors.textMuted },
  removeChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,107,107,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillEmptyBtn: {
    marginTop: 4,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent50,
    backgroundColor: Colors.accent10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fillEmptyLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
  generateBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent50,
    backgroundColor: Colors.accent15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateLabel: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  generateHint: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    opacity: 0.7,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  filterEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  filterTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  filterLede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  filterLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  filterHint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  filterCta: {
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  filterCtaText: {
    color: '#001810',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  suggestionWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  suggestionBtn: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.accent15,
    borderWidth: 1,
    borderColor: Colors.accent40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.accent25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionEyebrow: {
    fontSize: 11,
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: Colors.text,
  },
  suggestionApply: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.accent15,
    borderRadius: 6,
  },
  suggestionApplyText: {
    fontSize: 11,
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontWeight: '600',
    letterSpacing: 1,
  },
  benchBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
    backgroundColor: Colors.bgCard,
    paddingTop: 6,
    paddingBottom: 4,
  },
  benchHeader: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  benchEyebrow: {
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.6,
    fontFamily: Fonts.mono,
    fontWeight: '500',
  },
  benchHint: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,223,130,0.18)',
  },
  benchHintText: {
    fontSize: 10,
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontWeight: '600',
    letterSpacing: 1,
  },
  benchTeamPts: {
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.2,
    fontFamily: Fonts.mono,
    fontWeight: '500',
  },
  benchEmpty: {
    paddingHorizontal: 18,
    paddingTop: 4,
    fontSize: 12,
    color: Colors.textFaint,
  },
  benchScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  benchChip: {
    height: 44,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benchChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent10,
  },
  benchChipName: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: Colors.text,
    lineHeight: 14,
  },
  benchChipMeta: {
    fontSize: 10,
    color: Colors.textFaint,
    fontFamily: Fonts.mono,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ctaWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaDisabled: {
    backgroundColor: Colors.bgCard,
    shadowOpacity: 0,
  },
  ctaWarn: {
    backgroundColor: Colors.warning,
    shadowColor: Colors.warning,
  },
  ctaLabel: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  ctaLabelWarn: {
    color: '#1a0f00',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  ctaLabelDisabled: {
    color: Colors.textFaint,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
