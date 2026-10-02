import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';

import type { Palette } from '@core/theme';
import { resolveFcpPlayer, type FcpPlayerMatch } from '@core/services/fcpSearch';
import type { SignupStyles } from './signupStyles';
import type { PlayerDraft, PlayerErrors } from './playerDraft';

// Busca al jugador en la Federación al escribir su nombre (con pausa de 350 ms
// y descartando respuestas viejas).
function useFcpMatches(name: string, enabled: boolean, genero: 'M' | 'F' | null) {
  const [matches, setMatches] = useState<FcpPlayerMatch[]>([]);
  const req = useRef(0);
  useEffect(() => {
    const q = name.trim();
    if (!enabled || q.length < 3) {
      req.current++;
      setMatches([]);
      return;
    }
    const id = ++req.current;
    const t = setTimeout(async () => {
      try {
        const m = await resolveFcpPlayer(q, { genero });
        if (req.current === id) setMatches(m);
      } catch {
        if (req.current === id) setMatches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [name, enabled, genero]);
  return matches;
}

/** Línea corta de una ficha: «Equipo · 820 pts · nivel 4 · liga». */
export const fcpMeta = (m: FcpPlayerMatch) =>
  [
    m.equipo ?? (m.nivelLiga == null ? 'solo circuito' : null),
    m.nivelLiga == null ? 'sin puntos de liga' : m.puntos != null ? `${m.puntos} pts` : null,
    m.nivel != null
      ? `nivel ${m.nivel}${
          m.origenNivel === 'circuito' ? ' · circuito' : m.origenNivel === 'liga' ? ' · liga' : ''
        }`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

// Bloque de un jugador: nombre (+ ficha de la Federación), «no federado»,
// puntos, nivel (si el torneo lo usa), email y, para quien se inscribe, teléfono.
export const PlayerBlock: React.FC<{
  c: Palette;
  styles: SignupStyles;
  title: string;
  note?: string;
  me: boolean;
  draft: PlayerDraft;
  onChange: (patch: Partial<PlayerDraft>) => void;
  errors: PlayerErrors;
  usesNivel: boolean;
  genero: 'M' | 'F' | null;
  showPhone: boolean;
  emailRequired: boolean;
  emailHint?: string;
  namePlaceholder: string;
}> = ({
  c,
  styles,
  title,
  note,
  me,
  draft,
  onChange,
  errors,
  usesNivel,
  genero,
  showPhone,
  emailRequired,
  emailHint,
  namePlaceholder,
}) => {
  const matches = useFcpMatches(draft.name, !draft.noFed, genero);

  // Si la Federación devuelve UNA sola coincidencia, se aplica sola (puntos y
  // nivel) y se muestra como confirmada. No se vuelve a aplicar una ficha que
  // el jugador ya descartó con «No soy yo».
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const d = draftRef.current;
    if (d.noFed || matches.length !== 1) return;
    const m = matches[0];
    if (d.fcp?.idJugador === m.idJugador || d.fcpDismissed.includes(m.idJugador)) return;
    onChangeRef.current({
      fcp: m,
      pts: m.puntos != null ? String(m.puntos) : d.pts,
      lvl: m.nivel != null ? String(m.nivel) : d.lvl,
    });
  }, [matches]);

  const pick = (m: FcpPlayerMatch) =>
    onChange({
      fcp: m,
      pts: m.puntos != null ? String(m.puntos) : draft.pts,
      lvl: m.nivel != null ? String(m.nivel) : draft.lvl,
    });
  const notMe = () => {
    if (!draft.fcp) return;
    onChange({
      fcp: null,
      fcpDismissed: [...draft.fcpDismissed, draft.fcp.idJugador],
      pts: '',
      lvl: '',
    });
  };
  // Editar a mano los puntos o el nivel = ya no vale la ficha detectada.
  const manualPatch = (patch: Partial<PlayerDraft>): Partial<PlayerDraft> =>
    draft.fcp
      ? { ...patch, fcp: null, fcpDismissed: [...draft.fcpDismissed, draft.fcp.idJugador] }
      : patch;

  const candidates = matches.filter((m) => !draft.fcpDismissed.includes(m.idJugador));
  const showChooser = !draft.noFed && !draft.fcp && matches.length > 1 && candidates.length > 0;

  const err = (k: keyof PlayerErrors) =>
    errors[k] ? <Text style={styles.fieldError}>{errors[k]}</Text> : null;

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {note ? <Text style={styles.blockNote}>{note}</Text> : null}

      <Text style={styles.label}>Nombre y apellidos</Text>
      <View style={[styles.input, errors.name && styles.inputError]}>
        <TextInput
          value={draft.name}
          onChangeText={(v) => onChange({ name: v })}
          placeholder={namePlaceholder}
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          maxLength={40}
          autoCapitalize="words"
        />
      </View>
      {err('name')}

      {!draft.noFed && draft.fcp ? (
        <View style={styles.suggestWrap}>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmTick}>✓</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.suggestLabel}>DATOS DE LA FEDERACIÓN</Text>
              <Text style={[styles.suggestName, { marginTop: 4 }]} numberOfLines={1}>
                {draft.fcp.name}
              </Text>
              <Text style={styles.suggestMeta} numberOfLines={2}>
                {fcpMeta(draft.fcp)}
              </Text>
            </View>
            <Pressable onPress={notMe} hitSlop={8}>
              <Text style={styles.linkText}>{me ? 'No soy yo' : 'No es esta persona'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showChooser ? (
        <View style={styles.suggestWrap}>
          <Text style={styles.suggestLabel}>
            {me ? 'FEDERACIÓN · ¿CUÁL ERES TÚ?' : 'FEDERACIÓN · ¿CUÁL ES?'}
          </Text>
          <View style={styles.suggestRow}>
            {candidates.slice(0, 3).map((m) => (
              <Pressable
                key={m.idJugador}
                onPress={() => pick(m)}
                style={({ pressed }) => [styles.suggestChip, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.suggestName} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.suggestMeta} numberOfLines={1}>
                  {fcpMeta(m)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.suggestHint}>
            Toca la ficha correcta y rellenamos los puntos. Si no aparece, ponlos a mano.
          </Text>
        </View>
      ) : null}

      {draft.noFed ? (
        <View style={styles.noFedRow}>
          <Text style={styles.noFedText}>
            {me ? 'No juegas federado' : 'No juega federado'} · cuenta 0 puntos
          </Text>
          <Pressable onPress={() => onChange({ noFed: false })} hitSlop={8}>
            <Text style={styles.linkText}>Deshacer</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.two}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Puntos</Text>
              <View style={[styles.input, errors.pts && styles.inputError]}>
                <TextInput
                  value={draft.pts}
                  onChangeText={(v) => onChange(manualPatch({ pts: v.replace(/[^0-9]/g, '') }))}
                  placeholder="ej. 850"
                  placeholderTextColor={c.textFaint}
                  style={styles.inputField}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
            {usesNivel ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.label} numberOfLines={1}>
                  Nivel (liga o circuito)
                </Text>
                <View style={[styles.input, errors.lvl && styles.inputError]}>
                  <TextInput
                    value={draft.lvl}
                    onChangeText={(v) => onChange(manualPatch({ lvl: v.replace(/[^0-9]/g, '') }))}
                    placeholder="ej. 4"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
            ) : null}
          </View>
          {err('pts')}
          {err('lvl')}
          {usesNivel ? (
            <Text style={styles.fieldHint}>
              Nivel = tu categoría (2ª → 2, 4ª → 4). Cuenta la mejor entre liga y circuito.
            </Text>
          ) : null}
          <Pressable
            onPress={() => onChange({ noFed: true })}
            hitSlop={6}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>
              {me ? 'No juego federado (cuenta 0 puntos)' : 'No juega federado (cuenta 0 puntos)'}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={styles.label}>{emailRequired ? 'Email' : 'Email · opcional'}</Text>
      <View style={[styles.input, errors.email && styles.inputError]}>
        <TextInput
          value={draft.email}
          onChangeText={(v) => onChange({ email: v })}
          placeholder={emailRequired ? 'tu@email.com' : 'para mandarle el código'}
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
        />
      </View>
      {err('email')}
      {!errors.email && emailHint ? <Text style={styles.fieldHint}>{emailHint}</Text> : null}

      {showPhone ? (
        <>
          <Text style={styles.label}>Teléfono</Text>
          <View style={[styles.input, errors.phone && styles.inputError]}>
            <TextInput
              value={draft.phone}
              onChangeText={(v) => onChange({ phone: v })}
              placeholder="600 000 000"
              placeholderTextColor={c.textFaint}
              style={styles.inputField}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>
          {err('phone')}
        </>
      ) : null}
    </View>
  );
};
