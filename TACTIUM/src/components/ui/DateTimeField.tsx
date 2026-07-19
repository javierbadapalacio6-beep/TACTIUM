import React, { useMemo, useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { useColors, useResolvedScheme, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from './BottomSheet';
import { IconCalendar, IconCheck, IconClock } from './Icon';

type Mode = 'date' | 'time';

interface FieldProps {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  allowClear?: boolean;
}

const formatDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
};

const formatTime = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

interface InternalProps extends FieldProps {
  mode: Mode;
  icon: React.ReactNode;
  format: (d: Date) => string;
}

const DateTimeField: React.FC<InternalProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  label,
  minimumDate,
  maximumDate,
  allowClear,
  mode,
  icon,
  format,
}) => {
  const c = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  const openPicker = () => {
    if (disabled) return;
    setDraft(value ?? new Date());
    setOpen(true);
  };

  const onAndroidChange = (event: DateTimePickerEvent, picked?: Date) => {
    setOpen(false);
    if (event.type === 'set' && picked) {
      onChange(picked);
    }
  };

  const onIosChange = (_: DateTimePickerEvent, picked?: Date) => {
    if (picked) setDraft(picked);
  };

  const confirmIos = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={({ pressed }) => [
          styles.field,
          disabled && { opacity: 0.5 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.fieldIcon}>{icon}</View>
        <Text
          style={[
            styles.fieldValue,
            !value && styles.fieldPlaceholder,
            mode === 'time' && { fontFamily: Fonts.mono },
            mode === 'date' && value ? { fontFamily: Fonts.mono } : null,
          ]}
        >
          {value ? format(value) : placeholder ?? 'Seleccionar'}
        </Text>
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          is24Hour
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} scrollable={false}>
          <Text style={styles.sheetEyebrow}>
            {label ?? (mode === 'date' ? 'FECHA' : 'HORA')}
          </Text>
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              onChange={onIosChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant={scheme}
              accentColor={c.accent}
              textColor={c.text}
              locale="es-ES"
              is24Hour
              style={styles.picker}
            />
          </View>
          <View style={styles.actions}>
            {allowClear && value ? (
              <Pressable
                onPress={clear}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.secondaryLabel}>Quitar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={confirmIos}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <IconCheck size={16} color={c.textInverse} />
              <Text style={styles.primaryLabel}>Confirmar</Text>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
};

export const DateField: React.FC<FieldProps> = (props) => {
  const c = useColors();
  return (
    <DateTimeField
      {...props}
      mode="date"
      icon={<IconCalendar size={16} color={c.accent} />}
      format={formatDate}
    />
  );
};

export const TimeField: React.FC<FieldProps> = (props) => {
  const c = useColors();
  return (
    <DateTimeField
      {...props}
      mode="time"
      icon={<IconClock size={16} color={c.accent} />}
      format={formatTime}
    />
  );
};

// ───── Helpers para serializar a string formato Postgres ──────────────

export const dateToIsoDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const dateToIsoTime = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}:00`;
};

export const isoDateToDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const isoTimeToDate = (
  iso: string | null | undefined,
  ref?: Date,
): Date | null => {
  if (!iso) return null;
  const parts = iso.split(':').map(Number);
  if (parts.length < 2) return null;
  const [h, m] = parts;
  const d = ref ? new Date(ref) : new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    field: {
      backgroundColor: c.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fieldIcon: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldValue: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
    },
    fieldPlaceholder: {
      color: c.textFaint,
      fontWeight: '400',
    },
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
      textAlign: 'center',
    },
    pickerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    picker: {
      alignSelf: 'center',
      width: '100%',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flex: 1,
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryBtn: {
      height: 50,
      paddingHorizontal: 18,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
  });
