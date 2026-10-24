import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { IconCheck, IconClock } from '@components/ui/Icon';
import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import {
  fetchFcpUpload,
  fetchLineupUpload,
  setFcpUploaded,
  setLineupUploaded,
  type FcpUploadState,
} from '@core/services/fcpUpload';
import { toast } from '@store/toastStore';

const pad = (n: number) => String(n).padStart(2, '0');
const whenLabel = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)} a las ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * «Subido a la Federación». La hora del partido de local la sube a la web de la Federación el capitán, antes del
 * lunes a las 20:00. Aquí se marca: queda anotado, deja de salir en los recordatorios del lunes y se avisa al club.
 * Solo para partidos de local de la Federación Cántabra por jugar.
 */
export const FederationUploadCard: React.FC<{
  matchdayId: string;
  canManage: boolean;
  /** 'schedule' = la hora (partidos de local); 'lineup' = la alineación (todos, antes del partido). */
  kind?: 'schedule' | 'lineup';
}> = ({ matchdayId, canManage, kind = 'schedule' }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState<FcpUploadState | null>(null);
  const [busy, setBusy] = useState(false);
  const lineup = kind === 'lineup';

  const load = useCallback(async () => {
    try {
      setState(await (lineup ? fetchLineupUpload(matchdayId) : fetchFcpUpload(matchdayId)));
    } catch {
      setState(null);
    }
  }, [matchdayId, lineup]);
  useEffect(() => {
    load();
  }, [load]);

  if (!state) return null;
  const done = !!state.uploadedAt;
  // Un jugador sin gestión solo ve el estado cuando ya está subido.
  if (!done && !canManage) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (lineup) await setLineupUploaded(matchdayId, !done);
      else await setFcpUploaded([matchdayId], !done);
      await load();
      if (!done)
        toast.success(
          lineup ? 'Alineación marcada como subida' : 'Marcado como subido',
          lineup
            ? 'Dejaremos de recordártelo y hemos avisado al club.'
            : 'Hemos avisado al club y a los capitanes.',
        );
    } catch (e) {
      toast.error('No se pudo guardar', (e as Error)?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.head}>
        <View style={[styles.icon, done && { backgroundColor: c.accent }]}>
          {done ? <IconCheck size={13} color={c.textInverse} /> : <IconClock size={14} color={c.accent} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>
            {lineup
              ? done
                ? 'Alineación subida a la Federación'
                : '¿Ya subiste la alineación?'
              : done
                ? 'Subido a la Federación'
                : '¿Ya está en la Federación?'}
          </Text>
          <Text style={styles.sub}>
            {done
              ? `Marcado el ${whenLabel(state.uploadedAt!)}.`
              : lineup
                ? 'La alineación se sube a la web de la Federación antes del partido. Te avisaremos 24 h, 3 h y 1 h antes hasta que la marques como subida.'
                : 'La hora de los partidos de local se sube a la web de la Federación antes del lunes a las 20:00. Cuando la subas, márcalo y avisamos al club.'}
          </Text>
        </View>
      </View>
      {canManage ? (
        <Pressable
          onPress={toggle}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [done ? styles.quiet : styles.primary, (pressed || busy) && { opacity: 0.8 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={done ? c.textMuted : c.accent} />
          ) : (
            <Text style={done ? styles.quietText : styles.primaryText}>
              {done ? 'Quitar la marca' : 'Marcar como subido'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      marginBottom: 12,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      gap: 12,
    },
    cardDone: { borderColor: c.accent40 },
    head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    icon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
    },
    title: { color: c.text, fontSize: 15, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    // Acción secundaria (contorno): el botón sólido de la pantalla es «Crear alineación».
    primary: {
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: c.accent, fontSize: 14.5, fontWeight: '700' },
    quiet: {
      height: 38,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quietText: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
  });
