import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { BottomSheet } from '@components/ui/BottomSheet';
import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import type { AvailabilityMap, AvailabilityStatus } from '@core/services/availability';
import { optionDayLabel, type TimePoll } from '@core/services/timePolls';
import { statusColor } from '@features/availability/components/statusColors';

import type { PollPlayer } from '../hooks/useTimePoll';

interface Props {
  open: boolean;
  onClose: () => void;
  poll: TimePoll;
  players: PollPlayer[];
  /** Voy/Duda/No de la jornada, para cruzarlo con la hora (puede venir vacío). */
  availability: AvailabilityMap;
  /** Opciones más votadas, para resaltarlas. */
  topIds: string[];
}

const STATUS_LABEL: Record<AvailabilityStatus, string> = { yes: 'Voy', maybe: 'Duda', no: 'No' };

/**
 * «Quién ha votado»: una fila por jugador y una columna por hora. Se ve de un
 * vistazo quién puede cada hora, quién dijo que ninguna y quién falta, con su
 * Voy/Duda/No al lado.
 */
export const PollWhoSheet: React.FC<Props> = ({ open, onClose, poll, players, availability, topIds }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const voted = players.filter((p) => !!poll.votes[p.id] && poll.votes[p.id].length > 0);
  const none = players.filter((p) => !!poll.votes[p.id] && poll.votes[p.id].length === 0);
  const pending = players.filter((p) => !poll.votes[p.id]);
  // Quien puede más horas, primero; a igualdad, por nombre.
  const sorted = [...voted].sort(
    (a, b) => poll.votes[b.id].length - poll.votes[a.id].length || a.name.localeCompare(b.name, 'es'),
  );
  const count = (oid: string) => voted.filter((p) => poll.votes[p.id].includes(oid)).length;

  const Status = ({ id }: { id: string }) => {
    const s = availability[id]?.status ?? null;
    return (
      <Text style={[styles.status, { color: statusColor(c, s) }]}>{s ? STATUS_LABEL[s] : '—'}</Text>
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.title}>Quién ha votado</Text>
      <Text style={styles.lede}>
        {voted.length + none.length} de {players.length} han respondido
        {pending.length > 0 ? ` · faltan ${pending.length}` : ''}
      </Text>

      {sorted.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }} />
            {poll.options.map((o) => {
              const [dow, dm] = optionDayLabel(o.date).split(' ');
              const top = topIds.includes(o.id);
              return (
                <View key={o.id} style={[styles.col, top && styles.colTop]}>
                  <Text style={styles.colDay}>
                    {dow} {dm.split('/')[0]}
                  </Text>
                  <Text style={[styles.colTime, top && { color: c.accent }]}>{o.time.slice(0, 5)}</Text>
                </View>
              );
            })}
            <Text style={[styles.status, styles.statusHead]}>Partido</Text>
          </View>
          {sorted.map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              {poll.options.map((o) => {
                const on = poll.votes[p.id].includes(o.id);
                return (
                  <View key={o.id} style={[styles.col, topIds.includes(o.id) && styles.colTop]}>
                    <Text style={[styles.mark, on ? { color: c.accent } : { color: c.textFaint }]}>{on ? '✓' : '·'}</Text>
                  </View>
                );
              })}
              <Status id={p.id} />
            </View>
          ))}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.name, styles.totalLabel]}>Pueden</Text>
            {poll.options.map((o) => (
              <View key={o.id} style={[styles.col, topIds.includes(o.id) && styles.colTop]}>
                <Text style={[styles.total, topIds.includes(o.id) && { color: c.accent }]}>{count(o.id)}</Text>
              </View>
            ))}
            <Text style={[styles.status, styles.statusHead]} />
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Todavía nadie ha marcado ninguna hora.</Text>
      )}

      {none.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Dicen que ninguna les va ({none.length})</Text>
          {none.map((p) => (
            <View key={p.id} style={styles.simpleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Status id={p.id} />
            </View>
          ))}
        </View>
      ) : null}

      {pending.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Sin votar ({pending.length})</Text>
          {pending.map((p) => (
            <View key={p.id} style={styles.simpleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
                {p.hasApp ? '' : ' · sin la app'}
              </Text>
              <Status id={p.id} />
            </View>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    lede: { color: c.textMuted, fontSize: 13.5, marginTop: 4, marginBottom: 14 },
    table: { borderRadius: 12, borderWidth: 1, borderColor: c.hairStrong, overflow: 'hidden' },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: withAlpha(c.accent, 0.05),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairStrong,
    },
    totalRow: { backgroundColor: withAlpha(c.accent, 0.05) },
    name: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
    totalLabel: { color: c.textMuted, fontWeight: '700' },
    col: { width: 52, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
    colTop: { backgroundColor: withAlpha(c.accent, 0.08) },
    colDay: { color: c.textMuted, fontSize: 11 },
    colTime: { color: c.text, fontSize: 12.5, fontWeight: '700', fontFamily: Fonts.mono },
    mark: { fontSize: 16, fontWeight: '700' },
    total: { color: c.text, fontSize: 14, fontWeight: '700', fontFamily: Fonts.mono },
    status: { width: 52, textAlign: 'right', fontSize: 12.5, fontWeight: '700' },
    statusHead: { color: c.textMuted, fontWeight: '600', fontSize: 11 },
    group: { marginTop: 16 },
    groupTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
    simpleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    empty: { color: c.textMuted, fontSize: 13.5, paddingVertical: 12 },
  });
