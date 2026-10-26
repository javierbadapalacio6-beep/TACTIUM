import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import {
  clubInviteMessage,
  createClubInvitation,
  listClubManagers,
  removeClubManager,
  type ClubManager,
} from '@core/services/clubManagers';
import { toast } from '@store/toastStore';

/**
 * Gestores del club. El dueño y los gestores que invita pueden hacer lo mismo (equipos, horarios, torneos…); el
 * dueño no se puede quitar y solo él borra el club. Se invita con un código de un solo uso, 7 días.
 */
export const ClubManagersCard: React.FC<{ clubId: string; clubName: string; myUserId: string | null }> = ({
  clubId,
  clubName,
  myUserId,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [list, setList] = useState<ClubManager[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await listClubManagers(clubId));
    } catch {
      setList(null);
    }
  }, [clubId]);
  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const inv = await createClubInvitation(clubId);
      await Share.share({ message: clubInviteMessage(clubName, inv.code) });
    } catch (e) {
      toast.error('No se pudo crear la invitación', (e as Error)?.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (m: ClubManager) =>
    Alert.alert(
      m.user_id === myUserId ? '¿Dejar de gestionar el club?' : `¿Quitar a ${m.full_name ?? 'este gestor'}?`,
      'Dejará de poder gestionar el club y de ser capitán de sus equipos. Se puede volver a invitar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeClubManager(clubId, m.user_id);
              await load();
            } catch (e) {
              toast.error('No se pudo quitar', (e as Error)?.message);
            }
          },
        },
      ],
    );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>GESTORES DEL CLUB</Text>
      <Text style={styles.hint}>
        Invita a otra persona a gestionar el club contigo. Puede hacer lo mismo que tú, salvo borrar el club.
      </Text>
      {list === null ? (
        <ActivityIndicator color={c.accent} style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.list}>
          {list.map((m) => (
            <View key={m.user_id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.full_name ?? m.email ?? 'Gestor'}
                  {m.user_id === myUserId ? ' (tú)' : ''}
                </Text>
                {m.email && m.full_name ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {m.email}
                  </Text>
                ) : null}
              </View>
              {m.is_owner ? (
                <Text style={styles.tag}>DUEÑO</Text>
              ) : (
                <Pressable onPress={() => remove(m)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.remove}>{m.user_id === myUserId ? 'Salir' : 'Quitar'}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      <Pressable
        onPress={invite}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.8 }]}
      >
        {busy ? <ActivityIndicator color={c.accent} /> : <Text style={styles.btnText}>Invitar a un gestor</Text>}
      </Pressable>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 28 },
    label: { color: c.accent, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 6 },
    hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
    list: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      paddingHorizontal: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    name: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    meta: { color: c.textMuted, fontSize: 12.5, marginTop: 1 },
    tag: { color: c.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    remove: { color: c.error, fontSize: 13, fontWeight: '600' },
    btn: {
      marginTop: 10,
      height: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: c.accent, fontSize: 14.5, fontWeight: '700' },
  });
