import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  ImageRecognitionApi,
  PermissionDeniedError,
  openAppSettings,
  type ScannedPlayer,
  type ScannedMatchday,
} from '@core/services/imageRecognition';
import { PTS_MIN, PTS_MAX } from '@core/utils/validation';

import { BottomSheet } from './BottomSheet';
import {
  IconCheck,
  IconTrash,
  IconPlus,
  IconX,
  IconCamera,
  IconImage,
  IconFile,
} from './Icon';

type Mode = 'ranking' | 'calendar';
type Step = 'idle' | 'loading' | 'preview' | 'saving';

type Item =
  | (ScannedPlayer & { _id: string })
  | (ScannedMatchday & { _id: string });

interface BaseProps {
  open: boolean;
  onClose: () => void;
  teamName?: string;
}

interface RankingProps extends BaseProps {
  mode: 'ranking';
  onConfirm: (items: ScannedPlayer[]) => Promise<void>;
}

interface CalendarProps extends BaseProps {
  mode: 'calendar';
  onConfirm: (items: ScannedMatchday[]) => Promise<void>;
}

type Props = RankingProps | CalendarProps;

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const ScanSheet: React.FC<Props> = (props) => {
  const { open, onClose, mode, teamName } = props;
  const [step, setStep] = useState<Step>('idle');
  const [items, setItems] = useState<Item[]>([]);
  // Guard sincrónico contra doble tap: `setStep('loading')` no se aplica
  // hasta el siguiente render, así que dos taps rápidos en el mismo tick
  // ven `step==='idle'` y disparan dos pickers (el segundo cuelga el
  // primero → CTA pillado). El ref se actualiza en el mismo tick.
  const busyRef = useRef(false);

  const reset = () => {
    setStep('idle');
    setItems([]);
    busyRef.current = false;
  };

  const close = () => {
    if (step === 'loading' || step === 'saving') return;
    reset();
    onClose();
  };

  const pickAndScan = async (source: 'camera' | 'library' | 'file') => {
    // Guard sincrónico: si ya hay un picker abierto, ignorar el tap.
    // Tiene que ser ref (no state) porque setStep no se aplica hasta el
    // siguiente render — sin esto, doble tap rápido = doble picker.
    if (busyRef.current) return;
    busyRef.current = true;
    // Cambiamos a 'loading' ANTES de abrir el picker. Eso desmonta el
    // PopoverMenu y monta el BottomSheet con el spinner, de modo que en
    // cuanto el usuario cierra el picker (o incluso mientras está abierto)
    // ya ve el feedback de "Procesando…".
    setStep('loading');
    try {
      const picked =
        source === 'file'
          ? await ImageRecognitionApi.pickFileBase64()
          : await ImageRecognitionApi.pickImageBase64(source);
      if (!picked) {
        // Canceló o no eligió: volvemos al menú compacto.
        setStep('idle');
        return;
      }
      const result =
        mode === 'ranking'
          ? await ImageRecognitionApi.scanRanking(picked.base64, picked.mime)
          : await ImageRecognitionApi.scanCalendar(
              picked.base64,
              picked.mime,
              teamName,
            );
      const withIds = result.map((r) => ({ ...r, _id: uid() }));
      if (withIds.length === 0) {
        Alert.alert(
          'Sin resultados',
          source === 'file'
            ? 'No se han podido extraer datos del archivo. Prueba con un PDF o imagen más nítida.'
            : 'No se han podido extraer datos. Prueba con una foto más nítida.',
        );
        setStep('idle');
        return;
      }
      setItems(withIds);
      setStep('preview');
    } catch (e: any) {
      setStep('idle');
      // Permiso denegado: oferta de ir a Ajustes del OS en vez de toast
      // genérico que no resuelve nada. Si el user lo deniega definitivamente
      // ("No volver a preguntar" en Android), launch*Async ya no muestra
      // el system prompt — sólo desde Ajustes.
      if (e instanceof PermissionDeniedError) {
        const labelOf = e.kind === 'camera' ? 'cámara' : 'galería';
        Alert.alert(
          `Sin acceso a ${labelOf}`,
          `Necesitamos acceso a la ${labelOf} para escanear. Puedes activarlo en los Ajustes del dispositivo.`,
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Abrir Ajustes',
              onPress: () => {
                openAppSettings().catch(() => {
                  /* fallback inocuo */
                });
              },
            },
          ],
        );
        return;
      }
      Alert.alert(
        source === 'file' ? 'Error al procesar archivo' : 'Error al procesar imagen',
        e?.message ?? 'Error desconocido',
      );
    } finally {
      // Siempre liberar el lock: cancelación, éxito, error, permiso
      // denegado, lo que sea. Sin esto un picker fallido dejaría el ref
      // bloqueado y los siguientes taps no harían nada.
      busyRef.current = false;
    }
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems((list) => list.map((it) => (it._id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((list) => list.filter((it) => it._id !== id));
  };

  const addEmpty = () => {
    if (mode === 'ranking') {
      setItems((list) => [
        ...list,
        { _id: uid(), name: '', pts: 0 } as Item,
      ]);
    } else {
      setItems((list) => [
        ...list,
        { _id: uid(), opponent: '', is_home: true } as Item,
      ]);
    }
  };

  const confirm = async () => {
    if (items.length === 0) return;
    setStep('saving');
    try {
      // Sanitize antes de mandar: trim de nombres, clamp de pts, filtramos
      // filas vacías. Evita basura en DB cuando el OCR deja celdas sueltas
      // o el user edita y deja inputs en blanco.
      const sanitized = items.map(({ _id, ...rest }) => rest);
      if (mode === 'ranking') {
        const players = (sanitized as ScannedPlayer[])
          .map((p) => ({
            ...p,
            name: p.name.trim().replace(/\s+/g, ' '),
            pts:
              p.pts != null
                ? Math.min(Math.max(p.pts, PTS_MIN), PTS_MAX)
                : undefined,
          }))
          .filter((p) => p.name.length >= 2);
        await (props as RankingProps).onConfirm(players);
      } else {
        const matchdays = (sanitized as ScannedMatchday[])
          .map((m) => ({
            ...m,
            opponent: m.opponent.trim().replace(/\s+/g, ' '),
          }))
          .filter((m) => m.opponent.length >= 2);
        await (props as CalendarProps).onConfirm(matchdays);
      }
      reset();
      onClose();
    } catch (e: any) {
      setStep('preview');
      Alert.alert('Error al guardar', e?.message ?? 'Error desconocido');
    }
  };

  const title =
    mode === 'ranking' ? 'Escanear ranking' : 'Escanear calendario';
  const eyebrow = mode === 'ranking' ? 'JUGADORES · OCR' : 'JORNADAS · OCR';

  // En modo preview hay un CTA principal "Crear N jugadores/jornadas" que
  // siempre debe estar visible aunque la lista de filas crezca. Lo colocamos
  // en el `footer` sticky del BottomSheet.
  const inPreview = (step === 'preview' || step === 'saving') && items.length > 0;

  return (
    <BottomSheet
      open={open}
      onClose={close}
      footer={
        inPreview ? (
          <Pressable
            onPress={confirm}
            disabled={step === 'saving' || items.length === 0}
            style={({ pressed }) => [
              styles.confirmBtn,
              (step === 'saving' || items.length === 0) && { opacity: 0.4 },
              pressed && step !== 'saving' && { opacity: 0.85 },
            ]}
          >
            {step === 'saving' ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <IconCheck size={16} color={Colors.textInverse} />
                <Text style={styles.confirmBtnLabel}>
                  {mode === 'ranking'
                    ? `Crear ${items.length} jugadores`
                    : `Crear ${items.length} jornadas`}
                </Text>
              </>
            )}
          </Pressable>
        ) : undefined
      }
    >
      {/* Header al estilo Claude mobile: X cerrar a la izquierda, título
          centrado. Spacer transparente a la derecha (mismo ancho que el
          botón X) para que el título quede ópticamente centrado. */}
      <View style={styles.idleHeader}>
        <Pressable onPress={close} hitSlop={8} style={styles.closeBtn}>
          <IconX size={14} color={Colors.text} />
        </Pressable>
        <Text style={styles.idleTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === 'idle' ? (
        <View style={styles.sourceRow}>
          <Pressable
            onPress={() => pickAndScan('camera')}
            accessibilityRole="button"
            accessibilityLabel="Hacer foto con la cámara"
            style={({ pressed }) => [
              styles.sourceCard,
              pressed && { backgroundColor: Colors.accent10 },
            ]}
          >
            <IconCamera size={20} color={Colors.accent} />
            <Text style={styles.sourceCardLabel}>Cámara</Text>
          </Pressable>
          <Pressable
            onPress={() => pickAndScan('library')}
            accessibilityRole="button"
            accessibilityLabel="Elegir de la galería"
            style={({ pressed }) => [
              styles.sourceCard,
              pressed && { backgroundColor: Colors.accent10 },
            ]}
          >
            <IconImage size={20} color={Colors.accent} />
            <Text style={styles.sourceCardLabel}>Galería</Text>
          </Pressable>
          <Pressable
            onPress={() => pickAndScan('file')}
            accessibilityRole="button"
            accessibilityLabel="Elegir archivo PDF o imagen"
            style={({ pressed }) => [
              styles.sourceCard,
              pressed && { backgroundColor: Colors.accent10 },
            ]}
          >
            <IconFile size={20} color={Colors.accent} />
            <Text style={styles.sourceCardLabel}>Archivo</Text>
            <Text style={styles.sourceCardHint}>PDF</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'loading' ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={styles.loaderText}>Procesando…</Text>
          <Text style={styles.loaderHint}>Suele tardar 2–5 segundos.</Text>
        </View>
      ) : null}

      {inPreview ? (
        <>
          <Text style={styles.previewHint}>
            Revisa y corrige antes de guardar. Borra filas que no quieras.
          </Text>
          <View style={styles.previewList}>
            {items.map((it) =>
              mode === 'ranking' ? (
                <PlayerRow
                  key={it._id}
                  item={it as ScannedPlayer & { _id: string }}
                  onChange={(patch) => updateItem(it._id, patch)}
                  onRemove={() => removeItem(it._id)}
                />
              ) : (
                <MatchdayRow
                  key={it._id}
                  item={it as ScannedMatchday & { _id: string }}
                  onChange={(patch) => updateItem(it._id, patch)}
                  onRemove={() => removeItem(it._id)}
                />
              ),
            )}
          </View>

          <Pressable
            onPress={addEmpty}
            style={({ pressed }) => [
              styles.addRowBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <IconPlus size={14} color={Colors.textMuted} />
            <Text style={styles.addRowLabel}>Añadir fila</Text>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
  );
};

// ─── PlayerRow ─────────────────────────────────────────────────────────────
const POSITIONS: Array<'Drive' | 'Revés' | 'Ambos'> = ['Drive', 'Revés', 'Ambos'];

const PlayerRow: React.FC<{
  item: ScannedPlayer & { _id: string };
  onChange: (patch: Partial<ScannedPlayer>) => void;
  onRemove: () => void;
}> = ({ item, onChange, onRemove }) => {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <TextInput
          value={item.name}
          onChangeText={(v) => onChange({ name: v })}
          placeholder="Nombre"
          placeholderTextColor={Colors.textFaint}
          style={[styles.input, styles.inputName]}
        />
        <TextInput
          value={item.pts != null ? String(item.pts) : ''}
          onChangeText={(v) => {
            const sanitized = v.replace(/[^0-9]/g, '').slice(0, 6);
            onChange({ pts: sanitized === '' ? 0 : Number(sanitized) });
          }}
          placeholder="pts"
          placeholderTextColor={Colors.textFaint}
          keyboardType="number-pad"
          style={[styles.input, styles.inputPts]}
        />
      </View>
      <View style={styles.posRow}>
        {POSITIONS.map((p) => {
          const sel = item.position === p;
          return (
            <Pressable
              key={p}
              onPress={() => onChange({ position: p })}
              style={[
                styles.posPill,
                sel && {
                  backgroundColor: Colors.accent10,
                  borderColor: Colors.accent50,
                },
              ]}
            >
              <Text
                style={[
                  styles.posPillText,
                  { color: sel ? Colors.accent : Colors.textMuted },
                ]}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={onRemove} hitSlop={6} style={styles.rowDelete}>
          <IconTrash size={14} color={Colors.error} />
        </Pressable>
      </View>
    </View>
  );
};

// ─── MatchdayRow ───────────────────────────────────────────────────────────
const MatchdayRow: React.FC<{
  item: ScannedMatchday & { _id: string };
  onChange: (patch: Partial<ScannedMatchday>) => void;
  onRemove: () => void;
}> = ({ item, onChange, onRemove }) => {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <TextInput
          value={item.opponent}
          onChangeText={(v) => onChange({ opponent: v })}
          placeholder="Rival"
          placeholderTextColor={Colors.textFaint}
          style={[styles.input, styles.inputName]}
        />
      </View>
      <View style={styles.posRow}>
        <TextInput
          value={item.match_date ?? ''}
          onChangeText={(v) => onChange({ match_date: v || undefined })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textFaint}
          style={[styles.input, styles.inputDate]}
        />
        <TextInput
          value={item.match_time ?? ''}
          onChangeText={(v) => onChange({ match_time: v || undefined })}
          placeholder="HH:MM"
          placeholderTextColor={Colors.textFaint}
          style={[styles.input, styles.inputTime]}
        />
        <Pressable
          onPress={() => onChange({ is_home: !item.is_home })}
          style={[
            styles.venuePill,
            item.is_home && {
              backgroundColor: Colors.accent10,
              borderColor: Colors.accent50,
            },
          ]}
        >
          <Text
            style={[
              styles.venuePillText,
              { color: item.is_home ? Colors.accent : Colors.textMuted },
            ]}
          >
            {item.is_home ? 'CASA' : 'FUERA'}
          </Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={6} style={styles.rowDelete}>
          <IconTrash size={14} color={Colors.error} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  // Header del sheet estilo Claude mobile: X cerrar (izq) + título centrado.
  idleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Spacer transparente del mismo ancho que el botón X para que el title
  // quede centrado pero sin el redondel visible.
  headerSpacer: {
    width: 32,
    height: 32,
  },
  idleTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Grid de 2 cards horizontales con icono grande arriba + label debajo.
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  sourceCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sourceCardLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sourceCardHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 9,
    letterSpacing: 0.4,
  },

  loaderBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loaderHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  previewHint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  previewList: {
    gap: 8,
  },

  row: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 10,
    gap: 8,
  },
  rowMain: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: Colors.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  inputName: { flex: 2, minWidth: 0 },
  inputPts: { width: 72, fontFamily: Fonts.mono, textAlign: 'center' },
  inputDate: { flex: 1.6, fontFamily: Fonts.mono },
  inputTime: { width: 70, fontFamily: Fonts.mono, textAlign: 'center' },

  posRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  posPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hair,
    backgroundColor: Colors.bgRaised,
  },
  posPillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  venuePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hair,
    backgroundColor: Colors.bgRaised,
  },
  venuePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowDelete: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  addRowBtn: {
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addRowLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },

  confirmBtn: {
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  confirmBtnLabel: {
    color: Colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
