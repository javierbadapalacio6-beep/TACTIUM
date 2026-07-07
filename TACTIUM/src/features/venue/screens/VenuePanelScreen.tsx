import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack, IconPencil, IconPin, IconSearch, IconShare } from '@components/ui/Icon';
import {
  getMyVenue,
  updateVenue,
  uploadVenueLogo,
  removeVenueLogo,
  VENUE_AMENITIES,
  type MyVenue,
  type PlaceResult,
} from '@core/services/venues';
import { PlaceSearch } from '@features/onboarding/components/PlaceSearch';
import { VenueInfoSections } from '../components/VenueInfoSections';
import { toast } from '@store/toastStore';
import type { ProfileStackParamList } from '@navigation/types';

// Panel de sede (cuenta de negocio): ficha completa (ubicación, mapa, web,
// datos, servicios) con edición, logo y acceso a la ficha pública.
export const VenuePanelScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  const [venue, setVenue] = useState<MyVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  // Campos editables + ubicación repicada (si el user elige otra ficha).
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [numCourts, setNumCourts] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [repicked, setRepicked] = useState<PlaceResult | null>(null);

  // Rellena todos los campos editables desde la venue cargada.
  const seedFields = (v: MyVenue) => {
    setName(v.name);
    setWebsite(v.website ?? '');
    setDescription(v.description ?? '');
    setPhone(v.phone ?? '');
    setNumCourts(v.num_courts != null ? String(v.num_courts) : '');
    setOpeningHours(v.opening_hours ?? '');
    setAmenities(v.amenities ?? []);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await getMyVenue();
      setVenue(v);
      if (v) seedFields(v);
    } catch {
      setVenue(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startEdit = () => {
    if (!venue) return;
    seedFields(venue);
    setRepicked(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setRepicked(null);
    if (venue) seedFields(venue);
  };

  const toggleAmenity = (key: string) => {
    setAmenities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const save = async () => {
    if (!venue || saving) return;
    if (name.trim().length === 0) {
      Alert.alert('Falta el nombre', 'La sede necesita un nombre.');
      return;
    }
    setSaving(true);
    try {
      const courts = numCourts.trim() === '' ? undefined : parseInt(numCourts, 10);
      await updateVenue({
        id: venue.id,
        name: name.trim(),
        website: website.trim(),
        description: description.trim(),
        phone: phone.trim(),
        openingHours: openingHours.trim(),
        numCourts: Number.isFinite(courts) ? courts : undefined,
        amenities,
        // Si repicó una ficha, actualizamos ubicación + coords + place_id.
        ...(repicked
          ? {
              location: repicked.address ?? undefined,
              city: repicked.city ?? undefined,
              province: repicked.province ?? undefined,
              lat: repicked.lat ?? undefined,
              lng: repicked.lng ?? undefined,
              externalId: `gplace:${repicked.placeId}`,
            }
          : {}),
      });
      toast.success('Sede actualizada');
      setEditing(false);
      setRepicked(null);
      await load();
    } catch (e) {
      Alert.alert('No se pudo guardar', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  // ── Logo · pick / upload / remove ──────────────────────────────────
  const doUploadLogo = async (uri: string) => {
    if (!venue) return;
    setLogoBusy(true);
    try {
      const url = await uploadVenueLogo(venue.id, uri);
      setVenue((v) => (v ? { ...v, logo_url: url } : v));
      toast.success('Logo actualizado');
    } catch (e) {
      Alert.alert('No se pudo subir', String((e as Error).message ?? e));
    } finally {
      setLogoBusy(false);
    }
  };

  const pickLogoFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para elegir el logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await doUploadLogo(result.assets[0].uri);
  };

  const takeLogoPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await doUploadLogo(result.assets[0].uri);
  };

  const removeLogo = async () => {
    if (!venue) return;
    setLogoBusy(true);
    try {
      await removeVenueLogo(venue.id);
      setVenue((v) => (v ? { ...v, logo_url: null } : v));
      toast.success('Logo eliminado');
    } catch (e) {
      Alert.alert('No se pudo eliminar', String((e as Error).message ?? e));
    } finally {
      setLogoBusy(false);
    }
  };

  const openLogoPicker = () => {
    if (logoBusy || !venue) return;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Hacer foto', onPress: takeLogoPhoto },
      { text: 'Elegir de galería', onPress: pickLogoFromLibrary },
    ];
    if (venue.logo_url) {
      buttons.push({ text: 'Quitar logo', style: 'destructive', onPress: removeLogo });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Logo del club', undefined, buttons);
  };

  const openMap = () => {
    if (!venue) return;
    const q =
      venue.lat != null && venue.lng != null
        ? `${venue.lat},${venue.lng}`
        : encodeURIComponent(
            [venue.name, venue.location, venue.city].filter(Boolean).join(', '),
          );
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(
      () => toast.error('No se pudo abrir el mapa'),
    );
  };

  const openWebsite = () => {
    if (!venue?.website) return;
    const url = /^https?:\/\//i.test(venue.website)
      ? venue.website
      : `https://${venue.website}`;
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir la web'));
  };

  // Dirección a mostrar (repicada tiene prioridad durante la edición).
  const shownLocation = repicked
    ? repicked.address
    : venue?.location ??
      [venue?.city, venue?.province].filter(Boolean).join(', ');
  const shownPlace = repicked
    ? [repicked.city, repicked.province].filter(Boolean).join(' · ')
    : [venue?.city, venue?.province].filter(Boolean).join(' · ');

  const initials = (venue?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <IconBack size={20} color={Colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Mi sede</Text>
        {venue && !editing ? (
          <Pressable onPress={startEdit} hitSlop={10} style={styles.iconBtn}>
            <IconPencil size={18} color={Colors.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : !venue ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aún no tienes una sede</Text>
          <Text style={styles.emptySub}>
            Cuando registres tu club aparecerá aquí su ficha.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Crest + nombre · pulsable para subir/cambiar logo */}
          <View style={styles.crestBlock}>
            <Pressable
              onPress={openLogoPicker}
              disabled={logoBusy}
              accessibilityRole="button"
              accessibilityLabel="Cambiar logo del club"
              style={({ pressed }) => [styles.crestPressable, pressed && !logoBusy && { opacity: 0.85 }]}
            >
              {venue.logo_url ? (
                <Image source={{ uri: venue.logo_url }} style={styles.crestImage} />
              ) : (
                <View style={styles.crest}>
                  <Text style={styles.crestText}>{initials}</Text>
                </View>
              )}
              <View style={styles.crestBadge}>
                {logoBusy ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.crestBadgeIcon}>📷</Text>
                )}
              </View>
            </Pressable>
            {editing ? (
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Nombre de la sede"
                placeholderTextColor={Colors.textFaint}
              />
            ) : (
              <Text style={styles.venueName}>{venue.name}</Text>
            )}
            {shownPlace ? <Text style={styles.venueSub}>{shownPlace}</Text> : null}
          </View>

          {/* Ubicación */}
          <Text style={styles.sectionLabel}>UBICACIÓN</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <IconPin size={18} color={Colors.accent} />
              <Text style={styles.cardText}>{shownLocation || 'Sin dirección'}</Text>
            </View>
            {editing ? (
              <Pressable style={styles.inlineBtn} onPress={() => setPickerOpen(true)}>
                <IconSearch size={15} color={Colors.accent} />
                <Text style={styles.inlineBtnTxt}>Cambiar ubicación</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.inlineBtn} onPress={openMap}>
                <Text style={styles.inlineBtnTxt}>Ver en el mapa</Text>
              </Pressable>
            )}
          </View>

          {/* Web */}
          <Text style={styles.sectionLabel}>WEB</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://tuclub.com"
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : venue.website ? (
            <Pressable style={styles.card} onPress={openWebsite}>
              <View style={styles.cardRow}>
                <IconShare size={16} color={Colors.accent} />
                <Text style={[styles.cardText, { color: Colors.accent }]} numberOfLines={1}>
                  {venue.website}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <Text style={styles.mutedText}>Sin web. Púlsala en editar para añadirla.</Text>
            </View>
          )}

          {/* Datos ricos: inputs en edición; secciones compartidas en vista */}
          {editing ? (
            <>
              <Text style={styles.sectionLabel}>SOBRE EL CLUB</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Cuenta qué ofrece tu club…"
                placeholderTextColor={Colors.textFaint}
                multiline
              />

              <Text style={styles.sectionLabel}>DATOS</Text>
              <Text style={styles.fieldHint}>Nº de pistas</Text>
              <TextInput
                style={styles.input}
                value={numCourts}
                onChangeText={(t) => setNumCourts(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 6"
                placeholderTextColor={Colors.textFaint}
                keyboardType="number-pad"
              />
              <Text style={[styles.fieldHint, { marginTop: 12 }]}>Horario</Text>
              <TextInput
                style={styles.input}
                value={openingHours}
                onChangeText={setOpeningHours}
                placeholder="Ej. L-V 9-23 · S-D 9-21"
                placeholderTextColor={Colors.textFaint}
              />

              <Text style={styles.sectionLabel}>TELÉFONO</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Ej. 942 00 00 00"
                placeholderTextColor={Colors.textFaint}
                keyboardType="phone-pad"
              />

              <Text style={styles.sectionLabel}>SERVICIOS</Text>
              <View style={styles.chips}>
                {VENUE_AMENITIES.map((a) => {
                  const on = amenities.includes(a.key);
                  return (
                    <Pressable
                      key={a.key}
                      onPress={() => toggleAmenity(a.key)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={styles.chipIcon}>{a.icon}</Text>
                      <Text style={[styles.chipText, on && { color: Colors.accent }]}>
                        {a.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <VenueInfoSections venue={venue} />

              <Text style={styles.sectionLabel}>FICHA PÚBLICA</Text>
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('VenuePublic', { venueId: venue.id })}
              >
                <Text style={styles.publicLink}>Ver cómo lo ven los jugadores →</Text>
              </Pressable>

              <Text style={styles.sectionLabel}>PRÓXIMAMENTE</Text>
              <View style={styles.card}>
                <View style={styles.soonRow}>
                  <Text style={styles.soonLabel}>Publicar novedades y torneos</Text>
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeTxt}>PRONTO</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Acciones de edición */}
          {editing ? (
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                <Text style={styles.cancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={styles.saveTxt}>Guardar</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}

      <PlaceSearch
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(p) => {
          setRepicked(p);
          if (!name.trim()) setName(p.name);
        }}
        title="Cambiar ubicación"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  crestBlock: { alignItems: 'center', marginBottom: 8 },
  crestPressable: { marginBottom: 14, position: 'relative' },
  crest: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestImage: {
    width: 78,
    height: 78,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  crestBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgRaised,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestBadgeIcon: { fontSize: 13 },
  crestText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  venueName: { color: Colors.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  nameInput: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderColor: Colors.accent40,
    minWidth: 220,
    paddingVertical: 4,
  },
  venueSub: { color: Colors.textMuted, fontSize: 13, marginTop: 6, fontFamily: Fonts.mono },

  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.textFaint,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  mutedText: { color: Colors.textMuted, fontSize: 13 },
  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
  },
  inlineBtnTxt: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.text,
    fontSize: 15,
  },
  inputMultiline: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  fieldHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  chipOn: { backgroundColor: Colors.accent10, borderColor: Colors.accent40 },
  chipIcon: { fontSize: 14 },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  publicLink: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  soonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  soonDivider: { borderBottomWidth: 1, borderBottomColor: Colors.hair },
  soonLabel: { color: Colors.textMuted, fontSize: 14, flex: 1 },
  soonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  soonBadgeTxt: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 26 },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTxt: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
});
