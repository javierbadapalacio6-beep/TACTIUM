import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  AmbientBackdrop,
  IconCamera,
  IconPlus,
  IconCheck,
  IconX,
  IconArrowRight,
  IconShare,
  IconChevron,
  ScanSheet,
} from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import { useTeamStore, type Side } from '@store/teamStore';
import { useHasActiveSub } from '@core/hooks/usePremiumGate';
import type { ScannedPlayer } from '@core/services/imageRecognition';
import { bulkUpsertPlayers } from '@core/utils/bulkUpsertPlayers';
import { ImportFcpSheet } from '@features/team/components/ImportFcpSheet';
import { FCP_ENABLED } from '@core/config/featureFlags';
import { toast } from '@store/toastStore';
import {
  OnboardingProgress,
  ProgressAction,
} from '@features/onboarding/components/OnboardingProgress';
import {
  NAME_MAX_LENGTH,
  isValidName,
  normalizeName,
  parsePts,
  sanitizePtsInput,
} from '@core/utils/validation';

import type { OnboardingStackScreenProps } from '@navigation/types';

const SIDES: Side[] = ['Drive', 'Revés', 'Ambos'];

export const AddPlayersScreen = ({
  navigation,
  route,
}: OnboardingStackScreenProps<'AddPlayers'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const team = useTeamStore((s) => s.team);
  // La plantilla ya se volcó de la federación en el paso 1: se enseña hecha.
  const importedPlayers = route.params?.importedPlayers;
  const imported = importedPlayers != null;

  const [adding, setAdding] = useState(false);
  // «o añade los nombres a mano»: la plantilla manual va plegada; se abre sola
  // si ya hay jugadores (p. ej. vuelve atrás tras un volcado).
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => {
    if (players.length > 0 && !imported) setManualOpen(true);
  }, [players.length, imported]);

  // Código de invitación del equipo (el compartido de jugador). Invitar es
  // GRATIS: lo generamos al entrar para que solo haya que pulsar «Enviar al
  // grupo de WhatsApp».
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(false);
  const [shared, setShared] = useState(false);
  const loadInvite = useCallback(async () => {
    if (!team?.id) return;
    setInviteLoading(true);
    setInviteError(false);
    try {
      const inv = await InvitationsApi.createInvitation(team.id, 'player');
      setInviteCode(inv.code);
    } catch (e) {
      console.warn('AddPlayersScreen: createInvitation', e);
      setInviteError(true);
    } finally {
      setInviteLoading(false);
    }
  }, [team?.id]);
  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const handleShareInvite = async () => {
    if (!inviteCode) return;
    try {
      const res = await Share.share({
        message: InvitationsApi.buildInviteMessage(team?.name, inviteCode, 'player'),
      });
      if (res.action === Share.sharedAction) setShared(true);
    } catch {
      /* cancelado */
    }
  };

  // El ESCANEO del ranking es premium. Normalmente pasa: la prueba sin tarjeta
  // arranca al crear el equipo o el club en el paso 1 (`useHasActiveSub` es
  // reactivo y la recoge en cuanto llega). Si no hubiera prueba, se ofrece
  // empezarla o seguir a mano. Importar de la FEDERACIÓN, en cambio, es libre
  // dentro del onboarding (fuera sigue tras el gate premium de Equipo).
  const hasSub = useHasActiveSub();
  const requestBulkImport = (open: () => void) => {
    if (hasSub) {
      open();
      return;
    }
    Alert.alert(
      'Volcado automático',
      'Escanea tu ranking y volcamos tu plantilla entera con los puntos oficiales — es una función premium. Empieza tu prueba gratis para usarlo, o añade tus jugadores a mano ahora (podrás volcarla después).',
      [
        { text: 'Añadir a mano', style: 'cancel' },
        {
          text: 'Empezar prueba',
          onPress: () =>
            navigation.navigate('Paywall', { intent: 'captain', optional: true }),
        },
      ],
    );
  };
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importingFcp, setImportingFcp] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPts, setNewPts] = useState('');
  const [newSide, setNewSide] = useState<Side>('Drive');

  // UPSERT por nombre: misma lógica que TeamScreen post-onboarding. En
  // onboarding la plantilla está vacía normalmente, pero si el user
  // vuelve atrás y re-escanea, evita duplicados.
  const handleBulkPlayers = async (scanned: ScannedPlayer[]) => {
    try {
      const { added, updated } = await bulkUpsertPlayers({
        scanned,
        existing: players,
        addPlayer,
        updatePlayer,
      });
      if (added > 0 && updated > 0) {
        toast.success(
          'Plantilla actualizada',
          `${updated} ${updated === 1 ? 'actualizado' : 'actualizados'} · ${added} ${added === 1 ? 'nuevo' : 'nuevos'}`,
        );
      } else if (updated > 0) {
        toast.success(
          'Puntos actualizados',
          `${updated} ${updated === 1 ? 'jugador' : 'jugadores'}`,
        );
      } else if (added > 0) {
        toast.success(
          `${added} ${added === 1 ? 'jugador añadido' : 'jugadores añadidos'}`,
        );
      }
    } catch (e: any) {
      console.warn('AddPlayersScreen bulk upsert failed', e);
    }
  };

  const total = players.reduce((a, p) => a + p.pts, 0);

  const onAdd = async () => {
    if (!isValidName(newName) || submittingAdd) return;
    setSubmittingAdd(true);
    try {
      await addPlayer({
        name: normalizeName(newName),
        // Si no introduce puntos, default 200 (es onboarding rápido).
        pts: newPts.trim() === '' ? 200 : parsePts(newPts),
        position: newSide,
      });
      setNewName('');
      setNewPts('');
      setNewSide('Drive');
      setAdding(false);
    } catch (e: any) {
      Alert.alert('Error al añadir', e?.message ?? '');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const cycleSide = (id: string, current: Side) => {
    const idx = SIDES.indexOf(current);
    updatePlayer(id, { position: SIDES[(idx + 1) % SIDES.length] }).catch(() => {});
  };

  const remove = (id: string) => {
    removePlayer(id).catch((e) => Alert.alert('Error', e?.message ?? ''));
  };

  // Paso 3 (Avisos) en vez de terminar aquí: es esa pantalla la que cierra
  // el onboarding.
  const goNext = () => navigation.navigate('OnboardingNotifications');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.6} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <OnboardingProgress
          step={2}
          right={<ProgressAction label="Lo haré luego" onPress={goNext} />}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>Ahora, tu gente</Text>
          <Text style={styles.lede}>
            Manda el enlace al grupo del equipo: cada jugador entra y elige su
            nombre. Invitar es gratis.
          </Text>
        </View>

        {/* Código grande + enlace */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>CÓDIGO DEL EQUIPO</Text>
          {inviteLoading ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 14 }} />
          ) : inviteError ? (
            <Pressable onPress={loadInvite} hitSlop={8} accessibilityRole="button">
              <Text style={styles.codeRetry}>No se pudo generar · Reintentar</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.codeBig} selectable>
                {inviteCode ?? '—'}
              </Text>
              {inviteCode ? (
                <Text style={styles.codeLink} selectable numberOfLines={1}>
                  {InvitationsApi.inviteUrlDisplay(inviteCode)}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <Pressable
          onPress={handleShareInvite}
          disabled={!inviteCode}
          accessibilityRole="button"
          accessibilityLabel="Enviar al grupo de WhatsApp"
          style={({ pressed }) => [
            styles.ctaBtn,
            { marginTop: 12 },
            !inviteCode && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <IconShare size={16} color="#000" />
          <Text style={styles.ctaLabel}>Enviar al grupo de WhatsApp</Text>
        </Pressable>

        {/* Plantilla de la federación: hecha si se importó en el paso 1; si
            no, el volcado (libre en el onboarding). */}
        {imported ? (
          <View style={styles.importedRow}>
            <View style={styles.scanShortcutIcon}>
              <Text style={{ fontSize: 14 }}>🏛️</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.importedTitle}>Plantilla de la federación</Text>
              <Text style={styles.scanShortcutHint}>
                {`${importedPlayers || players.length} jugadores con sus puntos · ya importada`}
              </Text>
            </View>
            <IconCheck size={16} color={c.accent} />
          </View>
        ) : FCP_ENABLED ? (
          <Pressable
            onPress={() => setImportingFcp(true)}
            accessibilityRole="button"
            accessibilityLabel="Importar plantilla de la Federación"
            style={({ pressed }) => [
              styles.scanShortcut,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.scanShortcutIcon}>
              <Text style={{ fontSize: 14 }}>🏛️</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.scanShortcutTitle}>
                Importar plantilla de la Federación
              </Text>
              <Text style={styles.scanShortcutHint}>
                Con los puntos oficiales, en un toque
              </Text>
            </View>
            <IconArrowRight size={14} color={c.accent} />
          </Pressable>
        ) : null}

        {/* «o añade los nombres a mano» (plegado) */}
        <Pressable
          onPress={() => setManualOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: manualOpen }}
          style={styles.manualToggle}
        >
          <Text style={styles.manualToggleText}>o añade los nombres a mano</Text>
          <View style={{ transform: [{ rotate: manualOpen ? '90deg' : '0deg' }] }}>
            <IconChevron size={14} color={c.textMuted} />
          </View>
        </Pressable>

        {manualOpen ? (
          <>
            {/* Atajo: escanear el ranking (volcado premium; lógica intacta). */}
            <Pressable
              onPress={() => requestBulkImport(() => setScanning(true))}
              accessibilityRole="button"
              accessibilityLabel="Escanear plantilla"
              style={({ pressed }) => [
                styles.scanShortcut,
                { marginTop: 4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.scanShortcutIcon}>
                <IconCamera size={14} color={c.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.scanShortcutTitle}>Escanear plantilla</Text>
                <Text style={styles.scanShortcutHint}>
                  Importa varios jugadores de una captura del ranking
                </Text>
              </View>
              <IconArrowRight size={14} color={c.accent} />
            </Pressable>

            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {String(players.length).padStart(2, '0')} en la plantilla
              </Text>
              <Text style={styles.counterSum}>Σ {total} pts</Text>
            </View>

            <View style={styles.list}>
              {players.map((p, i) => (
                <View
                  key={p.id}
                  style={[
                    styles.row,
                    i < players.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View style={styles.idChip}>
                    <Text style={styles.idChipText}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowName}>{p.name}</Text>
                    <Pressable
                      onPress={() => cycleSide(p.id, p.position)}
                      hitSlop={6}
                      style={styles.posBtn}
                    >
                      <Text style={styles.posBtnText}>
                        {p.position.toUpperCase()}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.ptsPill}>
                    <Text style={styles.ptsPillText}>{p.pts}</Text>
                  </View>
                  <Pressable
                    onPress={() => remove(p.id)}
                    hitSlop={6}
                    style={styles.rowBtn}
                  >
                    <IconX size={14} color={c.textFaint} />
                  </Pressable>
                </View>
              ))}

              {adding ? (
                <View style={styles.addInline}>
                  <View style={styles.addRow}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      placeholder="Nombre"
                      placeholderTextColor={c.textFaint}
                      autoFocus
                      maxLength={NAME_MAX_LENGTH}
                      autoCapitalize="words"
                      style={[styles.addField, { flex: 1 }]}
                    />
                    <TextInput
                      value={newPts}
                      onChangeText={(v) => setNewPts(sanitizePtsInput(v))}
                      placeholder="Pts"
                      placeholderTextColor={c.textFaint}
                      keyboardType="number-pad"
                      maxLength={5}
                      style={[
                        styles.addField,
                        { width: 64, fontFamily: Fonts.mono, textAlign: 'center' },
                      ]}
                    />
                    <Pressable
                      onPress={onAdd}
                      disabled={submittingAdd}
                      style={styles.confirm}
                    >
                      {submittingAdd ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <IconCheck size={16} color="#000" />
                      )}
                    </Pressable>
                  </View>
                  <View style={styles.sideTabs}>
                    {SIDES.map((sd) => {
                      const sel = newSide === sd;
                      return (
                        <Pressable
                          key={sd}
                          onPress={() => setNewSide(sd)}
                          style={[
                            styles.sideTab,
                            sel && { backgroundColor: c.accent },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sideTabText,
                              { color: sel ? '#000' : c.textMuted },
                            ]}
                          >
                            {sd}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setAdding(true)} style={styles.addRowBtn}>
                  <View style={styles.idChip}>
                    <IconPlus size={14} color={c.accent} />
                  </View>
                  <Text style={styles.addRowText}>Añadir jugador</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        {/* Discreto mientras no haya gente; en cuanto se envía el enlace o
            hay plantilla, pasa a ser el botón principal. */}
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          style={({ pressed }) => [
            shared || players.length > 0 ? styles.ctaBtn : styles.laterBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            style={shared || players.length > 0 ? styles.ctaLabel : styles.laterLabel}
          >
            Continuar
          </Text>
        </Pressable>
      </View>

      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        mode="ranking"
        teamName={team?.name}
        onConfirm={handleBulkPlayers}
      />

      <ImportFcpSheet
        open={importingFcp}
        onClose={() => setImportingFcp(false)}
        onImport={handleBulkPlayers}
      />
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: 20,
  },
  importedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  importedTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  intro: {
    paddingHorizontal: 4,
    paddingTop: 16,
    marginBottom: 18,
  },
  codeCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.bgCard,
  },
  codeLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: c.textFaint,
    fontWeight: '600',
  },
  codeBig: {
    fontFamily: Fonts.mono,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 6,
    color: c.text,
    marginTop: 8,
  },
  codeLink: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: c.accent,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  codeRetry: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 14,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  manualToggleText: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  laterBtn: {
    height: 50,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterLabel: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  title: {
    color: c.text,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 8,
  },
  lede: {
    color: c.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  scanShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: c.accent10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  scanShortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanShortcutTitle: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  scanShortcutHint: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  counter: {
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  counterText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: c.textMuted,
    letterSpacing: 1,
  },
  counterSum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  list: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: c.hair,
  },
  idChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idChipText: {
    color: c.accent,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '500',
  },
  rowName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  posBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.hair,
  },
  posBtnText: {
    color: c.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  ptsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: c.bgRaised,
  },
  ptsPillText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: c.text,
    letterSpacing: 0.4,
  },
  rowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInline: {
    padding: 14,
    backgroundColor: c.bgCard2,
    gap: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addField: {
    backgroundColor: c.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 14,
  },
  confirm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
  },
  sideTab: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTabText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addRowText: {
    color: c.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  ctaBtn: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
