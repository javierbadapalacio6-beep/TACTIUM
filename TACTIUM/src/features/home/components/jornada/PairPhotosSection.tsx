import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { IconImage, IconShare } from '@components/ui';
import { PairPhotoCard } from '@components/share/PairPhotoCard';
import { pickMatchPhoto, shareCardImage } from '@components/share/PhotoShareCard';
import * as PairPhotosApi from '@core/services/pairPhotos';

export interface PairPhotoItem {
  court: number;
  playerA: string | null;
  playerB: string | null;
  /** Sets de la pareja: «6-4 · 6-3». */
  summary: string;
  won: boolean | null;
}

/** Una foto por pareja, para compartir una a una (carrusel de Instagram) además de la general del equipo. */
export const PairPhotosSection: React.FC<{
  matchdayId: string;
  teamId: string | null;
  canEdit: boolean;
  items: PairPhotoItem[];
  matchLine: string;
  subtitle: string;
  clubLogoUri: string | null;
}> = ({ matchdayId, teamId, canEdit, items, matchLine, subtitle, clubLogoUri }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const refs = useRef<Record<number, View | null>>({});

  useEffect(() => {
    let alive = true;
    PairPhotosApi.fetchPairPhotos(matchdayId)
      .then((p) => alive && setPhotos(p))
      .catch(() => alive && setPhotos({}));
    return () => {
      alive = false;
    };
  }, [matchdayId]);

  const add = useCallback(
    async (court: number) => {
      if (!teamId) return;
      const uri = await pickMatchPhoto();
      if (!uri) return;
      setBusy(court);
      try {
        const url = await PairPhotosApi.uploadPairPhoto(teamId, matchdayId, court, uri);
        setPhotos((p) => ({ ...p, [court]: url }));
      } catch (e) {
        Alert.alert('No se pudo subir la foto', (e as Error)?.message ?? 'Inténtalo de nuevo.');
      } finally {
        setBusy(null);
      }
    },
    [teamId, matchdayId],
  );

  const remove = useCallback(
    (court: number) => {
      if (!teamId) return;
      Alert.alert('Quitar foto', `¿Quitar la foto de la pareja ${court}?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            setBusy(court);
            try {
              await PairPhotosApi.removePairPhoto(teamId, matchdayId, court);
              setPhotos((p) => {
                const n = { ...p };
                delete n[court];
                return n;
              });
            } catch (e) {
              Alert.alert('No se pudo quitar', (e as Error)?.message ?? 'Inténtalo de nuevo.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]);
    },
    [teamId, matchdayId],
  );

  if (items.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.eyebrow}>Fotos por pareja</Text>
      <Text style={s.hint}>
        Una foto de cada pareja con su resultado, lista para compartir (carrusel de Instagram, WhatsApp…).
      </Text>
      {items.map((it) => {
        const url = photos[it.court];
        const names = [it.playerA, it.playerB].filter(Boolean).join(' y ');
        return (
          <View key={it.court} style={s.item}>
            <Text style={s.itemTitle}>
              P{it.court}
              {names ? ` · ${names}` : ''}
            </Text>
            {url ? (
              <>
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <PairPhotoCard
                    ref={(r) => {
                      refs.current[it.court] = r;
                    }}
                    photoUri={url}
                    playerA={it.playerA ?? 'Jugador A'}
                    playerB={it.playerB ?? 'Jugador B'}
                    courtLabel={`P${it.court}`}
                    summary={it.summary}
                    won={it.won}
                    matchLine={matchLine}
                    subtitle={subtitle}
                    clubLogoUri={clubLogoUri}
                  />
                </View>
                <Pressable
                  onPress={() =>
                    shareCardImage(
                      { current: refs.current[it.court] } as React.RefObject<View | null>,
                      url,
                      `${names} · ${it.summary} · ${matchLine}`,
                    )
                  }
                  style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
                >
                  <IconShare size={16} color={c.accent} />
                  <Text style={s.ctaLabel}>Compartir pareja {it.court}</Text>
                </Pressable>
                {canEdit ? (
                  <View style={s.actions}>
                    <Pressable onPress={() => add(it.court)} disabled={busy === it.court}>
                      <Text style={s.link}>{busy === it.court ? 'Guardando…' : 'Cambiar foto'}</Text>
                    </Pressable>
                    <Text style={s.sep}>·</Text>
                    <Pressable onPress={() => remove(it.court)} disabled={busy === it.court}>
                      <Text style={[s.link, { color: c.error }]}>Quitar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : canEdit ? (
              <Pressable
                onPress={() => add(it.court)}
                disabled={busy === it.court}
                style={({ pressed }) => [s.cta, { marginTop: 8 }, pressed && { opacity: 0.85 }]}
              >
                {busy === it.court ? (
                  <ActivityIndicator color={c.accent} />
                ) : (
                  <>
                    <IconImage size={16} color={c.accent} />
                    <Text style={s.ctaLabel}>Añadir foto de la pareja {it.court}</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Text style={s.empty}>Aún no hay foto de esta pareja.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 22, gap: 12 },
    eyebrow: { color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
    item: {
      padding: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    itemTitle: { color: c.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      backgroundColor: c.accent10,
    },
    ctaLabel: { color: c.accent, fontSize: 14, fontWeight: '700' },
    actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 },
    link: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    sep: { color: c.textFaint },
    empty: { color: c.textFaint, fontSize: 12.5, marginTop: 6 },
  });
