import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconCheck, IconChevron } from '@components/ui';
import { useTeamStore, type Team } from '@store/teamStore';
import { toast } from '@store/toastStore';
import { fetchInscripcionGrupo } from '@core/services/fcpInscripciones';
import type { FcpInscripcion, FcpRivalGrupo } from '@core/services/fcpInscripciones';
import { fetchNextMatchdays, shortDate, teamLogoOf } from '@features/team/teamData';
import { TeamCrest } from './TeamCrest';

/* ─────────────────────────────────────────────────────────────────────────
 * Hojas de la pestaña Equipo (rediseño 2026-10):
 *  · RosterMenuSheet  — «Plantilla ▾»: lo que antes eran 5 iconos sin texto.
 *  · TeamSwitchSheet  — cambiar de equipo desde su nombre.
 *  · FederationSheet  — todo lo de la Federación en un sitio.
 * ───────────────────────────────────────────────────────────────────────── */

type MenuItem = {
  key: string;
  glyph: string;
  title: string;
  sub: string;
  pro?: boolean;
  onPress: () => void;
};

export const RosterMenuSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  roster: MenuItem[];
  team: MenuItem[];
}> = ({ open, onClose, roster, team }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const Block = ({ label, items }: { label: string; items: MenuItem[] }) =>
    items.length === 0 ? null : (
      <>
        <Text style={s.section}>{label}</Text>
        <View style={s.list}>
          {items.map((it, i) => (
            <Pressable
              key={it.key}
              onPress={() => {
                onClose();
                // Deja que la hoja termine de bajar antes de abrir la siguiente
                // (dos Modals a la vez se pisan en iOS).
                setTimeout(it.onPress, 320);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.row,
                i < items.length - 1 && s.rowDivider,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={s.glyph}>
                <Text style={s.glyphText}>{it.glyph}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle}>{it.title}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {it.sub}
                </Text>
              </View>
              {it.pro ? (
                <View style={s.pro}>
                  <Text style={s.proText}>PRO</Text>
                </View>
              ) : (
                <IconChevron size={14} color={c.textFaint} />
              )}
            </Pressable>
          ))}
        </View>
      </>
    );
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Block label="Plantilla" items={roster} />
      <Block label="Equipo" items={team} />
    </BottomSheet>
  );
};

