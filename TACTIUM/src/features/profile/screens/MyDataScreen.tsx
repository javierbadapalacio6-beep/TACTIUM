import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Share,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron, IconX } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import * as ProfileApi from '@core/services/profile';
import type { RootStackParamList } from '@navigation/types';

interface MyDataSummary {
  email: string;
  fullName: string | null;
  registeredAt: string | null;
  userId: string;
  clubsOwned: number;
  clubMemberships: number;
  teamsOwned: number;
  teamMemberships: number;
  playersLinked: number;
  subscriptions: number;
  invitationsCreated: number;
}

export const MyDataScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);

  const [summary, setSummary] = useState<MyDataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Carga el export completo para extraer un resumen visible al user.
  // Mantenemos también el JSON crudo para reusarlo al compartir sin
  // tener que llamar la RPC dos veces.
  const [rawData, setRawData] = useState<Record<string, unknown> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const data = await ProfileApi.exportMyData();
          if (cancelled) return;
          setRawData(data);

          const profile = (data.profile as Record<string, any>) ?? null;
          const list = (key: string): unknown[] =>
            Array.isArray(data[key]) ? (data[key] as unknown[]) : [];

          setSummary({
            email: user?.email ?? profile?.email ?? '—',
            fullName: profile?.full_name ?? null,
            registeredAt: profile?.created_at ?? user?.created_at ?? null,
            userId: (user?.id ?? profile?.id ?? '') as string,
            clubsOwned: list('clubs_owned').length,
            clubMemberships: list('club_memberships').length,
            teamsOwned: list('teams_owned').length,
            teamMemberships: list('team_memberships').length,
            playersLinked: list('players_linked').length,
            subscriptions: list('subscriptions').length,
            invitationsCreated: list('team_invitations_created').length,
          });
        } catch (e) {
          console.warn('exportMyData failed', e);
          if (!cancelled) {
            toast.error(
              'No se pudieron cargar tus datos',
              'Inténtalo de nuevo en unos segundos.',
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const handleExport = async () => {
    if (!rawData || exporting) return;
    setExporting(true);
    try {
      const json = JSON.stringify(rawData, null, 2);
      await Share.share({
        message: json,
        title: 'Mis datos · TACTIUM',
      });
    } catch (e: any) {
      Alert.alert('No se pudo compartir', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const openLegal = (path: string) => {
    Linking.openURL(`https://tactium.io/${path}`).catch(() =>
      toast.error('No se pudo abrir', 'Comprueba tu conexión.'),
    );
  };

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={10}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconX size={14} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>MIS DATOS</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>
          Aquí puedes ver y exportar todos los datos personales que TACTIUM
          guarda sobre ti, en cumplimiento del derecho de portabilidad
          (RGPD Art. 20).
        </Text>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : summary ? (
          <>
            <Text style={styles.sectionLabel}>CUENTA</Text>
            <View style={styles.card}>
              <Row label="Email" value={summary.email} />
              {summary.fullName ? (
                <Row label="Nombre" value={summary.fullName} />
              ) : null}
              <Row label="Registro" value={fmtDate(summary.registeredAt)} />
              <Row
                label="ID interno"
                value={summary.userId.slice(0, 8) + '…'}
                mono
                isLast
              />
            </View>

            <Text style={styles.sectionLabel}>RESUMEN DE TUS DATOS</Text>
            <View style={styles.card}>
              <CountRow label="Clubes que diriges" value={summary.clubsOwned} />
              <CountRow
                label="Clubes a los que perteneces"
                value={summary.clubMemberships}
              />
              <CountRow label="Equipos que diriges" value={summary.teamsOwned} />
              <CountRow
                label="Equipos a los que perteneces"
                value={summary.teamMemberships}
              />
              <CountRow
                label="Jugadores vinculados a ti"
                value={summary.playersLinked}
              />
              <CountRow
                label="Suscripciones"
                value={summary.subscriptions}
              />
              <CountRow
                label="Invitaciones creadas"
                value={summary.invitationsCreated}
                isLast
              />
            </View>

            <Text style={styles.sectionLabel}>EXPORTAR</Text>
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Compartir mis datos como JSON"
              style={({ pressed }) => [
                styles.exportBtn,
                pressed && !exporting && { opacity: 0.85 },
                exporting && { opacity: 0.6 },
              ]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.exportBtnLabel}>
                  Compartir mis datos (JSON)
                </Text>
              )}
            </Pressable>
            <Text style={styles.exportHint}>
              Se abrirá el menú de compartir de iOS/Android. Puedes guardar
              el archivo en Notas, Drive, Mail o cualquier app que aceptes.
            </Text>

            <Text style={styles.sectionLabel}>POLÍTICAS</Text>
            <View style={styles.card}>
              <LinkRow
                label="Política de privacidad"
                onPress={() => openLegal('legal/privacidad')}
              />
              <LinkRow
                label="Términos del servicio"
                onPress={() => openLegal('legal/terminos')}
                isLast
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const Row: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  isLast?: boolean;
}> = ({ label, value, mono, isLast }) => (
  <View style={[styles.row, !isLast && styles.rowDivider]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text
      style={[
        styles.rowValue,
        mono && { fontFamily: Fonts.mono, fontSize: 12 },
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const CountRow: React.FC<{
  label: string;
  value: number;
  isLast?: boolean;
}> = ({ label, value, isLast }) => (
  <View style={[styles.row, !isLast && styles.rowDivider]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <View style={styles.countPill}>
      <Text style={styles.countPillText}>{value}</Text>
    </View>
  </View>
);

const LinkRow: React.FC<{
  label: string;
  onPress: () => void;
  isLast?: boolean;
}> = ({ label, onPress, isLast }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="link"
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.row,
      !isLast && styles.rowDivider,
      pressed && { opacity: 0.85 },
    ]}
  >
    <Text style={[styles.rowLabel, { color: Colors.text }]}>{label}</Text>
    <IconChevron size={14} color={Colors.textFaint} />
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },

  scroll: { paddingHorizontal: 22, paddingTop: 14 },
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  loader: { paddingVertical: 40, alignItems: 'center' },

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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: Colors.hair,
  },
  rowLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  rowValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
  },
  countPill: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },

  exportBtn: {
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnLabel: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  exportHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
