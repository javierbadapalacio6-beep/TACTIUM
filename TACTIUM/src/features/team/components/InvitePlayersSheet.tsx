import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconTrash, IconShare, IconLink } from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import * as PlayersApi from '@core/services/players';

// Sheet de invitación de jugadores (GRATIS, sin gate premium). ENLACE PRIMERO:
// `tactium.io/i/{CODE}` + «Enviar por WhatsApp»; el código queda como
// alternativa. Solo gestiona códigos de role='player' — la gestión de members con roles
// existe en TeamMembersSheet del flow club (más completo) y aquí no
// aplica porque un equipo independiente no invita capitanes.
export const InvitePlayersSheet: React.FC<{
  open: boolean;
  teamId: string | null;
  teamName: string | null;
  onClose: () => void;
}> = ({ open, teamId, teamName, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [invitations, setInvitations] = useState<
    InvitationsApi.TeamInvitationWithRedeemer[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Plantilla: «N en la plantilla · M ya en TACTIUM» (M = fichas con cuenta).
  const [roster, setRoster] = useState<{ total: number; linked: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    PlayersApi.fetchPlayers(teamId)
      .then((pls) => {
        if (!cancelled) {
          setRoster({
            total: pls.length,
            linked: pls.filter((p) => !!p.user_id).length,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRoster(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, teamId]);

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let invs = await InvitationsApi.fetchTeamInvitationsWithRedeemers(
          teamId,
        );
        // El equipo siempre tiene UN código de jugador. Si aún no existe (o
        // viene de la época de un código por jugador), se crea al abrir.
        if (!invs.some(InvitationsApi.isSharedCode)) {
          const inv = await InvitationsApi.createInvitation(teamId, 'player');
          invs = [{ ...inv, redeemer: null }, ...invs];
        }
        if (!cancelled) setInvitations(invs);
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert('Error', e?.message ?? 'No se pudo cargar.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teamId]);

  // Separamos en dos grupos para presentación:
  //  · Activos = no canjeados y no caducados (acción posible: compartir/revocar)
  //  · Canjeados = used_at != null (informativo: muestra a quién se unió)
  // Los caducados sin canjear se omiten para no ensuciar.
  // El código del equipo (uno, reutilizable) y, aparte, los sueltos de un solo
  // uso que quedaran de antes.
  const shared = invitations.find(InvitationsApi.isSharedCode) ?? null;
  const legacyCodes = invitations.filter(
    (i) => !InvitationsApi.isSharedCode(i) && InvitationsApi.isInvitationActive(i),
  );
  const redeemedCodes = invitations.filter((i) => i.used_at !== null);

  const buildShareMessage = (code: string) =>
    InvitationsApi.buildInviteMessage(teamName, code, 'player');

  // Copiar: no hay módulo de portapapeles en el build actual, así que abrimos
  // la hoja del sistema solo con el enlace (trae «Copiar»). El texto del enlace
  // también se puede seleccionar con una pulsación larga.
  const handleCopyLink = async (code: string) => {
    const url = InvitationsApi.inviteUrl(code);
    try {
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch {
      /* cancelado */
    }
  };

  const handleRotate = () => {
    if (!teamId || generating) return;
    Alert.alert(
      'Generar código nuevo',
      'El código actual dejará de funcionar. Úsalo solo si se ha filtrado fuera del equipo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          style: 'destructive',
          onPress: async () => {
            setGenerating(true);
            try {
              const inv = await InvitationsApi.rotatePlayerCode(teamId);
              setInvitations((list) => [
                { ...inv, redeemer: null },
                ...list.filter((i) => !InvitationsApi.isSharedCode(i)),
              ]);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo generar el código.');
            } finally {
              setGenerating(false);
            }
          },
        },
      ],
    );
  };

  const handleShare = async (code: string) => {
    try {
      await Share.share({ message: buildShareMessage(code) });
    } catch {
      /* cancelado */
    }
  };

  const handleRevoke = (inv: InvitationsApi.TeamInvitation) => {
    Alert.alert(
      'Revocar código',
      `¿Anular el código ${inv.code}? El jugador no podrá usarlo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            try {
              await InvitationsApi.revokeInvitation(inv.id);
              setInvitations((list) => list.filter((i) => i.id !== inv.id));
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo revocar.');
            }
          },
        },
      ],
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>INVITAR JUGADORES · GRATIS</Text>
      <Text style={styles.title}>Invita a tu plantilla</Text>
      <Text style={styles.lede}>
        Mándalo al grupo del equipo: cada uno entra con el enlace y elige su
        nombre de la plantilla. No caduca ni se gasta.
      </Text>

      {loading ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <>
          <Text style={styles.groupLabel}>ENLACE DEL EQUIPO</Text>
          <View style={styles.linkBox}>
            <IconLink size={14} color={c.accent} />
            <Text style={styles.linkText} numberOfLines={1} selectable>
              {shared ? InvitationsApi.inviteUrlDisplay(shared.code) : '—'}
            </Text>
            <Pressable
              onPress={() => shared && handleCopyLink(shared.code)}
              disabled={!shared}
              hitSlop={8}
              style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Copiar enlace"
            >
              <Text style={styles.copyBtnLabel}>Copiar</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => shared && handleShare(shared.code)}
            disabled={!shared}
            style={({ pressed }) => [
              styles.generateBtn,
              !shared && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar por WhatsApp"
          >
            <IconShare size={14} color={c.textInverse} />
            <Text style={styles.generateBtnLabel}>Enviar por WhatsApp</Text>
          </Pressable>

          <View style={styles.altRow}>
            <Text style={styles.altText}>¿Prefieren el código? </Text>
            <Text style={styles.altCode} selectable>
              {shared?.code ?? '—'}
            </Text>
            <Text style={styles.altText}> · </Text>
            <Pressable
              onPress={handleRotate}
              disabled={generating || !teamId}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cambiar código"
            >
              {generating ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Text style={styles.altLink}>Cambiar código</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.statsLine}>
            {roster
              ? `${roster.total} en la plantilla · ${roster.linked} ya en TACTIUM`
              : ' '}
            {(shared?.uses ?? 0) > 0
              ? ` · ${shared?.uses} ${shared?.uses === 1 ? 'se ha unido' : 'se han unido'} con el enlace`
              : ''}
          </Text>

          {legacyCodes.length > 0 ? (
            <>
              <Text style={[styles.groupLabel, { marginTop: 18 }]}>
                CÓDIGOS SUELTOS (DE UN SOLO USO)
              </Text>
              <View style={styles.list}>
                {legacyCodes.map((inv) => (
                  <View key={inv.id} style={styles.row}>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>{inv.code}</Text>
                      <Text style={styles.codeMeta}>
                        Expira {formatExpiry(inv.expires_at)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleShare(inv.code)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Compartir código"
                    >
                      <IconShare size={14} color={c.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRevoke(inv)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Revocar código"
                    >
                      <IconTrash size={14} color={c.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {redeemedCodes.length > 0 ? (
            <>
              <Text style={[styles.groupLabel, { marginTop: 18 }]}>
                CANJEADOS
              </Text>
              <View style={styles.list}>
                {redeemedCodes.map((inv) => {
                  const who =
                    inv.redeemer?.full_name?.trim() ||
                    inv.redeemer?.email ||
                    'Jugador';
                  return (
                    <View key={inv.id} style={[styles.row, styles.rowMuted]}>
                      <View style={styles.codeBlock}>
                        <Text style={[styles.codeText, styles.codeTextMuted]}>
                          {inv.code}
                        </Text>
                        <Text style={styles.codeMeta} numberOfLines={1}>
                          {who} · {formatRedeemedAt(inv.used_at!)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
};

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'mañana';
  if (diffDays < 30) return `en ${diffDays} días`;
  return `el ${date.getDate()}/${date.getMonth() + 1}`;
}

function formatRedeemedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'unido hoy';
  if (diffDays === 1) return 'unido ayer';
  if (diffDays < 30) return `unido hace ${diffDays} días`;
  return `unido el ${date.getDate()}/${date.getMonth() + 1}`;
}

const makeStyles = (c: Palette) => StyleSheet.create({
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
    marginBottom: 6,
  },
  lede: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  generateBtnLabel: {
    color: c.textInverse,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  list: { gap: 8 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.accent40,
    marginBottom: 10,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    letterSpacing: 0.3,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  copyBtnLabel: { color: c.accent, fontSize: 13, fontWeight: '700' },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: -4,
  },
  altText: { color: c.textMuted, fontSize: 13 },
  altCode: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  altLink: { color: c.accent, fontSize: 13, fontWeight: '600' },
  statsLine: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 12,
  },
  groupLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  rowMuted: {
    opacity: 0.7,
    backgroundColor: c.bgRaised,
    borderColor: c.hair,
  },
  codeTextMuted: {
    color: c.textMuted,
    textDecorationLine: 'line-through',
  },
  loaderRow: { paddingVertical: 24, alignItems: 'center' },
  empty: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.hair,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  codeBlock: { flex: 1, minWidth: 0 },
  codeText: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    letterSpacing: 1,
  },
  codeMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
