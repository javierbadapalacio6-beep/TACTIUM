import React from 'react';
import { View, Text, Pressable } from 'react-native';

import type { SignupStyles } from './signupStyles';

/**
 * Abrevia el motivo de `checkCategoryEligibility` para la tarjeta:
 * «Superáis el máximo de 900 puntos de 3ª (sumáis 1100).» → «Máximo 900 pts · sumáis 1100».
 */
export function shortReason(msg: string): string {
  const pts = msg.match(/máximo de (\d+) puntos.*sumáis (\d+)/);
  if (pts) return `Máximo ${pts[1]} pts · sumáis ${pts[2]}`;
  const niv = msg.match(/nivel ≥ (\d+).*sumáis (\d+)/);
  if (niv) return `Nivel mínimo ${niv[1]} · sumáis ${niv[2]}`;
  if (/Indica los puntos/.test(msg)) return 'Faltan los puntos';
  if (/Indica el nivel/.test(msg)) return 'Falta el nivel (liga o circuito)';
  return msg;
}

// Lista de categorías como tarjetas de elección única. Primero las que podéis
// jugar; después las que no, atenuadas, sin poder elegirse y con el motivo.
// `reasons[cat]`: null = podéis jugarla; texto = por qué no.
export const CategoryPicker: React.FC<{
  styles: SignupStyles;
  categories: string[];
  selected: string | null;
  onSelect: (cat: string) => void;
  reasons: Record<string, string | null>;
  details?: Record<string, string | null>;
}> = ({ styles, categories, selected, onSelect, reasons, details }) => {
  const ok = categories.filter((cat) => reasons[cat] == null);
  const no = categories.filter((cat) => reasons[cat] != null);
  return (
    <View style={styles.catList}>
      {[...ok, ...no].map((cat) => {
        const reason = reasons[cat];
        const disabled = reason != null;
        const sel = !disabled && selected === cat;
        const detail = details?.[cat];
        return (
          <Pressable
            key={cat}
            disabled={disabled}
            onPress={() => onSelect(cat)}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel, disabled }}
            style={({ pressed }) => [
              styles.catCard,
              sel && styles.catCardSel,
              disabled && styles.catCardOff,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.radio, sel && styles.radioOn]}>
              {sel ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.catName}>{cat}</Text>
              {disabled ? (
                <Text style={styles.catReason}>{shortReason(reason)}</Text>
              ) : detail ? (
                <Text style={styles.catDetail}>{detail}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};
