import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, Toggle, IconBolt, IconCheck, IconAlert } from '@components/ui';
import type { LineupOption } from '@core/utils/lineupGenerator';
import type { LineupVariant } from '@core/services/lineupVariants';
import type { Player } from '@store/teamStore';

import { fmtPts } from './lineupLogic';

const lastName = (p: Player | undefined | null) => {
  if (!p) return '—';
  const parts = p.name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

// ── Generar ────────────────────────────────────────────────────────
interface GenerateProps {
  open: boolean;
  onClose: () => void;
  options: LineupOption[];
  playerById: Map<string, Player>;
  usePosition: boolean;
  onUsePosition: (v: boolean) => void;
  includeMaybe: boolean;
  onIncludeMaybe: (v: boolean) => void;
  maybeCount: number;
  goersCount: number;
  /** Nadie ha contestado: se usa la disponibilidad general. */
  noReplies: boolean;
  chemistryLine: (opt: LineupOption) => string | null;
  onUse: (opt: LineupOption) => void;
}

export const GenerateSheet: React.FC<GenerateProps> = ({
  open,
  onClose,
  options,
  playerById,
  usePosition,
  onUsePosition,
  includeMaybe,
  onIncludeMaybe,
  maybeCount,
  goersCount,
  noReplies,
  chemistryLine,
  onUse,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>GENERAR CON LOS QUE VAN</Text>
      <Text style={styles.title}>Elige cómo armarla</Text>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.toggleLabel}>Emparejar drive y revés</Text>
          <Text style={styles.toggleHint}>Si lo quitas, empareja solo por puntos</Text>
        </View>
        <Toggle value={usePosition} onChange={onUsePosition} size="sm" />
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        {options.map((opt, idx) => {
          const chem = chemistryLine(opt);
          return (
            <Pressable
              key={opt.key}
              onPress={() => onUse(opt)}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${opt.label}`}
              style={({ pressed }) => [
                styles.opt,
                idx === 0 && styles.optFirst,
                pressed && { opacity: 0.85, borderColor: c.accent50 },
              ]}
            >
              <View style={styles.optHead}>
                <Text style={styles.optLabel}>{opt.label}</Text>
                <View style={[styles.pill, idx === 0 && styles.pillOn]}>
                  <Text style={[styles.pillText, idx === 0 && { color: c.accent }]}>Usar</Text>
                </View>
              </View>
              <Text style={styles.optHint}>{chem ? `${opt.hint} · ${chem}` : opt.hint}</Text>
              <View style={{ gap: 2, marginTop: 4 }}>
                {opt.result.slots.map((s) => {
                  const a = s.playerAId ? playerById.get(s.playerAId) : null;
                  const b = s.playerBId ? playerById.get(s.playerBId) : null;
                  const pts = (a?.pts ?? 0) + (b?.pts ?? 0);
                  return (
                    <View key={s.court} style={styles.miniRow}>
                      <Text style={styles.miniText} numberOfLines={1}>
                        {s.court} · {a ? lastName(a) : '—'} / {b ? lastName(b) : '—'}
                      </Text>
                      <Text style={styles.miniPts}>{a && b ? fmtPts(pts) : '—'}</Text>
                    </View>
                  );
                })}
              </View>
              {opt.result.warnings.length > 0 ? (
                <Text style={styles.optWarn} numberOfLines={2}>
                  {opt.result.warnings.join(' · ')}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footLine}>
        {noReplies ? (
          <Text style={styles.footText}>
            Nadie ha contestado aún: se usa la disponibilidad general del equipo.
          </Text>
        ) : (
          <Text style={styles.footText}>
            {includeMaybe ? 'Con los de Voy y Duda' : `Solo con los que han dicho Voy (${goersCount})`}
            {maybeCount > 0 ? ' · ' : ''}
            {maybeCount > 0 ? (
              <Text
                style={styles.footLink}
                onPress={() => onIncludeMaybe(!includeMaybe)}
                accessibilityRole="button"
              >
                {includeMaybe ? 'quitar a los de Duda' : `incluir a los de Duda (${maybeCount})`}
              </Text>
            ) : null}
          </Text>
        )}
      </View>
    </BottomSheet>
  );
};

// ── Publicar ───────────────────────────────────────────────────────
export interface PublishRow {
  court: number;
  label: string;
  pts: number;
  broken: boolean;
}

interface PublishProps {
  open: boolean;
  onClose: () => void;
  jornada: number;
  rows: PublishRow[];
  mustOrder: boolean;
  /** Primera pista que rompe el orden: «La P4 suma más que la P3». */
  breakInfo: { upper: number; lower: number; upperPts: number; lowerPts: number } | null;
  onSort: () => void;
  notify: boolean;
  onNotify: (v: boolean) => void;
  convocados: number;
  busy: boolean;
  done: boolean;
  onPublish: () => void;
}

export const PublishSheet: React.FC<PublishProps> = ({
  open,
  onClose,
  jornada,
  rows,
  mustOrder,
  breakInfo,
  onSort,
  notify,
  onNotify,
  convocados,
  busy,
  done,
  onPublish,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const warn = mustOrder && !!breakInfo;
  return (
    <BottomSheet open={open} onClose={onClose}>
      {done ? (
        <View style={styles.doneWrap}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneCheck}>
            <IconCheck size={28} color={c.textInverse} />
          </Animated.View>
          <Text style={styles.title}>Publicada</Text>
          <Text style={styles.toggleHint}>
            {notify ? 'El equipo recibe el aviso ahora.' : 'Sin aviso al equipo.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.eyebrow}>PUBLICAR</Text>
          <Text style={styles.title}>Alineación de la J{jornada}</Text>

          {warn && breakInfo ? (
            <View style={styles.ctx}>
              <IconAlert size={16} color={c.warning} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.ctxTitle}>
                  La P{breakInfo.lower} suma más que la P{breakInfo.upper}
                </Text>
                <Text style={styles.ctxBody}>
                  {fmtPts(breakInfo.lowerPts)} frente a {fmtPts(breakInfo.upperPts)} · la
                  federación puede rechazar el acta
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ gap: 3, paddingVertical: 4 }}>
            {rows.map((r) => (
              <View key={r.court} style={styles.miniRow}>
                <Text
                  style={[styles.miniText, warn && r.broken && { color: c.warning }]}
                  numberOfLines={1}
                >
                  {r.court} · {r.label}
                </Text>
                <Text style={[styles.miniPts, warn && r.broken && { color: c.warning }]}>
                  {fmtPts(r.pts)}
                </Text>
              </View>
            ))}
          </View>

          {warn ? (
            <Pressable
              onPress={onSort}
              style={({ pressed }) => [styles.ghostSm, pressed && { opacity: 0.8 }]}
            >
              <IconBolt size={12} color={c.accent} />
              <Text style={styles.ghostSmText}>Ordenar por puntos</Text>
            </Pressable>
          ) : null}

          <View style={[styles.toggleRow, styles.toggleTop]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.toggleLabel}>Avisar al equipo</Text>
              <Text style={styles.toggleHint}>
                {convocados > 0
                  ? `A los ${convocados} convocados les llega «Ya está la alineación»`
                  : 'A la plantilla le llega «Ya está la alineación»'}
              </Text>
            </View>
            <Toggle value={notify} onChange={onNotify} size="sm" />
          </View>

          <Pressable
            onPress={onPublish}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              warn ? styles.ctaWarn : null,
              (pressed || busy) && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.ctaText, warn && { color: c.warning }]}>
              {busy ? 'Publicando…' : warn ? 'Publicar igualmente' : 'Publicar'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={6} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={styles.linkMuted}>Seguir editando</Text>
          </Pressable>
        </>
      )}
    </BottomSheet>
  );
};

// ── Menú ⋯ ─────────────────────────────────────────────────────────
interface MoreProps {
  open: boolean;
  onClose: () => void;
  variant: LineupVariant | null;
  canAddVariant: boolean;
  autoSort: boolean;
  onAutoSort: (v: boolean) => void;
  filledCount: number;
  onMarkOfficial: () => void;
  onDuplicate: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onFill: () => void;
  onClear: () => void;
}

export const LineupMoreSheet: React.FC<MoreProps> = ({
  open,
  onClose,
  variant,
  canAddVariant,
  autoSort,
  onAutoSort,
  filledCount,
  onMarkOfficial,
  onDuplicate,
  onRename,
  onDelete,
  onFill,
  onClear,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open) setRenaming(false);
  }, [open]);

  const Item: React.FC<{ label: string; danger?: boolean; onPress: () => void; disabled?: boolean }> = ({
    label,
    danger,
    onPress,
    disabled,
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.accent10 }, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.itemText, danger && { color: c.error }]}>{label}</Text>
    </Pressable>
  );

  return (
    <BottomSheet open={open} onClose={onClose}>
      {variant ? (
        <>
          <Text style={styles.eyebrow}>
            {variant.is_active ? '★ ' : ''}
            {variant.label.toUpperCase()}
          </Text>
          {renaming ? (
            <View style={{ gap: 8, marginBottom: 8 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Con Ana fuera, Plan B…"
                placeholderTextColor={c.textFaint}
                style={styles.input}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={() => name.trim() && onRename(name.trim())}
              />
              <Pressable
                onPress={() => name.trim() && onRename(name.trim())}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>Guardar nombre</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.group}>
              {!variant.is_active ? <Item label="★  Marcar oficial" onPress={onMarkOfficial} /> : null}
              <Item label="Duplicar" onPress={onDuplicate} disabled={!canAddVariant} />
              <Item
                label="Renombrar"
                onPress={() => {
                  setName(variant.label);
                  setRenaming(true);
                }}
              />
              {!variant.is_active ? <Item label="Eliminar variante" danger onPress={onDelete} /> : null}
            </View>
          )}
        </>
      ) : null}

      <Text style={[styles.eyebrow, { marginTop: 10 }]}>ALINEACIÓN</Text>
      <View style={styles.group}>
        <View style={[styles.item, styles.itemRow]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.itemText}>Ordenar por puntos solo</Text>
            <Text style={styles.toggleHint}>Al mover a alguien, las parejas se recolocan</Text>
          </View>
          <Toggle value={autoSort} onChange={onAutoSort} size="sm" />
        </View>
        <Item label="Rellenar con los que van" onPress={onFill} />
        <Item label="Vaciar alineación" danger onPress={onClear} disabled={filledCount === 0} />
      </View>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.2,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 4,
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginBottom: 10,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    toggleTop: { borderTopWidth: 1, borderTopColor: c.hair, marginTop: 8 },
    toggleLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    toggleHint: { color: c.textFaint, fontSize: 12, marginTop: 2 },
    opt: {
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 4,
    },
    optFirst: { borderColor: c.accent40 },
    optHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    optLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    optHint: { color: c.textFaint, fontSize: 12 },
    optWarn: { color: c.warning, fontSize: 11.5, marginTop: 4 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    pillOn: { borderColor: c.accent40, backgroundColor: c.accent10 },
    pillText: { color: c.textMuted, fontSize: 11.5, fontWeight: '700' },
    miniRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    miniText: { flex: 1, color: c.textMuted, fontSize: 12.5 },
    miniPts: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 12 },
    footLine: { paddingTop: 12, alignItems: 'center' },
    footText: { color: c.textFaint, fontSize: 12, textAlign: 'center' },
    footLink: { color: c.accent, fontWeight: '700' },
    ctx: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: 'rgba(242,201,76,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(242,201,76,0.45)',
      marginBottom: 6,
    },
    ctxTitle: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    ctxBody: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    ghostSm: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      marginTop: 4,
    },
    ghostSmText: { color: c.text, fontSize: 13, fontWeight: '600' },
    cta: {
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    ctaWarn: {
      backgroundColor: 'rgba(242,201,76,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(242,201,76,0.45)',
    },
    ctaText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    linkMuted: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    doneWrap: { alignItems: 'center', gap: 6, paddingVertical: 18 },
    doneCheck: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    group: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
      overflow: 'hidden',
    },
    item: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hair,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemText: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    input: {
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      color: c.text,
      paddingHorizontal: 14,
      fontSize: 15,
    },
  });
