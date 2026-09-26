import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack, IconSearch, IconPin } from '@components/ui/Icon';
import { createVenue, type PlaceResult } from '@core/services/venues';
import { PlaceSearch } from '../components/PlaceSearch';
import { useProfileStore } from '@store/profileStore';
import { useVenueStore } from '@store/venueStore';
import type { NewUserStackScreenProps } from '@navigation/types';

// Alta básica de sede / club de pádel (cuenta de negocio). v1: busca tu club
// en el mapa (Google Places) → nombre + ubicación se rellenan solos; también
// se puede rellenar a mano. Logo y servicios llegan después.
export const VenueSetupScreen = ({
  navigation,
}: NewUserStackScreenProps<'VenueSetup'>) => {
  const insets = useSafeAreaInsets();
  const markOnboarded = useProfileStore((s) => s.markOnboarded);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [picked, setPicked] = useState<PlaceResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0;

  const onPickPlace = (p: PlaceResult) => {
    setPicked(p);
    setName(p.name);
    setLocation(p.address ?? [p.city, p.province].filter(Boolean).join(', '));
  };

  const submit = async () => {
    if (!canSubmit) return;
    try {
      setSaving(true);
      await createVenue({
        name: name.trim(),
        location: location.trim() || undefined,
        city: picked?.city ?? undefined,
        province: picked?.province ?? undefined,
        lat: picked?.lat ?? undefined,
        lng: picked?.lng ?? undefined,
        website: picked?.website ?? undefined,
        externalId: picked ? `gplace:${picked.placeId}` : undefined,
      });
      // Refresca el store de sede ANTES de entrar a tabs para que el
      // TabNavigator ya muestre el tab "Mi sede".
      await useVenueStore.getState().load();
      markOnboarded(); // el RootNavigator entra al feed
    } catch (e) {
      Alert.alert('No se pudo crear', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <IconBack size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Tu sede</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>SEDE · CLUB DE PÁDEL</Text>
        <Text style={styles.title}>Registra tu sede</Text>
        <Text style={styles.lede}>
          Tu club tendrá presencia en TACTIUM para publicar novedades, servicios
          y torneos. Empieza con lo básico; el resto lo completas después.
        </Text>

        <Pressable
          style={styles.searchBtn}
          onPress={() => setPickerOpen(true)}
        >
          <IconSearch size={18} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.searchBtnTxt}>Busca tu club en el mapa</Text>
            <Text style={styles.searchBtnSub}>
              Elígelo y rellenamos la ubicación por ti
            </Text>
          </View>
        </Pressable>

        {picked ? (
          <View style={styles.pickedChip}>
            <IconPin size={14} color={Colors.accent} />
            <Text style={styles.pickedTxt} numberOfLines={2}>
              {picked.address ??
                [picked.city, picked.province].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}

        <Text style={styles.orLine}>o rellénalo a mano</Text>

        <Text style={styles.label}>Nombre del club / sede</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej. Smash Padel Center"
          placeholderTextColor={Colors.textFaint}
        />

        <Text style={styles.label}>Ubicación (ciudad / dirección)</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Ej. Santander"
          placeholderTextColor={Colors.textFaint}
        />

        <Text style={styles.hint}>
          El logo y los servicios (clases, alquiler, torneos…) los añadirás
          pronto desde tu panel de sede.
        </Text>

        <Pressable
          style={[styles.cta, (!canSubmit || saving) && styles.ctaDisabled]}
          onPress={submit}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.ctaTxt}>Crear sede y entrar</Text>
          )}
        </Pressable>
      </ScrollView>

      <PlaceSearch
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onPickPlace}
        title="Busca tu club"
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
  backBtn: {
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
  content: { paddingHorizontal: 22, paddingTop: 12 },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: '#4CC3FF', fontWeight: '500' },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  lede: { color: Colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  searchBtnTxt: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  searchBtnSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  pickedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
  },
  pickedTxt: { flex: 1, color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  orLine: {
    color: Colors.textFaint,
    fontSize: 12,
    fontFamily: Fonts.mono,
    textAlign: 'center',
    marginTop: 18,
    letterSpacing: 1,
  },
  label: { color: Colors.text, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10 },
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
  hint: { color: Colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: 16 },
  cta: {
    marginTop: 26,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
});
