import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import * as InvitationsApi from '@core/services/invitations';
import {
  previewClubInvitation,
  redeemClubInvitation,
  type ClubInvitationPreview,
} from '@core/services/clubManagers';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';

import { JoinTeamPreview } from './JoinTeamPreview';

type Props = React.ComponentProps<typeof JoinTeamPreview>;

/**
 * Vista previa de un código de invitación. Sirve para los dos tipos: el de EQUIPO (capitán o jugador, de siempre) y
 * el de GESTOR DE CLUB. Mira primero si es de equipo; si no lo es, prueba el de club. Para un código de equipo,
 * o uno que no existe, todo sigue igual que antes (`JoinTeamPreview` pinta su propio resultado o error).
 */
export const InvitationPreview: React.FC<Props> = (props) => {
  const [club, setClub] = useState<Extract<ClubInvitationPreview, { valid: true }> | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    setChecked(false);
    setClub(null);
    (async () => {
      try {
        const team = await InvitationsApi.previewInvitation(props.code);
        if (team.valid) return;
        const cl = await previewClubInvitation(props.code);
        if (alive && cl.valid) setClub(cl);
      } catch {
        // Sin conexión u otro fallo: se deja a JoinTeamPreview, que enseña su error y deja reintentar.
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.code]);

  if (!checked) return <ClubChecking />;
  if (club) return <JoinClubPreview code={props.code} preview={club} onJoined={props.onJoined} onLoginRequired={props.onLoginRequired} />;
  return <JoinTeamPreview {...props} />;
};

const ClubChecking: React.FC = () => {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
      <ActivityIndicator color={c.accent} />
      <Text style={{ color: c.textMuted, fontSize: 13 }}>Buscando la invitación…</Text>
    </View>
  );
};

const JoinClubPreview: React.FC<{
  code: string;
  preview: Extract<ClubInvitationPreview, { valid: true }>;
  onJoined?: (teamId: string) => void;
  onLoginRequired?: () => void;
}> = ({ code, preview, onJoined, onLoginRequired }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadClubs = useClubStore((s) => s.loadForUser);
  const loadTeam = useTeamStore((s) => s.loadForUser);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);
  const [joining, setJoining] = useState(false);

  const join = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    setJoining(true);
    try {
      await redeemClubInvitation(code);
    } catch (e) {
      setJoining(false);
      toast.error('No se pudo aceptar', (e as Error)?.message ?? 'Inténtalo de nuevo.');
      return;
    }
    try {
      // Clubs primero (el equipo activo se calcula con ellos), luego equipos.
      await loadClubs();
      await loadTeam();
    } catch (e) {
      console.warn('InvitationPreview: recarga tras aceptar', e);
    }
    finishOnboarding();
    setJoining(false);
    toast.success(`¡Ya gestionas ${preview.club.name}!`, 'Tienes acceso a sus equipos, horarios y torneos.');
    onJoined?.('');
  };

  return (
    <View style={styles.card}>
      {preview.club.logo_url ? (
        <Image source={{ uri: preview.club.logo_url }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Text style={styles.logoLetter}>{preview.club.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.eyebrow}>INVITACIÓN DE GESTOR</Text>
      <Text style={styles.title}>{preview.club.name}</Text>
      <Text style={styles.body}>
        {preview.invited_by ? `${preview.invited_by} te invita` : 'Te invitan'} a gestionar el club contigo:
        {preview.teams_count > 0 ? ` ${preview.teams_count} equipos,` : ''} horarios de local, torneos y todo lo que
        puede hacer el dueño, salvo borrar el club.
      </Text>
      <Pressable
        onPress={join}
        disabled={joining}
        accessibilityRole="button"
        style={({ pressed }) => [styles.btn, (pressed || joining) && { opacity: 0.85 }]}
      >
        {joining ? (
          <ActivityIndicator color={c.textInverse} />
        ) : (
          <Text style={styles.btnText}>{isAuthenticated ? 'Aceptar y gestionar el club' : 'Entrar para aceptar'}</Text>
        )}
      </Pressable>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      padding: 18,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      gap: 6,
    },
    logo: { width: 64, height: 64, borderRadius: 16, marginBottom: 6 },
    logoFallback: { backgroundColor: c.accent10, alignItems: 'center', justifyContent: 'center' },
    logoLetter: { color: c.accent, fontSize: 28, fontWeight: '800' },
    eyebrow: { color: c.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
    body: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 4 },
    btn: {
      marginTop: 12,
      alignSelf: 'stretch',
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
  });
