import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import type {
  PrizeEntry,
  PrizeItem,
  PrizeItemType,
  InfoRow,
} from '@core/services/tournaments';

const ITEM_TYPES: { key: PrizeItemType; label: string }[] = [
  { key: 'metalico', label: 'Metálico' },
  { key: 'material', label: 'Material' },
  { key: 'otros', label: 'Otros' },
];

const PLACE_SUGGEST = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];

/**
 * Editor estructurado de premios (por posición, con conceptos
 * metálico/material/otros) e información adicional (filas título → detalle) +
 * observaciones libres. Autónomo (usa su propio tema); se reutiliza tanto en
 * la creación como en la edición del torneo.
 */
export const PrizeInfoEditor: React.FC<{
  prizes: PrizeEntry[];
  onPrizes: (next: PrizeEntry[]) => void;
  infoRows: InfoRow[];
  onInfoRows: (next: InfoRow[]) => void;
  observations: string;
  onObservations: (next: string) => void;
}> = ({ prizes, onPrizes, infoRows, onInfoRows, observations, onObservations }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  // ── Premios ──────────────────────────────────────────────────────────────
  const addPlace = () => {
    const place = PLACE_SUGGEST[prizes.length] ?? `${prizes.length + 1}º`;
    onPrizes([...prizes, { place, items: [{ type: 'metalico', amount: null }] }]);
  };
  const setPlace = (i: number, place: string) => {
    const n = [...prizes];
    n[i] = { ...n[i], place };
    onPrizes(n);
  };
  const removePlace = (i: number) => onPrizes(prizes.filter((_, idx) => idx !== i));
  const addItem = (i: number) => {
    const n = [...prizes];
    n[i] = { ...n[i], items: [...n[i].items, { type: 'material', desc: '' }] };
    onPrizes(n);
  };
  const patchItem = (i: number, j: number, patch: Partial<PrizeItem>) => {
    const n = [...prizes];
    const items = [...n[i].items];
    items[j] = { ...items[j], ...patch };
    n[i] = { ...n[i], items };
    onPrizes(n);
  };
  const setItemType = (i: number, j: number, type: PrizeItemType) =>
    patchItem(
      i,
      j,
      type === 'metalico'
        ? { type, amount: null, desc: null }
        : { type, desc: '', amount: null },
    );
  const removeItem = (i: number, j: number) => {
    const n = [...prizes];
    n[i] = { ...n[i], items: n[i].items.filter((_, idx) => idx !== j) };
    onPrizes(n);
  };

  // ── Info adicional ─────────────────────────────────────────────────────────
  const addRow = () => onInfoRows([...infoRows, { label: '', value: '' }]);
  const setRow = (i: number, patch: Partial<InfoRow>) => {
    const n = [...infoRows];
    n[i] = { ...n[i], ...patch };
    onInfoRows(n);
  };
  const removeRow = (i: number) => onInfoRows(infoRows.filter((_, idx) => idx !== i));

  return (
    <View>
      {/* PREMIOS */}
      <Text style={s.label}>🏆 PREMIOS</Text>
      {prizes.length === 0 ? (
        <Text style={s.hint}>Añade una posición (1º, 2º…) y sus premios.</Text>
      ) : null}
      {prizes.map((e, i) => (
        <View key={i} style={s.card}>
          <View style={s.cardHead}>
            <TextInput
              value={e.place}
              onChangeText={(v) => setPlace(i, v)}
              placeholder="1º"
              placeholderTextColor={c.textFaint}
              style={s.placeInput}
              maxLength={16}
            />
            <Pressable onPress={() => removePlace(i)} hitSlop={8}>
              <Text style={s.removeX}>Quitar</Text>
            </Pressable>
          </View>

          {e.items.map((it, j) => (
            <View key={j} style={s.itemRow}>
              <View style={s.typeChips}>
                {ITEM_TYPES.map((tp) => {
                  const sel = it.type === tp.key;
                  return (
                    <Pressable
                      key={tp.key}
                      onPress={() => setItemType(i, j, tp.key)}
                      style={[s.typeChip, sel && s.typeChipSel]}
                    >
                      <Text style={[s.typeChipText, sel && s.typeChipTextSel]}>
                        {tp.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.itemValueRow}>
                {it.type === 'metalico' ? (
                  <View style={s.amountBox}>
                    <TextInput
                      value={it.amount != null ? String(it.amount) : ''}
                      onChangeText={(v) => {
                        const clean = v.replace(/[^0-9.,]/g, '').replace(',', '.');
                        patchItem(i, j, {
                          amount: clean ? parseFloat(clean) : null,
                        });
                      }}
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                      style={s.amountInput}
                      keyboardType="decimal-pad"
                      maxLength={7}
                    />
                    <Text style={s.euro}>€</Text>
                  </View>
                ) : (
                  <TextInput
                    value={it.desc ?? ''}
                    onChangeText={(v) => patchItem(i, j, { desc: v })}
                    placeholder={
                      it.type === 'material' ? 'Paleta, bolas, mochila…' : 'Especifica el premio'
                    }
                    placeholderTextColor={c.textFaint}
                    style={s.descInput}
                    maxLength={80}
                  />
                )}
                <Pressable onPress={() => removeItem(i, j)} hitSlop={8} style={s.itemRemove}>
                  <Text style={s.removeXsmall}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable onPress={() => addItem(i)} hitSlop={6}>
            <Text style={s.addInline}>+ Añadir concepto</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addPlace} style={s.addBtn}>
        <Text style={s.addBtnText}>+ Añadir posición</Text>
      </Pressable>

      {/* INFO ADICIONAL */}
      <Text style={[s.label, { marginTop: 22 }]}>ℹ️ INFORMACIÓN ADICIONAL</Text>
      {infoRows.length === 0 ? (
        <Text style={s.hint}>Filas tipo “Bolas → Head Pro” o “Entrega de trofeos → dom 20:00”.</Text>
      ) : null}
      {infoRows.map((r, i) => (
        <View key={i} style={s.infoRow}>
          <TextInput
            value={r.label}
            onChangeText={(v) => setRow(i, { label: v })}
            placeholder="Título"
            placeholderTextColor={c.textFaint}
            style={s.infoLabelInput}
            maxLength={40}
          />
          <TextInput
            value={r.value}
            onChangeText={(v) => setRow(i, { value: v })}
            placeholder="Detalle"
            placeholderTextColor={c.textFaint}
            style={s.infoValueInput}
            maxLength={120}
          />
          <Pressable onPress={() => removeRow(i)} hitSlop={8} style={s.itemRemove}>
            <Text style={s.removeXsmall}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addRow} style={s.addBtn}>
        <Text style={s.addBtnText}>+ Añadir fila</Text>
      </Pressable>

      {/* OBSERVACIONES */}
      <Text style={[s.label, { marginTop: 22 }]}>OTRAS OBSERVACIONES</Text>
      <View style={s.obsBox}>
        <TextInput
          value={observations}
          onChangeText={onObservations}
          placeholder="Cualquier nota extra para los inscritos…"
          placeholderTextColor={c.textFaint}
          style={s.obsInput}
          multiline
          maxLength={500}
        />
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    label: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '600',
      marginBottom: 8,
    },
    hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
    card: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
      gap: 10,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    placeInput: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontWeight: '800',
      paddingVertical: 2,
    },
    removeX: { color: c.error, fontSize: 12.5, fontWeight: '700' },
    itemRow: { gap: 8 },
    typeChips: { flexDirection: 'row', gap: 6 },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgRaised,
    },
    typeChipSel: { backgroundColor: c.accent, borderColor: c.accent },
    typeChipText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    typeChipTextSel: { color: c.textInverse },
    itemValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    amountBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    amountInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 },
    euro: { color: c.textMuted, fontSize: 15, fontWeight: '700' },
    descInput: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    itemRemove: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    removeXsmall: { color: c.textMuted, fontSize: 14, fontWeight: '700' },
    addInline: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 2 },
    addBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
    },
    addBtnText: { color: c.accent, fontSize: 13, fontWeight: '800' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    infoLabelInput: {
      width: 110,
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    infoValueInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    obsBox: {
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      padding: 12,
      minHeight: 84,
    },
    obsInput: { color: c.text, fontSize: 15, minHeight: 60, textAlignVertical: 'top' },
  });