export const TeamSwitchSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onJoin: () => void;
}> = ({ open, onClose, onJoin }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((st) => st.team);
  const teams = useTeamStore((st) => st.teams);
  const memberships = useTeamStore((st) => st.memberships);
  const setActiveTeam = useTeamStore((st) => st.setActiveTeam);
  const [next, setNext] = useState<Map<string, { date: string | null; time: string | null; opponent: string }>>(
    new Map(),
  );
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchNextMatchdays(teams.map((t) => t.id))
      .then((m) => {
        if (!alive) return;
        const out = new Map<string, { date: string | null; time: string | null; opponent: string }>();
        m.forEach((md, id) =>
          out.set(id, { date: md.match_date, time: md.match_time, opponent: md.opponent }),
        );
        setNext(out);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, teams]);

  const roleOf = (t: Team) => {
    const m = memberships.find((x) => x.team_id === t.id);
    if (m?.role === 'captain' || m?.role === 'admin') return 'Capitán';
    if (m?.role === 'player') return 'Jugador';
    return t.club_id ? 'Club' : 'Equipo';
  };

  const choose = async (id: string) => {
    if (id === team?.id) {
      onClose();
      return;
    }
    if (switching) return;
    setSwitching(id);
    try {
      await setActiveTeam(id);
      onClose();
    } catch (e: any) {
      toast.error('No se pudo cambiar de equipo', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={s.section}>Tus equipos</Text>
      <View style={s.list}>
        {teams.map((t, i) => {
          const sel = t.id === team?.id;
          const n = next.get(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => choose(t.id)}
              disabled={!!switching}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              style={({ pressed }) => [
                s.row,
                i < teams.length - 1 && s.rowDivider,
                sel && { backgroundColor: c.accent10 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <TeamCrest name={t.name} logo={teamLogoOf(t)} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {[roleOf(t), t.category, t.group_name ? `Grupo ${t.group_name}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {n ? (
                  <Text style={s.next} numberOfLines={1}>
                    Próxima {shortDate(n.date)}
                    {n.time ? ` · ${n.time.slice(0, 5)}` : ''} vs {n.opponent}
                  </Text>
                ) : null}
              </View>
              {switching === t.id ? (
                <ActivityIndicator color={c.accent} />
              ) : sel ? (
                <IconCheck size={16} color={c.accent} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          onClose();
          setTimeout(onJoin, 320);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [s.list, s.row, { marginTop: 12 }, pressed && { opacity: 0.85 }]}
      >
        <View style={s.glyph}>
          <Text style={s.glyphText}>＋</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Unirme a otro equipo</Text>
          <Text style={s.rowSub}>Con el enlace o el código</Text>
        </View>
        <IconChevron size={14} color={c.textFaint} />
      </Pressable>
    </BottomSheet>
  );
};

export const FederationSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  teamName: string;
  canManage: boolean;
  inscripcion: { temporada: string; fila: FcpInscripcion } | null;
  newSeason: boolean;
  signing: boolean;
  resyncing: boolean;
  refreshing: boolean;
  /** «Clasificación y jornadas» es Pro: sin Pro se ve con el distintivo y
   *  `onOpenGroup` (ya pasado por el gate) abre el paywall. */
  groupPro?: boolean;
  onOpenGroup: () => void;
  onPrepareSeason: () => void;
  onResync: () => void;
  onRefresh: () => void;
}> = ({
  open,
  onClose,
  teamName,
  canManage,
  inscripcion,
  newSeason,
  signing,
  resyncing,
  refreshing,
  groupPro = false,
  onOpenGroup,
  onPrepareSeason,
  onResync,
  onRefresh,
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const f = inscripcion?.fila;
  // Rivales del grupo de la temporada que viene. Se piden al abrir la hoja
  // (no con la pantalla): casi nadie la abre y es una consulta más. La clave
  // evita repetirla cada vez que la fila se recrea al refrescar.
  const grupoKey = f?.subgrupo ? `${f.idLiga}|${f.idGrupo}|${f.subgrupo}|${f.idEquipo}` : null;
  const [rivales, setRivales] = useState<{ key: string; rows: FcpRivalGrupo[] } | null>(null);
  useEffect(() => {
    if (!open || !f || !grupoKey || rivales?.key === grupoKey) return;
    let alive = true;
    fetchInscripcionGrupo(f)
      .then((rows) => alive && setRivales({ key: grupoKey, rows }))
      .catch(() => alive && setRivales({ key: grupoKey, rows: [] }));
    return () => {
      alive = false;
    };
  }, [open, grupoKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const rivalesListos = rivales && rivales.key === grupoKey ? rivales.rows : null;
  const after = (fn: () => void) => () => {
    onClose();
    setTimeout(fn, 320);
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={s.eyebrow}>FEDERACIÓN</Text>
      <Text style={s.title}>{teamName} en la Liga Cántabra</Text>

      {inscripcion && f ? (
        <View style={s.inscrip}>
          <Text style={s.inscripTitle}>
            Inscripción {inscripcion.temporada} ·{' '}
            {f.confirmado ? 'confirmada' : 'sin confirmar'}
          </Text>
          <Text style={s.inscripText}>
            {f.categoriaActual && f.categoria && f.categoriaActual !== f.categoria
              ? `Cambias de ${f.categoriaActual} a ${f.categoria}`
              : f.categoria
                ? `Jugarás en ${f.categoria}`
                : 'La Federación aún no publica la categoría'}
            {f.subgrupo ? `, grupo ${f.subgrupo}.` : '.'}
            {f.sedeCorta || f.sede ? ` Sede: ${f.sedeCorta || f.sede}.` : ''}
          </Text>
          {/* Otra letra u otro patrocinador, mismos jugadores: se dice con
              el nombre de la Federación, que es el que saldrá en el
              calendario y en las actas. */}
          {f.estado === 'renombrado' ? (
            <Text style={s.inscripText}>La Federación lo inscribe como {f.equipo}.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[s.list, { marginTop: 14 }]}>
        <Pressable
          onPress={after(onOpenGroup)}
          accessibilityRole="button"
          style={({ pressed }) => [s.row, s.rowDivider, pressed && { opacity: 0.8 }]}
        >
          <View style={s.glyph}>
            <Text style={s.glyphText}>▦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Clasificación y jornadas</Text>
            <Text style={s.rowSub}>
              Tu grupo en la Federación
            </Text>
          </View>
          {groupPro ? (
            <View style={s.pro}>
              <Text style={s.proText}>PRO</Text>
            </View>
          ) : (
            <IconChevron size={14} color={c.textFaint} />
          )}
        </Pressable>
        {canManage && newSeason ? (
          <Pressable
            onPress={after(onPrepareSeason)}
            accessibilityRole="button"
            style={({ pressed }) => [s.row, s.rowDivider, pressed && { opacity: 0.8 }]}
          >
            <View style={s.glyph}>
              <Text style={s.glyphText}>★</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Preparar la temporada nueva</Text>
              <Text style={s.rowSub}>Ya han publicado la liga: trae la plantilla</Text>
            </View>
            <IconChevron size={14} color={c.textFaint} />
          </Pressable>
        ) : null}
        {canManage && signing ? (
          <Pressable
            onPress={onResync}
            disabled={resyncing}
            accessibilityRole="button"
            style={({ pressed }) => [s.row, s.rowDivider, pressed && { opacity: 0.8 }]}
          >
            <View style={s.glyph}>
              <Text style={s.glyphText}>⟳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Revisar fichajes</Text>
              <Text style={s.rowSub}>Ventana abierta hasta fin de 1.ª vuelta</Text>
            </View>
            {resyncing ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <IconChevron size={14} color={c.textFaint} />
            )}
          </Pressable>
        ) : null}
        {f ? (
          <Pressable
            onPress={() => setRosterOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: rosterOpen }}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
          >
            <View style={s.glyph}>
              <Text style={s.glyphText}>≡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Plantilla inscrita · {f.jugadores.length}</Text>
              <Text style={s.rowSub}>Según la Federación</Text>
            </View>
            <View style={{ transform: [{ rotate: rosterOpen ? '90deg' : '0deg' }] }}>
              <IconChevron size={14} color={c.textFaint} />
            </View>
          </Pressable>
        ) : null}
        {f && rosterOpen ? (
          <View style={s.roster}>
            {f.jugadores.length === 0 ? (
              <Text style={s.rowSub}>La Federación todavía no publica jugadores en tu equipo.</Text>
            ) : (
              f.jugadores.map((j, i) => (
                <View key={j.idJugador} style={s.rosterRow}>
                  <Text style={s.rosterNum}>{i + 1}</Text>
                  <Text style={s.rosterName} numberOfLines={1}>
                    {j.nombre}
                  </Text>
                  <Text style={s.rosterPts}>{j.puntos}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
        {/* Tu grupo de la temporada que viene. Solo con grupo asignado: la
            categoría entera (hasta 32 equipos) no son tus rivales. */}
        {f?.subgrupo ? (
          <Pressable
            onPress={() => setGrupoOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: grupoOpen }}
            style={({ pressed }) => [s.row, s.rowTopDivider, pressed && { opacity: 0.8 }]}
          >
            <View style={s.glyph}>
              <Text style={s.glyphText}>{f.subgrupo}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Tu grupo · Grupo {f.subgrupo}</Text>
              <Text style={s.rowSub}>
                {rivalesListos == null
                  ? 'Cargando rivales…'
                  : rivalesListos.length === 1
                    ? '1 rival'
                    : `${rivalesListos.length} rivales`}
              </Text>
            </View>
            <View style={{ transform: [{ rotate: grupoOpen ? '90deg' : '0deg' }] }}>
              <IconChevron size={14} color={c.textFaint} />
            </View>
          </Pressable>
        ) : null}
        {f?.subgrupo && grupoOpen ? (
          <View style={s.roster}>
            {rivalesListos == null ? (
              <ActivityIndicator color={c.accent} style={{ marginVertical: 10 }} />
            ) : rivalesListos.length === 0 ? (
              <Text style={[s.rowSub, { marginTop: 8 }]}>
                La Federación todavía no publica más equipos en tu grupo.
              </Text>
            ) : (
              rivalesListos.map((r, i) => (
                <View key={r.idEquipo} style={s.rosterRow}>
                  <Text style={s.rosterNum}>{i + 1}</Text>
                  <Text style={s.rosterName} numberOfLines={1}>
                    {r.equipo}
                  </Text>
                  {r.sedeCorta ? (
                    <Text style={s.rivalSede} numberOfLines={1}>
                      {r.sedeCorta}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>

      {canManage && f ? (
        <>
          <Text style={s.hint}>
            La Federación se vuelca solo los martes y viernes. «Actualizar» lo hace ahora.
          </Text>
          <Pressable
            onPress={onRefresh}
            disabled={refreshing}
            accessibilityRole="button"
            style={({ pressed }) => [
              s.refresh,
              (pressed || refreshing) && { opacity: 0.7 },
            ]}
          >
            <Text style={s.refreshText}>
              {refreshing ? 'Consultando…' : 'Actualizar desde la Federación'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
    },
    section: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
      marginBottom: 8,
    },
    list: {
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowDivider: { borderBottomWidth: 1, borderColor: c.hair },
    // Para la fila que va DESPUÉS de una que puede desplegarse: el borde va
    // arriba, así separa igual con la lista abierta que cerrada.
    rowTopDivider: { borderTopWidth: 1, borderColor: c.hair },
    glyph: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyphText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    rowTitle: { color: c.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
    rowSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    next: { color: c.accent, fontSize: 12, marginTop: 3, fontWeight: '600' },
    pro: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: c.accent15,
    },
    proText: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    inscrip: {
      marginTop: 14,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
    },
    inscripTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    inscripText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
    roster: { paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 1, borderColor: c.hair },
    rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    rosterNum: { color: c.textFaint, fontSize: 11, width: 18, textAlign: 'center' },
    rosterName: { flex: 1, minWidth: 0, color: c.text, fontSize: 13.5 },
    rosterPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '700' },
    rivalSede: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11.5, maxWidth: 120 },
    hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
    refresh: {
      marginTop: 12,
      height: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshText: { color: c.accent, fontSize: 14, fontWeight: '700' },
  });
