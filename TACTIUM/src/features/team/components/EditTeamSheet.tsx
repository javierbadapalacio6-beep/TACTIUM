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
import { BottomSheet, Toggle } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
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
      <Text style={styles.title} numberOfLines={1}>
        {team?.name ?? 'Equipo'}
      </Text>
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
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
