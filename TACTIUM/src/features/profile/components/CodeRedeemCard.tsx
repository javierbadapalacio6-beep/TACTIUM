import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import { useTeamStore } from '@store/teamStore';
import {
  getClaimableParticipants,
  claimCasualParticipant,
  type ClaimableParticipant,
} from '@core/services/casualMatches';
import { JoinTeamPreview } from '@features/onboarding/components/JoinTeamPreview';

/** Vibración ligera. Si el módulo nativo no está (dev client viejo), nada. */
export function lightTap() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // sin módulo nativo
  }
}

/** Longitud de los códigos de invitación de equipo. Los de partido son de 6. */
const TEAM_CODE_LEN = 8;

const NOT_FOUND = 'Ese código no existe o ya está reclamado.';
const GENERIC = 'No hemos podido comprobar el código. Revisa tu conexión e inténtalo otra vez.';

/**
 * Campo para canjear un código DENTRO de la pantalla (sustituye a
 * `Alert.prompt`, que solo existe en iOS: en Android no pasaba nada).
 *
 *  · `casual`: código de partido (6 caracteres) → hoja con los nombres del
 *    partido para elegir «este soy yo».
 *  · `any`: además acepta el código de invitación de un equipo (8
 *    caracteres) y abre la vista previa de la invitación que ya existe.
 *
 * Los errores se dicen en lenguaje normal; nunca se enseña el mensaje crudo
 * del servidor.
 */
export const CodeRedeemCard: React.FC<{
  mode?: 'casual' | 'any';
  title?: string;
  hint?: string;
  onClaimed?: () => void;
}> = ({ mode = 'casual', title, hint, onClaimed }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const setActiveTeam = useTeamStore((st) => st.setActiveTeam);
  const finishOnboarding = useTeamStore((st) => st.finishOnboarding);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<ClaimableParticipant[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [teamCode, setTeamCode] = useState<string | null>(null);

  const clean = code.trim().toUpperCase();
  const canSubmit = clean.length >= 4 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (mode === 'any' && clean.length === TEAM_CODE_LEN) {
      setTeamCode(clean);
      return;
    }
    setBusy(true);
    try {
      const list = await getClaimableParticipants(clean);
      if (list.length === 0) {
        setError(
          mode === 'any' && clean.length !== 6
            ? 'Ese código no existe. Los de partido tienen 6 caracteres y los de equipo, 8.'
            : NOT_FOUND,
        );
        return;
      }
      setParts(list);
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  };

  const claim = async (pt: ClaimableParticipant) => {
    if (claiming) return;
    setClaiming(pt.participant_id);
    try {
      const ok = await claimCasualParticipant(clean, pt.participant_id);
      if (!ok) {
        toast.error('No se pudo reclamar', NOT_FOUND);
        return;
      }
      lightTap();
      toast.success('Partido reclamado', 'Ya cuenta en tus números.');
      setParts(null);
      setCode('');
      onClaimed?.();
    } catch {
      toast.error('No se pudo reclamar', GENERIC);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>
        {title ??
          (mode === 'any'
            ? '¿Te han pasado un código?'
            : '¿Te han pasado un código de partido?')}
      </Text>
      <View style={s.row}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/[^A-Za-z0-9]/g, '').slice(0, TEAM_CODE_LEN));
            if (error) setError(null);
          }}
          placeholder={mode === 'any' ? 'Código de partido o de equipo' : 'K7M2XQ'}
          placeholderTextColor={c.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submit}
          maxLength={TEAM_CODE_LEN}
          style={[s.input, clean.length > 0 && s.inputFilled]}
          accessibilityLabel="Código"
        />
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Canjear código"
          style={({ pressed }) => [
            s.btn,
            !canSubmit && { opacity: 0.45 },
            pressed && canSubmit && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={s.btnLabel}>{mode === 'any' ? 'Usar' : 'Canjear'}</Text>
          )}
        </Pressable>
      </View>
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text style={s.hint}>
          {hint ??
            (mode === 'any'
              ? 'Un partido pasa a tus números; un equipo te une a su plantilla.'
              : 'Elige tu nombre en ese partido y contará en tus números.')}
        </Text>
      )}

      {/* ¿Quién eres tú en ese partido? */}
      <BottomSheet open={parts !== null} onClose={() => setParts(null)}>
        <Text style={s.sheetEyebrow}>CÓDIGO {clean}</Text>
        <Text style={s.sheetTitle}>¿Quién eres tú?</Text>
        <Text style={s.sheetLede}>
          Elige tu nombre en ese partido. A partir de ahí contará en tus números.
        </Text>
        <View style={s.list}>
          {(parts ?? []).map((pt, i) => (
            <Pressable
              key={pt.participant_id}
              onPress={() => claim(pt)}
              disabled={!!claiming}
              style={({ pressed }) => [
                s.listRow,
                i > 0 && s.listDivider,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Soy ${pt.name}`}
            >
              <Text style={s.listName} numberOfLines={1}>
                {pt.name}
              </Text>
              {claiming === pt.participant_id ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Text style={s.listCta}>Soy yo</Text>
              )}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* Código de equipo: la vista previa de invitación de siempre. */}
      <BottomSheet open={teamCode !== null} onClose={() => setTeamCode(null)}>
        <Text style={s.sheetEyebrow}>INVITACIÓN DE EQUIPO</Text>
        <Text style={s.sheetTitle}>Únete a tu equipo</Text>
        {teamCode ? (
          <View style={{ marginTop: 12 }}>
            <JoinTeamPreview
              key={teamCode}
              code={teamCode}
              onJoined={() => {
                setTeamCode(null);
                setCode('');
                lightTap();
              }}
              onGoToTeam={(teamId) => {
                void setActiveTeam(teamId).catch(() => {});
                finishOnboarding();
                setTeamCode(null);
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      padding: 14,
      gap: 10,
    },
    title: { color: c.text, fontSize: 14, fontWeight: '700' },
    row: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    input: {
      flex: 1,
      minHeight: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgRaised,
      paddingHorizontal: 12,
      color: c.text,
      fontFamily: Fonts.mono,
      fontSize: 15,
      letterSpacing: 2,
    },
    inputFilled: { borderColor: c.accent40 },
    btn: {
      minWidth: 88,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnLabel: { color: c.textInverse, fontSize: 14, fontWeight: '700' },
    hint: { color: c.textFaint, fontSize: 12, lineHeight: 17 },
    error: { color: c.error, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
    },
    sheetTitle: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
    },
    sheetLede: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
    list: {
      marginTop: 14,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    listDivider: { borderTopWidth: 1, borderColor: c.hair },
    listName: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    listCta: { color: c.accent, fontSize: 13, fontWeight: '700' },
  });
