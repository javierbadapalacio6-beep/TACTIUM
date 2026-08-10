import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import { useTeamStore } from '@store/teamStore';
import {
  searchFcpClubs,
  type FcpClubGroup,
  type FcpTeamOption,
} from '@core/services/fcpOnboarding';
import {
  computeSeasonDiff,
  applySeasonUpdate,
  type SeasonDiff,
} from '@core/services/fcpSeason';

/**
 * Prepara una NUEVA temporada de la Federación: el capitán busca su equipo en la
 * liga nueva, ve el diff (nuevos / siguen / se van / vuelven / manuales) y
 * confirma. Nunca borra: a los que se van los desactiva (recuperables).
 */
const normName = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const FcpSeasonUpdateSheet: React.FC<{
  open: boolean;
  teamId: string;
  teamName?: string | null;
  // Género del equipo TACTIUM ('masculino' | 'femenino' | 'mixto'). Se usa para
  // no confundir equipos homónimos de distinto género (p. ej. "MEDIO CUDEYO C"
  // existe en masculino y femenino). Para 'mixto' o sin dato, no se filtra.
  teamGender?: string | null;
  onClose: () => void;
  onDone?: () => void;
}> = ({ open, teamId, teamName, teamGender, onClose, onDone }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const loadForUser = useTeamStore((s) => s.loadForUser);

  const [loading, setLoading] = useState(false);
  const [allGroups, setAllGroups] = useState<FcpClubGroup[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FcpTeamOption | null>(null);
  const [diff, setDiff] = useState<SeasonDiff | null>(null);
  const [computing, setComputing] = useState(false);
  const [applying, setApplying] = useState(false);

  // Género a exigir en los candidatos FCP. Solo filtra si el equipo es
  // masculino o femenino (no 'mixto' ni desconocido), porque la FCP solo tiene
  // esos dos géneros.
  const wantGender =
    teamGender === 'femenino' || teamGender === 'masculino' ? teamGender : null;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPicked(null);
    setDiff(null);
    setLoading(true);
    searchFcpClubs('')
      .then((groups) => {
        setAllGroups(groups);
        // Heredar: auto-detecta tu equipo por nombre Y género (prefiere la liga
        // más nueva). Sin el filtro de género, un homónimo del otro género
        // (p. ej. "MEDIO CUDEYO C" masc vs fem) podía auto-seleccionarse mal.
        const flat = groups.flatMap((gr) => gr.teams);
        const matches = flat.filter(
          (t) =>
            normName(t.equipo) === normName(teamName) &&
            (!wantGender || t.gender === wantGender),
        );
        if (matches.length) {
          const best = [...matches].sort((a, b) => (b.id_liga ?? 0) - (a.id_liga ?? 0))[0];
          void pick(best);
        }
      })
      .catch((e) => toast.error('No se pudo cargar el catálogo', e?.message ?? ''))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const flat = allGroups
      .flatMap((g) => g.teams)
      // Solo candidatos del mismo género que el equipo (evita mezclar masc/fem).
      .filter((t) => !wantGender || t.gender === wantGender);
    return (q ? flat.filter((t) => t.equipo.toLowerCase().includes(q)) : flat).slice(0, 60);
  }, [allGroups, query, wantGender]);

  const pick = async (t: FcpTeamOption) => {
    setPicked(t);
    setDiff(null);
    setComputing(true);
    try {
      const d = await computeSeasonDiff(teamId, t.id_equipo);
      setDiff(d);
    } catch (e: any) {
      toast.error('No se pudo calcular el cambio', e?.message ?? '');
      setPicked(null);
    } finally {
      setComputing(false);
    }
  };

  const apply = async () => {
    if (!picked || !diff) return;
    setApplying(true);
    try {
      const res = await applySeasonUpdate(teamId, picked.id_equipo, diff, picked.category, null);
      await loadForUser();
      toast.success(
        'Temporada preparada',
        `+${res.added} nuevos · ${res.deactivated} desactivados · ${res.reactivated} reactivados.`,
      );
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo aplicar', e?.message ?? '');
    } finally {
      setApplying(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        picked && diff ? (
          <Pressable
            onPress={apply}
            disabled={applying}
            style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]}
          >
            {applying ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <Text style={styles.applyBtnText}>Aplicar cambios</Text>
            )}
          </Pressable>
        ) : undefined
      }
    >
      <Text style={styles.eyebrow}>NUEVA TEMPORADA · FEDERACIÓN</Text>
      <Text style={styles.title}>{picked ? picked.equipo : 'Preparar temporada'}</Text>

      {!picked ? (
        <>
          <Text style={styles.sub}>
            Busca tu equipo en la temporada nueva. Compararemos su plantilla con la
            actual y verás qué cambia antes de aplicar nada.
          </Text>
          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Busca tu equipo (p. ej. Smash Padel A)"
              placeholderTextColor={c.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          {loading ? (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>
              {allGroups.length === 0
                ? 'Aún no hay datos de la Federación cargados.'
                : 'Sin resultados. Prueba otro nombre.'}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320, marginTop: 10 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {filtered.map((t) => (
                  <Pressable
                    key={t.id_equipo}
                    onPress={() => pick(t)}
                    style={({ pressed }) => [styles.teamRow, pressed && { opacity: 0.85 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.teamName} numberOfLines={1}>{t.equipo}</Text>
                      <Text style={styles.teamMeta} numberOfLines={1}>
                        {t.gender === 'femenino' ? 'Femenino' : 'Masculino'}
                        {t.category ? ` · ${t.category}` : ''}
                        {t.grupo ? ` · ${t.grupo}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </>
      ) : computing ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator color={c.accent} />
          <Text style={[styles.teamMeta, { marginTop: 10 }]}>Calculando cambios…</Text>
        </View>
      ) : diff ? (
        <>
          <Pressable onPress={() => { setPicked(null); setDiff(null); }} hitSlop={6}>
            <Text style={styles.back}>‹ Elegir otro equipo</Text>
          </Pressable>

          {/* Resumen de un vistazo */}
          <View style={styles.summaryRow}>
            <SummaryPill n={diff.toAdd.length} label="nuevos" color={c.accent} styles={styles} />
            <SummaryPill n={diff.toReactivate.length} label="vuelven" color={c.accent} styles={styles} />
            <SummaryPill n={diff.leaving.length} label="se van" color={c.error} styles={styles} />
            <SummaryPill
              n={diff.continuing.length + diff.manual.length}
              label="siguen"
              color={c.textMuted}
              styles={styles}
            />
          </View>

          <Text style={styles.sub}>
            Nada se borra: a los que se van los desactivamos (recuperables). Revisa y aplica.
          </Text>

          <DiffBlock
            title="Nuevos"
            hint="se añaden"
            color={c.accent}
            items={diff.toAdd.map((p) => ({ name: p.name, right: `${p.puntos} pts` }))}
            styles={styles}
          />
          <DiffBlock
            title="Vuelven"
            hint="se reactivan"
            color={c.accent}
            items={diff.toReactivate.map((p) => ({ name: p.name }))}
            styles={styles}
          />
          <DiffBlock
            title="Ya no están"
            hint="se desactivan"
            color={c.error}
            items={diff.leaving.map((p) => ({ name: p.name, right: p.claimed ? 'cuenta' : undefined }))}
            styles={styles}
          />
          <DiffBlock
            title="Continúan"
            color={c.textMuted}
            items={diff.continuing.map((p) => ({ name: p.name }))}
            styles={styles}
          />
          <DiffBlock
            title="Manuales"
            hint="intactos"
            color={c.textMuted}
            items={diff.manual.map((p) => ({ name: p.name }))}
            styles={styles}
          />
        </>
      ) : null}
    </BottomSheet>
  );
};

// Píldora de resumen (arriba del diff): "3 nuevos", "1 se van"…
const SummaryPill: React.FC<{
  n: number;
  label: string;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}> = ({ n, label, color, styles }) => (
  <View style={[styles.sumPill, { borderColor: color + '40', backgroundColor: color + '12' }]}>
    <Text style={[styles.sumN, { color }]}>{n}</Text>
    <Text style={styles.sumLabel}>{label}</Text>
  </View>
);

type DiffItem = { name: string; right?: string };

// Tarjeta de un grupo del diff: cabecera con dot de color + título + count, y
// filas de jugador con avatar (inicial) y una etiqueta opcional a la derecha
// (puntos, "cuenta"…). No se pinta si el grupo está vacío.
const DiffBlock: React.FC<{
  title: string;
  hint?: string;
  color: string;
  items: DiffItem[];
  styles: ReturnType<typeof makeStyles>;
}> = ({ title, hint, color, items, styles }) => {
  if (items.length === 0) return null;
  return (
    <View style={[styles.diffCard, { borderColor: color + '33' }]}>
      <View style={styles.diffHead}>
        <View style={[styles.diffDot, { backgroundColor: color }]} />
        <Text style={[styles.diffTitle, { color }]} numberOfLines={1}>
          {title}
          {hint ? <Text style={styles.diffHint}>{`  ·  ${hint}`}</Text> : null}
        </Text>
        <View
          style={[styles.diffCount, { backgroundColor: color + '1A', borderColor: color + '40' }]}
        >
          <Text style={[styles.diffCountText, { color }]}>{items.length}</Text>
        </View>
      </View>
      <View style={{ marginTop: 10, gap: 6 }}>
        {items.map((it, i) => (
          <View key={i} style={styles.playerRow}>
            <View
              style={[styles.playerAvatar, { borderColor: color + '55', backgroundColor: color + '14' }]}
            >
              <Text style={[styles.playerInitial, { color }]}>
                {it.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.playerName} numberOfLines={1}>
              {it.name}
            </Text>
            {it.right ? (
              <Text style={[styles.playerRight, { color }]} numberOfLines={1}>
                {it.right}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
    sub: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
    back: { color: c.accent, fontSize: 13.5, fontWeight: '700', marginTop: 8 },
    searchBox: {
      marginTop: 14,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    searchInput: { color: c.text, fontSize: 15, paddingVertical: 13 },
    empty: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 18 },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    teamName: { color: c.text, fontSize: 15, fontWeight: '700' },
    teamMeta: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    chev: { color: c.textFaint, fontSize: 20, fontWeight: '700' },

    // Resumen (píldoras arriba del diff)
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    sumPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    sumN: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '800' },
    sumLabel: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.2 },

    // Tarjeta de grupo del diff
    diffCard: {
      marginTop: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    diffHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    diffDot: { width: 9, height: 9, borderRadius: 999 },
    diffTitle: { flex: 1, fontSize: 13.5, fontWeight: '800', letterSpacing: -0.1 },
    diffHint: { color: c.textFaint, fontSize: 12, fontWeight: '600' },
    diffCount: {
      minWidth: 26,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diffCountText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '800' },
    playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    playerAvatar: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerInitial: { fontSize: 12, fontWeight: '800' },
    playerName: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, fontWeight: '600' },
    playerRight: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '700' },

    applyBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
  });
