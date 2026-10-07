import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconCheck, IconArrowRight } from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import * as PlayersApi from '@core/services/players';
import { useAuthStore } from '@store/authStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { useTeamStore } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { toast } from '@store/toastStore';

// Vista previa de una invitación + unirse. La comparten el sheet «Únete a tu
// equipo» (código tecleado) y la pantalla `JoinTeam` (enlace tactium.io/i/…).
//
// Flujo de unirse: redeem_team_invitation → (si eligió ficha) claim_player →
// recarga clubs + equipos → activa el equipo nuevo → finishOnboarding.

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  // 'YYYY-MM-DD' → fecha local sin desfase de zona.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Normaliza un nombre para compararlo (sin tildes, minúsculas, espacios). */
function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type ValidPreview = Extract<InvitationsApi.InvitationPreview, { valid: true }>;

/** Valor del selector de ficha: id de jugador, 'none' (no estoy) o null. */
type PickValue = string | 'none' | null;

export const JoinTeamPreview: React.FC<{
  /** Código ya completo (8 caracteres). */
  code: string;
  /** Tras unirse con éxito. */
  onJoined?: (teamId: string) => void;
  /** Sin sesión: el botón pasa a «Entrar para unirme». */
  onLoginRequired?: () => void;
  /** Ya es miembro: botón «Ir a mi equipo». */
  onGoToTeam?: (teamId: string) => void;
}> = ({ code, onJoined, onLoginRequired, onGoToTeam }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const teams = useTeamStore((s) => s.teams);
  const loadTeam = useTeamStore((s) => s.loadForUser);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const refreshMyPlayer = useTeamStore((s) => s.refreshMyPlayer);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);
  const loadClubs = useClubStore((s) => s.loadForUser);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationsApi.InvitationPreview | null>(null);
  const [pick, setPick] = useState<PickValue>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPreview(null);
    setPick(null);
    try {
      const p = await InvitationsApi.previewInvitation(code);
      setPreview(p);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Sin conexión');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const valid: ValidPreview | null = preview && preview.valid ? preview : null;
  const freeSlots = useMemo(
    () =>
      valid && valid.role === 'player'
        ? (valid.roster ?? []).filter((r) => !r.claimed)
        : [],
    [valid],
  );

  // Preselección: la ficha cuyo nombre normalizado coincide con el del usuario.
  useEffect(() => {
    if (!valid || valid.role !== 'player' || pick !== null) return;
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const myName = normalizeForMatch(
      (meta.full_name as string) || (meta.name as string) || '',
    );
    if (!myName) return;
    const hit = freeSlots.find((r) => normalizeForMatch(r.name) === myName);
    if (hit) setPick(hit.id);
  }, [valid, freeSlots, user, pick]);

  const alreadyMember = !!valid && teams.some((t) => t.id === valid.team.id);

  const handleJoin = async () => {
    if (!valid || joining) return;
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    setJoining(true);
    const teamId = valid.team.id;
    try {
      await InvitationsApi.redeemInvitation(code);
    } catch (e: any) {
      setJoining(false);
      toast.error('No se pudo unir al equipo', e?.message ?? 'Inténtalo de nuevo.');
      return;
    }

    // Vincular con la ficha elegida. No es fatal: ya está dentro del equipo.
    let claimWarning: string | null = null;
    if (pick && pick !== 'none') {
      try {
        await PlayersApi.claimPlayer(pick);
      } catch (e: any) {
        const msg = String(e?.message ?? '').toLowerCase();
        // «Ya estás vinculado» (p. ej. el canje te vinculó por nombre): bien.
        const alreadyLinked = msg.includes('vinculad') || msg.includes('already');
        if (!alreadyLinked) {
          claimWarning =
            'No pudimos vincularte a esa ficha. Elige tu nombre desde Ajustes o pide al capitán que te añada.';
        }
      }
    }

    try {
      // Clubs primero (teamStore los lee), luego equipos.
      await loadClubs();
      await loadTeam();
      const loaded = useTeamStore.getState().teams;
      if (loaded.some((t) => t.id === teamId)) {
        await setActiveTeam(teamId).catch(() => {});
      }
      await refreshMyPlayer().catch(() => {});
      // Si entra como capitana en un equipo ya cubierto por el plan de otra
      // capitana, que no vea ningún paywall desde el primer momento.
      await useSubscriptionStore.getState().refreshTeamCoverage(teamId);
    } catch (e) {
      console.warn('JoinTeamPreview: recarga tras unirse', e);
    }
    finishOnboarding();
    setJoining(false);

    toast.success(
      `¡Ya estás en ${valid.team.name}!`,
      'Marca tu disponibilidad para la próxima jornada cuando puedas.',
    );
    if (claimWarning) {
      setTimeout(() => toast.warn('Falta elegir tu ficha', claimWarning ?? ''), 1200);
    }
    onJoined?.(teamId);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={c.accent} />
        <Text style={styles.loaderText}>Buscando la invitación…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>No pudimos comprobar el código</Text>
        <Text style={styles.errorBody}>Revisa tu conexión e inténtalo otra vez.</Text>
        <Pressable onPress={load} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.retryLabel}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (preview && !preview.valid) {
    const msg = InvitationsApi.invalidInvitationMessage(preview.reason);
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>{msg.title}</Text>
        <Text style={styles.errorBody}>{msg.body}</Text>
      </View>
    );
  }

  if (!valid) return null;

  const t = valid.team;
  const metaParts = [
    t.category,
    t.league,
    valid.captain_name ? `capitán: ${valid.captain_name}` : null,
  ].filter((x): x is string => !!x && x.trim().length > 0);
  const nm = valid.next_matchday;
  const nextLabel = nm
    ? [nm.jornada != null ? `J${nm.jornada}` : null, formatShortDate(nm.date)]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>TE HAN INVITADO A</Text>
        <View style={styles.teamRow}>
          {t.logo_url ? (
            <Image source={{ uri: t.logo_url }} style={styles.crest} />
          ) : (
            <View style={[styles.crest, styles.crestFallback]}>
              <Text style={styles.crestText}>{initialsOf(t.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.teamName} numberOfLines={2}>
              {t.name}
            </Text>
            {metaParts.length > 0 ? (
              <Text style={styles.teamMeta} numberOfLines={2}>
                {metaParts.join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {valid.players_count} {valid.players_count === 1 ? 'jugador' : 'jugadores'}
            </Text>
          </View>
          {nextLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Próxima: {nextLabel}</Text>
            </View>
          ) : null}
          {valid.role === 'captain' ? (
            <View style={[styles.chip, styles.chipAccent]}>
              <Text style={[styles.chipText, { color: c.accent }]}>Como capitán</Text>
            </View>
          ) : null}
        </View>
      </View>

      {alreadyMember ? (
        <>
          <View style={styles.memberNote}>
            <IconCheck size={14} color={c.accent} />
            <Text style={styles.memberNoteText}>Ya estás en este equipo</Text>
          </View>
          <Pressable
            onPress={() => onGoToTeam?.(t.id)}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaLabel}>Ir a mi equipo</Text>
            <IconArrowRight size={16} color={c.textInverse} />
          </Pressable>
        </>
      ) : (
        <>
          {valid.role === 'player' && isAuthenticated ? (
            <>
              <Text style={styles.groupLabel}>¿QUIÉN ERES DE LA PLANTILLA?</Text>
              <View style={styles.list}>
                {freeSlots.map((r, i) => (
                  <RadioRow
                    key={r.id}
                    label={r.name}
                    meta={[r.position, r.pts != null ? `${r.pts} pts` : null]
                      .filter(Boolean)
                      .join(' · ')}
                    selected={pick === r.id}
                    onPress={() => setPick(r.id)}
                    divider={i > 0}
                    styles={styles}
                  />
                ))}
                <RadioRow
                  label="No estoy en la lista"
                  meta="El capitán te añadirá"
                  selected={pick === 'none'}
                  onPress={() => setPick('none')}
                  divider={freeSlots.length > 0}
                  styles={styles}
                />
              </View>
            </>
          ) : null}

          <Pressable
            onPress={handleJoin}
            disabled={joining}
            style={({ pressed }) => [
              styles.cta,
              joining && { opacity: 0.5 },
              pressed && !joining && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
          >
            {joining ? (
              <ActivityIndicator color={c.textInverse} />
            ) : (
              <Text style={styles.ctaLabel}>
                {isAuthenticated ? 'Unirme al equipo' : 'Entrar para unirme'}
              </Text>
            )}
          </Pressable>
          {!isAuthenticated ? (
            <Text style={styles.hint}>
              Entra o crea tu cuenta y te llevamos de vuelta aquí.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const RadioRow: React.FC<{
  label: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
  divider: boolean;
  styles: ReturnType<typeof makeStyles>;
}> = ({ label, meta, selected, onPress, divider, styles }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    style={({ pressed }) => [
      styles.radioRow,
      divider && styles.radioDivider,
      pressed && { opacity: 0.8 },
    ]}
  >
    <View style={[styles.radio, selected && styles.radioOn]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.radioLabel} numberOfLines={1}>
        {label}
      </Text>
      {meta ? (
        <Text style={styles.radioMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  </Pressable>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    loader: { paddingVertical: 28, alignItems: 'center', gap: 10 },
    loaderText: { color: c.textMuted, fontSize: 13 },
    errorCard: {
      padding: 16,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.error,
      backgroundColor: c.bgCard,
      gap: 4,
    },
    errorTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    errorBody: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    retryBtn: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    retryLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
    card: {
      padding: 16,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.bgCard,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: '600',
      marginBottom: 12,
    },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    crest: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.bgRaised },
    crestFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.accent50,
    },
    crestText: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 1,
    },
    teamName: { color: c.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
    teamMeta: { color: c.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hair,
    },
    chipAccent: { borderColor: c.accent40, backgroundColor: c.accent10 },
    chipText: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 11,
      letterSpacing: 0.3,
    },
    groupLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '600',
      marginTop: 18,
      marginBottom: 8,
    },
    list: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
      overflow: 'hidden',
    },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    radioDivider: { borderTopWidth: 1, borderTopColor: c.hair },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: c.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    radioLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    radioMeta: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      marginTop: 2,
      letterSpacing: 0.4,
    },
    memberNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
    },
    memberNoteText: { color: c.text, fontSize: 14, fontWeight: '600' },
    cta: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    ctaLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    hint: {
      color: c.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
    },
  });
