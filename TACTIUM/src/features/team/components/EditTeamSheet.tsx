import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheet, IconChevron, Toggle } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { TeamCrest } from '@features/team/components/TeamCrest';
import {
  removeTeamLogo,
  teamLogoOf,
  uploadTeamLogo,
} from '@features/team/teamData';
import { toast } from '@store/toastStore';
import { PreferredSlotsEditor } from '@features/team/components/PreferredSlotsEditor';
import {
  teamVenueClubId,
  fetchClubName,
  clearTeamVenue,
} from '@core/services/teams';

// Mismas opciones que el formulario de creación (CreateTeamScreen) para que la
// edición sea coherente con el alta.
const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Franjas favoritas del equipo (el campo aún no está en los tipos generados).
const teamSlotsOf = (t: unknown): string[] =>
  (t as { preferred_home_slots?: string[] })?.preferred_home_slots ?? [];

export const EditTeamSheet: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((s) => s.team);
  const updateTeamSettings = useTeamStore((s) => s.updateTeamSettings);
  const deleteTeam = useTeamStore((s) => s.deleteTeam);
  const loadForUser = useTeamStore((s) => s.loadForUser);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // Borrar desde la app (decisión 3): solo el DUEÑO y solo si el equipo no es
  // de un club; los de un club los borra el club. La RPC `delete_team` ya
  // exige ser el propietario.
  const canDelete =
    !!team && !team.club_id && !!userId && team.owner_id === userId;
  const [logoBusy, setLogoBusy] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const logo = teamLogoOf(team);

  const pickLogo = async () => {
    if (!team || logoBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setLogoBusy(true);
    try {
      await uploadTeamLogo(team.id, res.assets[0].uri);
      await loadForUser();
      toast.success('Escudo actualizado');
    } catch (e: any) {
      toast.error('No se pudo subir el escudo', e?.message ?? '');
    } finally {
      setLogoBusy(false);
    }
  };

  const onLogoPress = () => {
    if (!team) return;
    if (!logo) {
      void pickLogo();
      return;
    }
    Alert.alert('Escudo del equipo', undefined, [
      { text: 'Cambiar escudo', onPress: () => void pickLogo() },
      {
        text: 'Quitar escudo',
        style: 'destructive',
        onPress: async () => {
          setLogoBusy(true);
          try {
            await removeTeamLogo(team.id);
            await loadForUser();
          } catch (e: any) {
            toast.error('No se pudo quitar', e?.message ?? '');
          } finally {
            setLogoBusy(false);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const confirmDelete = () => {
    if (!team) return;
    Alert.alert(
      'Borrar el equipo',
      `Se borra «${team.name}» con su plantilla, temporadas, jornadas y resultados. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTeam(team.id);
              toast.success('Equipo borrado', team.name);
              onClose();
            } catch (e: any) {
              toast.error('No se pudo borrar', e?.message ?? '');
            }
          },
        },
      ],
    );
  };

  const [cat, setCat] = useState(team?.category ?? '2ª');
  const [hasGroup, setHasGroup] = useState(!!team?.group_name);
  const [group, setGroup] = useState(team?.group_name ?? 'A');
  const [saving, setSaving] = useState(false);
  // Club SEDE: pone los horarios de local de este equipo sin ser su club. El
  // capitán puede echarlo cuando quiera (así se pactó: vínculo directo y
  // revocable, en vez de pedir permiso previo a alguien que aún no existe).
  const venueId = teamVenueClubId(team);
  const [venueName, setVenueName] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !venueId) {
      setVenueName(null);
      return;
    }
    let alive = true;
    fetchClubName(venueId)
      .then((n) => alive && setVenueName(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, venueId]);

  const removeVenue = () => {
    if (!team || !venueId) return;
    Alert.alert(
      'Quitar la gestión de horarios',
      `${venueName ?? 'El club'} dejará de poder poner la hora de tus partidos de local. Los horarios ya puestos se quedan como están.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearTeamVenue(team.id);
              toast.success('Hecho', 'Los horarios los pones tú.');
              onClose();
            } catch (e: any) {
              toast.error('No se pudo quitar', e?.message ?? '');
            }
          },
        },
      ],
    );
  };

  // Rehidrata al abrir (o si cambia el team activo) para no arrastrar un
  // estado viejo entre aperturas.
  useEffect(() => {
    if (!open) return;
    setCat(team?.category ?? '2ª');
    setHasGroup(!!team?.group_name);
    setGroup(team?.group_name ?? 'A');
  }, [open, team]);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateTeamSettings({
        category: cat || null,
        group_name: hasGroup ? group : null,
      });
      toast.success('Equipo actualizado');
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Guardar cambios del equipo"
          style={({ pressed }) => [
            styles.saveBtn,
            saving && { opacity: 0.5 },
            pressed && !saving && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.eyebrow}>EDITAR EQUIPO</Text>
      {/* Escudo arriba: la web ya lo subía; ahora también la app. */}
      <Pressable
        onPress={onLogoPress}
        disabled={logoBusy}
        accessibilityRole="button"
        accessibilityLabel="Cambiar escudo"
        style={({ pressed }) => [styles.crestRow, pressed && { opacity: 0.85 }]}
      >
        <TeamCrest name={team?.name ?? 'Equipo'} logo={logo} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {team?.name ?? 'Equipo'}
          </Text>
          {logoBusy ? (
            <ActivityIndicator color={c.accent} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          ) : (
            <Text style={styles.crestLink}>{logo ? 'Cambiar escudo' : 'Añadir escudo'}</Text>
          )}
        </View>
      </Pressable>
      <Text style={styles.lede}>
        Corrige la categoría o el grupo si te confundiste al crear el equipo, o
        completa el grupo cuando se sortee la liga.
      </Text>

      {/* Categoría */}
      <Text style={styles.sectionLabel}>CATEGORÍA</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {CATS.map((v) => {
          const sel = cat === v;
          return (
            <Pressable
              key={v}
              onPress={() => setCat(v)}
              style={[
                styles.cell,
                styles.scrollCell,
                sel && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.cellText, { color: sel ? c.textInverse : c.text }]}>
                {v}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grupo */}
      <View style={styles.groupHeader}>
        <Text style={styles.sectionLabel}>GRUPO</Text>
        <View style={styles.groupToggle}>
          <Toggle value={hasGroup} onChange={setHasGroup} size="sm" />
          <Text style={styles.groupToggleText}>
            {hasGroup ? 'Sí' : 'Sin grupos'}
          </Text>
        </View>
      </View>
      {hasGroup ? (
        <View style={styles.grid}>
          {GROUPS.map((g) => {
            const sel = group === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGroup(g)}
                style={[
                  styles.cell,
                  sel && { backgroundColor: c.accent, borderColor: c.accent },
                ]}
              >
                <Text style={[styles.cellText, { color: sel ? c.textInverse : c.text }]}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>
          Actívalo cuando conozcas tu grupo; podrás cambiarlo aquí en cualquier
          momento.
        </Text>
      )}

      {/* Horarios de local y franjas favoritas en una fila propia, para que
          la hoja no sea tan larga. */}
      {team ? (
        <Pressable
          onPress={() => setSlotsOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: slotsOpen }}
          style={({ pressed }) => [styles.slotsRow, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.slotsTitle}>Horarios de local</Text>
            <Text style={styles.slotsSub} numberOfLines={1}>
              {venueId
                ? `Los pone ${venueName ?? 'el club donde juegas'}`
                : teamSlotsOf(team).length
                  ? `${teamSlotsOf(team).length} franjas favoritas`
                  : 'Tus franjas favoritas'}
            </Text>
          </View>
          <View style={{ transform: [{ rotate: slotsOpen ? '90deg' : '0deg' }] }}>
            <IconChevron size={14} color={c.textFaint} />
          </View>
        </Pressable>
      ) : null}
      {slotsOpen ? (
        <>
        {/* Club sede: quién pone los horarios de local, si no es el propio equipo. */}
        {team && venueId ? (
          <View style={styles.venueBlock}>
            <Text style={styles.venueTitle}>HORARIOS DE LOCAL</Text>
            <Text style={styles.venueText}>
              Los pone {venueName ?? 'el club donde juegas'}, que es donde juegas de
              local. Te avisa cada vez que fija uno. Solo puede tocar día, hora y
              pista.
            </Text>
            <Pressable onPress={removeVenue} hitSlop={6} style={{ marginTop: 10 }}>
              <Text style={styles.venueRemove}>Prefiero ponerlos yo</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Franjas favoritas de local (las usa el club para poner los horarios). */}
        {team ? (
          <View style={styles.slotsBlock}>
            <PreferredSlotsEditor
              teamId={team.id}
              initialSlots={teamSlotsOf(team)}
            />
          </View>
        ) : null}
        </>
      ) : null}

      {canDelete ? (
        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.deleteText}>Borrar el equipo</Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    crestRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
    crestLink: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
    slotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 22,
      padding: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    slotsTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    slotsSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    deleteBtn: {
      marginTop: 28,
      height: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: c.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { color: c.error, fontSize: 14.5, fontWeight: '700' },
    venueBlock: {
      marginTop: 22,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgRaised,
    },
    venueTitle: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    venueText: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    venueRemove: { color: c.error, fontSize: 13, fontWeight: '700' },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
    },
    lede: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      marginBottom: 4,
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 18,
      marginBottom: 8,
    },
    scrollRow: {
      flexDirection: 'row',
      gap: 6,
      paddingRight: 4,
    },
    grid: {
      flexDirection: 'row',
      gap: 6,
    },
    scrollCell: {
      flex: 0,
      width: 56,
    },
    cell: {
      flex: 1,
      height: 52,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellText: {
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.4,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    groupToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    groupToggleText: {
      color: c.textMuted,
      fontSize: 12,
    },
    hint: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    slotsBlock: {
      marginTop: 22,
      paddingTop: 18,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    saveBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
