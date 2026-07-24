import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconPlus, IconChevron, IconTrophy, BottomSheet } from '@components/ui';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';
import {
  listTournaments,
  createTournament,
  type Tournament,
  type MatchFormat,
  type TournamentGender,
} from '@core/services/tournaments';

import type { TournamentsStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª'];

const GENDERS: { id: TournamentGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];
const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};

const MATCH_FORMATS: { id: MatchFormat; label: string; sub: string }[] = [
  { id: 'bo3_stb', label: 'Mejor de 3 · super tie-break', sub: '2 sets; si 1-1, super TB a 11 (dif. 2)' },
  { id: 'bo3_full', label: 'Mejor de 3 sets', sub: '2 sets; 3º set completo si 1-1' },
  { id: 'bo1', label: '1 set', sub: 'Un solo set decide' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  open: 'Inscripción abierta',
  in_progress: 'En juego',
  finished: 'Finalizado',
  canceled: 'Cancelado',
};

export const ClubTournamentsScreen = ({
  navigation,
}: TournamentsStackScreenProps<'TournamentsRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);

  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!club) return;
    try {
      setItems(await listTournaments(club.id));
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [club]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <TactiumMark size={34} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>CLUB · TORNEOS</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {club?.name ?? 'Club'}
            </Text>
          </View>
        </View>
        <NotificationBell />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 64 + 12 + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
          >
            <IconPlus size={16} color={c.textInverse} />
            <Text style={styles.createLabel}>Crear torneo</Text>
          </Pressable>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <IconTrophy size={30} color={c.textFaint} />
              <Text style={styles.emptyTitle}>Aún no hay torneos</Text>
              <Text style={styles.emptyText}>
                Crea un torneo, comparte el código para que se apunten y la app
                arma el cuadro con las cabezas de serie.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 18 }}>
              {items.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    navigation.navigate('TournamentDetail', { tournamentId: t.id })
                  }
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.cardIcon}>
                    <IconTrophy size={18} color={c.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {[
                        t.genders?.length
                          ? t.genders.map((g) => GENDER_LABEL[g] ?? g).join(' / ')
                          : null,
                        t.categories?.length ? t.categories.join(' / ') : null,
                        STATUS_LABEL[t.status] ?? t.status,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <IconChevron size={16} color={c.textFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <CreateTournamentSheet
        open={creating}
        clubId={club?.id ?? null}
        onClose={() => setCreating(false)}
        onCreated={load}
      />
    </View>
  );
};

const CreateTournamentSheet: React.FC<{
  open: boolean;
  clubId: string | null;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, clubId, onClose, onCreated }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [genders, setGenders] = useState<TournamentGender[]>(['masculino']);
  const [maxPairs, setMaxPairs] = useState('');
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('bo3_stb');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setCats([]);
    setGenders(['masculino']);
    setMaxPairs('');
    setMatchFormat('bo3_stb');
  };
  const toggleCat = (v: string) =>
    setCats((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleGender = (g: TournamentGender) =>
    setGenders((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const save = async () => {
    if (!clubId || !name.trim()) {
      toast.error('Ponle un nombre al torneo');
      return;
    }
    setSaving(true);
    try {
      await createTournament({
        clubId,
        name: name.trim(),
        format: 'ko',
        matchFormat,
        genders,
        categories: cats,
        maxPairs: maxPairs ? parseInt(maxPairs, 10) : null,
      });
      toast.success('Torneo creado', 'Comparte el código para las inscripciones.');
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo crear', e?.message ?? 'Inténtalo de nuevo.');
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
          onPress={save}
          disabled={saving || !name.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !name.trim()) && { opacity: 0.5 },
            pressed && !saving && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Crear torneo</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>NUEVO TORNEO</Text>
      <Text style={styles.sheetTitle}>Eliminación directa</Text>
      <Text style={styles.sheetSub}>
        Cuadro con cabezas de serie por puntos/categoría. Más formatos (grupos,
        americano) llegarán pronto.
      </Text>

      <Text style={styles.label}>NOMBRE</Text>
      <View style={styles.input}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Torneo de primavera"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          maxLength={60}
          autoCapitalize="sentences"
        />
      </View>

      <Text style={styles.label}>GÉNERO · ELIGE UNO O VARIOS</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {GENDERS.map((g) => {
          const sel = genders.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => toggleGender(g.id)}
              style={[
                styles.genderCell,
                sel && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.genderText, { color: sel ? c.textInverse : c.text }]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>CATEGORÍAS · ELIGE UNA O VARIAS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 4 }}
      >
        {CATS.map((v) => {
          const sel = cats.includes(v);
          return (
            <Pressable
              key={v}
              onPress={() => toggleCat(v)}
              style={[
                styles.catCell,
                sel && { backgroundColor: c.accent, borderColor: c.accent },
              ]}
            >
              <Text style={[styles.catText, { color: sel ? c.textInverse : c.text }]}>
                {v}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.catHint}>
        {cats.length > 1
          ? 'Cada categoría tendrá su propio cuadro.'
          : 'Puedes marcar varias; cada una jugará su cuadro.'}
      </Text>

      <Text style={styles.label}>FORMATO DE PARTIDO</Text>
      <View style={{ gap: 8 }}>
        {MATCH_FORMATS.map((f) => {
          const sel = matchFormat === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setMatchFormat(f.id)}
              style={[
                styles.fmtRow,
                sel && { borderColor: c.accent, backgroundColor: c.accent10 },
              ]}
            >
              <View style={[styles.radio, sel && { borderColor: c.accent }]}>
                {sel ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fmtLabel}>{f.label}</Text>
                <Text style={styles.fmtSub}>{f.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>PLAZAS (PAREJAS) · OPCIONAL</Text>
      <View style={styles.input}>
        <TextInput
          value={maxPairs}
          onChangeText={(t) => setMaxPairs(t.replace(/[^0-9]/g, ''))}
          placeholder="16"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topbar: {
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 4,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    brandName: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 2,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      marginTop: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
    },
    createLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    empty: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: 24 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent15,
    },
    cardName: { color: c.text, fontSize: 15, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    // Sheet
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    sheetTitle: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
    },
    sheetSub: { color: c.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 18,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: {
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 0,
    },
    catCell: {
      width: 52,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catText: { fontSize: 16, fontWeight: '600' },
    catHint: { color: c.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
    genderCell: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genderText: { fontSize: 14, fontWeight: '600' },
    fmtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    fmtLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    fmtSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
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
