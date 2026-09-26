import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconClock, IconCourt } from '@components/ui/Icon';
import { VENUE_AMENITIES, type MyVenue } from '@core/services/venues';
import { toast } from '@store/toastStore';

// Bloques de info rica de una sede (descripción, datos, servicios, teléfono).
// Read-only. Compartido por el Panel (modo vista) y la ficha pública.
export const VenueInfoSections: React.FC<{ venue: MyVenue }> = ({ venue }) => {
  const amenities = VENUE_AMENITIES.filter((a) => venue.amenities?.includes(a.key));
  const hasFacts = venue.num_courts != null || !!venue.opening_hours;

  const callPhone = () => {
    if (!venue.phone) return;
    Linking.openURL(`tel:${venue.phone.replace(/\s+/g, '')}`).catch(() =>
      toast.error('No se pudo llamar'),
    );
  };

  return (
    <>
      {venue.description ? (
        <>
          <Text style={styles.sectionLabel}>SOBRE EL CLUB</Text>
          <View style={styles.card}>
            <Text style={styles.about}>{venue.description}</Text>
          </View>
        </>
      ) : null}

      {hasFacts ? (
        <>
          <Text style={styles.sectionLabel}>DATOS</Text>
          <View style={styles.card}>
            {venue.num_courts != null ? (
              <View style={styles.factRow}>
                <IconCourt size={17} color={Colors.accent} />
                <Text style={styles.factText}>
                  {venue.num_courts} {venue.num_courts === 1 ? 'pista' : 'pistas'}
                </Text>
              </View>
            ) : null}
            {venue.opening_hours ? (
              <View
                style={[
                  styles.factRow,
                  venue.num_courts != null && styles.factDivider,
                ]}
              >
                <IconClock size={17} color={Colors.accent} />
                <Text style={styles.factText}>{venue.opening_hours}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {amenities.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>SERVICIOS</Text>
          <View style={styles.chips}>
            {amenities.map((a) => (
              <View key={a.key} style={styles.chip}>
                <Text style={styles.chipIcon}>{a.icon}</Text>
                <Text style={styles.chipText}>{a.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {venue.phone ? (
        <>
          <Text style={styles.sectionLabel}>TELÉFONO</Text>
          <Pressable style={styles.card} onPress={callPhone}>
            <Text style={[styles.about, { color: Colors.accent }]}>{venue.phone}</Text>
          </Pressable>
        </>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
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
  about: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  factDivider: { borderTopWidth: 1, borderTopColor: Colors.hair, marginTop: 6, paddingTop: 12 },
  factText: { color: Colors.text, fontSize: 14, flex: 1 },
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
  chipIcon: { fontSize: 14 },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
});
