import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, ScrollView } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  Image as SkiaImage,
  Path,
  Rect,
  Text as SkiaText,
  matchFont,
  rect,
  rrect,
  useCanvasRef,
  useImage,
  Skia,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { useTeamStore, type Player } from '@store/teamStore';

// La pizarra se usa como TAB raíz (Pizarra) y ya no como screen anidada, así
// que solo necesita un tipo mínimo de navegación (volver si se puede).
type TacticsNav = { goBack: () => void; canGoBack: () => boolean };

// ── Imagen de pista (render real) + calibración ──────────────────────
// Pistas disponibles (mismo render en distintos colores → misma calibración).
// Cada pista trae su propia calibración (rectángulo de juego en fracciones).
type Frac = { l: number; t: number; r: number; b: number };
type Court = {
  key: string;
  label: string;
  dot: string;
  img: number;
  frac: Frac;
  imgH?: number; // versión horizontal (landscape)
  fracH?: Frac;
};
const OLD_FRAC: Frac = { l: 0.204, t: 0.1328, r: 0.8289, b: 0.8648 };
const COURTS: Court[] = [
  {
    key: 'tactium',
    label: 'TACTIUM',
    dot: '#0B3B2C',
    img: require('../assets/court-tactium.jpg'),
    frac: { l: 0.17, t: 0.11, r: 0.83, b: 0.87 },
    imgH: require('../assets/court-tactium-h.jpg'),
    fracH: { l: 0.11, t: 0.17, r: 0.87, b: 0.83 },
  },
  { key: 'blue', label: 'Azul', dot: '#1E5AA8', img: require('../assets/court-blue.jpg'), frac: OLD_FRAC },
  { key: 'green', label: 'Verde', dot: '#2F8F4E', img: require('../assets/court-green.jpg'), frac: OLD_FRAC },
  { key: 'brown', label: 'Marrón', dot: '#8A5A3B', img: require('../assets/court-brown.jpg'), frac: OLD_FRAC },
  { key: 'pink', label: 'Rosa', dot: '#D46A9F', img: require('../assets/court-pink.jpg'), frac: OLD_FRAC },
];
const IMG_ASPECT = 941 / 1672; // vertical
const IMG_ASPECT_H = 1672 / 941; // horizontal
const BALL_IMG = require('../assets/ball.png');
const BACKDROP = '#33363B'; // relleno del letterbox (tono hormigón)

type TeamSide = 'us' | 'them' | 'ball';

// Fichas: equipo + posición inicial en coords NORMALIZADAS de la pista (0..1).
// La pista vertical: red horizontal en y≈0.5; nuestra pareja abajo (y>0.5).
const TOKENS: { id: string; team: TeamSide; x: number; y: number }[] = [
  { id: 'A1', team: 'us', x: 0.32, y: 0.7 },
  { id: 'A2', team: 'us', x: 0.68, y: 0.7 },
  { id: 'R1', team: 'them', x: 0.32, y: 0.3 },
  { id: 'R2', team: 'them', x: 0.68, y: 0.3 },
  { id: 'B', team: 'ball', x: 0.5, y: 0.55 },
];
const BALL_INDEX = 4;
const INITIAL_NORM = TOKENS.map((t) => ({ x: t.x, y: t.y }));

// Rotación 90° de las posiciones normalizadas al girar la pantalla, para que
// el reparto pase de arriba/abajo (vertical) a izquierda/derecha (horizontal).
const rotFwd = (p: { x: number; y: number }) => ({ x: 1 - p.y, y: p.x });
const rotBack = (p: { x: number; y: number }) => ({ x: p.y, y: 1 - p.x });
// Posiciones iniciales ya rotadas (para reiniciar en horizontal).
const INITIAL_NORM_H = INITIAL_NORM.map(rotFwd);

const US = Colors.accent;
const THEM = '#FF6B6B';
const BALL = '#F2C94C';
const PENCIL_COLORS = ['#FFD23F', '#FFFFFF', '#FF6B6B', '#00DF82', '#4C9AFF', '#0B0B0B'];
const WIDTHS: { key: string; mul: number }[] = [
  { key: 'Fino', mul: 0.006 },
  { key: 'Medio', mul: 0.011 },
  { key: 'Grueso', mul: 0.018 },
];

type Tool = 'move' | 'pencil' | 'eraser';
interface Stroke {
  points: { x: number; y: number }[]; // normalizado
  color: string;
  mul: number;
}
interface CourtRect {
  left: number;
  top: number;
  w: number;
  h: number;
}

const playerUri = (p?: Player): string | null =>
  p ? p.profile_avatar_url || p.photo_url || null : null;
const playerName = (p?: Player): string | null =>
  p ? (p.alias && p.alias.trim() ? p.alias.trim() : p.name) : null;

const MiniAvatar: React.FC<{
  uri: string | null;
  name: string | null;
  size: number;
  ring: string;
}> = ({ uri, name, size, ring }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#0B3B2C',
      borderWidth: 2,
      borderColor: ring,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {uri ? (
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
    ) : (
      <Text style={{ color: '#EAF6F0', fontWeight: '700', fontSize: size * 0.42 }}>
        {name ? name.charAt(0).toUpperCase() : '?'}
      </Text>
    )}
  </View>
);

// ── Dibujo a mano (overlay) ──────────────────────────────────────────
const PencilSkia: React.FC<{
  court: CourtRect;
  strokes: Stroke[];
  liveStroke: SharedValue<{ x: number; y: number }[]>;
  liveColor: string;
  liveMul: number;
}> = ({ court, strokes, liveStroke, liveColor, liveMul }) => {
  const livePath = useDerivedValue(() => {
    const pts = liveStroke.value;
    const path = Skia.Path.Make();
    if (pts.length > 0) {
      path.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    }
    return path;
  });

  const strokeStr = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    let d = `M ${court.left + pts[0].x * court.w} ${court.top + pts[0].y * court.h}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${court.left + pts[i].x * court.w} ${court.top + pts[i].y * court.h}`;
    }
    return d;
  };

  return (
    <Group>
      {strokes.map((st, i) => (
        <Path
          key={i}
          path={strokeStr(st.points)}
          color={st.color}
          style="stroke"
          strokeWidth={Math.max(1.5, court.w * st.mul)}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}
      <Path
        path={livePath}
        color={liveColor}
        style="stroke"
        strokeWidth={Math.max(1.5, court.w * liveMul)}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
};

// ── Ficha arrastrable ─────────────────────────────────────────────────
interface TokenIdentity {
  team: TeamSide;
  name: string | null;
  photoUri: string | null;
}
const DraggableToken: React.FC<{
  identity: TokenIdentity;
  index: number;
  positions: SharedValue<{ x: number; y: number }[]>;
  sLeft: SharedValue<number>;
  sTop: SharedValue<number>;
  sW: SharedValue<number>;
  sH: SharedValue<number>;
  activeIdx: SharedValue<number>;
  rPx: number;
  initialFont: ReturnType<typeof matchFont> | null;
  initialSize: number;
}> = ({
  identity,
  index,
  positions,
  sLeft,
  sTop,
  sW,
  sH,
  activeIdx,
  rPx,
  initialFont,
  initialSize,
}) => {
  const img = useImage(identity.photoUri);
  const ballImg = useImage(BALL_IMG);
  const r = rPx;
  const isBall = identity.team === 'ball';

  const transform = useDerivedValue(() => {
    const p = positions.value[index];
    const grabbed = activeIdx.value === index;
    return [
      { translateX: sLeft.value + p.x * sW.value },
      { translateY: sTop.value + p.y * sH.value },
      { scale: grabbed ? 1.16 : 1 },
    ];
  });

  const ballClip = rrect(rect(-r, -r, r * 2, r * 2), r, r);

  if (isBall) {
    return (
      <Group transform={transform}>
        <Circle cx={0} cy={r * 0.2} r={r} color="rgba(0,0,0,0.45)" />
        {ballImg ? (
          <Group clip={ballClip}>
            <SkiaImage image={ballImg} x={-r} y={-r} width={r * 2} height={r * 2} fit="cover" />
          </Group>
        ) : (
          <Circle cx={0} cy={0} r={r} color="#D7E84B" />
        )}
      </Group>
    );
  }

  const fill =
    identity.team === 'us' ? '#0B3B2C' : identity.team === 'them' ? '#5A1F1F' : BALL;
  const ring =
    identity.team === 'us' ? US : identity.team === 'them' ? THEM : '#C99A12';
  const clip = rrect(rect(-r, -r, r * 2, r * 2), r, r);
  const initial = identity.name ? identity.name.trim().charAt(0).toUpperCase() : '';
  const iw = initial ? initialSize * 0.6 : 0;

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={r * 0.18} r={r} color="rgba(0,0,0,0.5)" />
      <Circle cx={0} cy={0} r={r} color={fill} />
      {img ? (
        <Group clip={clip}>
          <SkiaImage image={img} x={-r} y={-r} width={r * 2} height={r * 2} fit="cover" />
        </Group>
      ) : initial && initialFont ? (
        <SkiaText
          x={-iw / 2}
          y={initialSize * 0.35}
          text={initial}
          font={initialFont}
          color="#EAF6F0"
        />
      ) : null}
      <Circle
        cx={0}
        cy={0}
        r={r}
        color={ring}
        style="stroke"
        strokeWidth={Math.max(2, r * 0.18)}
      />
    </Group>
  );
};

export const TacticsBoardScreen = ({
  navigation,
}: {
  navigation: TacticsNav;
}) => {
  const insets = useSafeAreaInsets();
  const canvasRef = useCanvasRef();
  const [courtIdx, setCourtIdx] = useState(0);
  const [courtPickerOpen, setCourtPickerOpen] = useState(false);

  // La pizarra puede rotar; el resto de la app se queda en vertical.
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync().catch(() => {});
      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      };
    }, []),
  );

  // Rectángulo de imagen (contain-fit) y de la pista dentro de él.
  const [imgRect, setImgRect] = useState<CourtRect | null>(null);
  const [court, setCourt] = useState<CourtRect | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [radP, setRadP] = useState(16);
  const [radB, setRadB] = useState(11);

  // En horizontal usamos la imagen apaisada (si la pista la tiene).
  const landscape = canvasSize.w > canvasSize.h;
  const activeCourt = COURTS[courtIdx];
  const useH = landscape && !!activeCourt.imgH;
  const activeImg = useH ? (activeCourt.imgH as number) : activeCourt.img;
  const activeFrac = useH ? (activeCourt.fracH as Frac) : activeCourt.frac;
  const activeAspect = useH ? IMG_ASPECT_H : IMG_ASPECT;
  const courtImg = useImage(activeImg);

  const positions = useSharedValue(INITIAL_NORM.map((p) => ({ ...p })));
  const sLeft = useSharedValue(0);
  const sTop = useSharedValue(0);
  const sW = useSharedValue(1);
  const sH = useSharedValue(1);
  const activeIdx = useSharedValue(-1);
  const gestureMode = useSharedValue(0); // 1 mover · 2 dibujar · 3 borrar
  const sRadP = useSharedValue(16);
  const sRadB = useSharedValue(11);

  // Herramienta
  const [tool, setTool] = useState<Tool>('move');
  const [menuOpen, setMenuOpen] = useState(false);
  const [ballVisible, setBallVisible] = useState(true);
  const toolSV = useSharedValue(0);
  useEffect(() => {
    toolSV.value = tool === 'pencil' ? 1 : tool === 'eraser' ? 2 : 0;
  }, [tool, toolSV]);

  // Dibujo
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const liveStroke = useSharedValue<{ x: number; y: number }[]>([]);
  const [pencilColor, setPencilColor] = useState(PENCIL_COLORS[0]);
  const [widthIdx, setWidthIdx] = useState(1);
  const pencilMul = WIDTHS[widthIdx].mul;

  // Jugadores
  const players = useTeamStore((s) => s.players);
  const team = useTeamStore((s) => s.team);
  const [assignedIds, setAssignedIds] = useState<(string | null)[]>([null, null]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  const usPlayers = useMemo<(Player | undefined)[]>(() => {
    const pick = (i: number): Player | undefined => {
      const id = assignedIds[i];
      if (id) return players.find((p) => p.id === id);
      return players[i];
    };
    return [pick(0), pick(1)];
  }, [assignedIds, players]);

  const identities = useMemo<TokenIdentity[]>(
    () =>
      TOKENS.map((t, i) => {
        if (t.team === 'us') {
          const p = usPlayers[i];
          return { team: 'us', name: playerName(p), photoUri: playerUri(p) };
        }
        if (t.team === 'them') return { team: 'them', name: null, photoUri: null };
        return { team: 'ball', name: null, photoUri: null };
      }),
    [usPlayers],
  );

  const choosePlayer = (playerId: string) => {
    setAssignedIds((prev) => {
      if (pickerSlot === null) return prev;
      const next = [...prev];
      const other = pickerSlot === 0 ? 1 : 0;
      const otherEff = next[other] ?? players[other]?.id ?? null;
      if (otherEff === playerId) next[other] = next[pickerSlot] ?? players[pickerSlot]?.id ?? null;
      next[pickerSlot] = playerId;
      return next;
    });
    setPickerSlot(null);
  };

  // Vertical: la imagen llena el ancho (recorta arriba/abajo).
  // Horizontal: llena el alto y se centra (aprovecha más pantalla en landscape).
  const applyCourt = (w: number, h: number, aspect: number, frac: Frac) => {
    setCanvasSize({ w, h });
    const ls = w > h;
    // En horizontal ampliamos un poco para que la pista ocupe más pantalla
    // (recorta márgenes decorativos laterales y superior/inferior).
    const ZOOM_H = 1.15;
    let dispW: number;
    let dispH: number;
    if (ls) {
      dispH = h * ZOOM_H;
      dispW = dispH * aspect;
    } else {
      dispW = w;
      dispH = w / aspect;
    }
    const dispX = (w - dispW) / 2;
    const dispY = (h - dispH) / 2;
    const c: CourtRect = {
      left: dispX + dispW * frac.l,
      top: dispY + dispH * frac.t,
      w: dispW * (frac.r - frac.l),
      h: dispH * (frac.b - frac.t),
    };
    setImgRect({ left: dispX, top: dispY, w: dispW, h: dispH });
    setCourt(c);
    sLeft.value = c.left;
    sTop.value = c.top;
    sW.value = c.w;
    sH.value = c.h;
    // Basado en el lado CORTO de la pista (ancho real 10m) para que las
    // fichas tengan el mismo tamaño en vertical y en horizontal.
    const shortSide = Math.min(c.w, c.h);
    const rp = Math.max(9, shortSide * 0.051);
    const rb = Math.max(5, shortSide * 0.034);
    setRadP(rp);
    setRadB(rb);
    sRadP.value = rp;
    sRadB.value = rb;
  };

  const onLayout = (w: number, h: number) => {
    const ls = w > h;
    const useHoriz = ls && !!activeCourt.imgH;
    applyCourt(
      w,
      h,
      useHoriz ? IMG_ASPECT_H : IMG_ASPECT,
      useHoriz ? (activeCourt.fracH as Frac) : activeCourt.frac,
    );
  };

  // Recalcula la pista al cambiar de color/imagen o de orientación.
  useEffect(() => {
    if (canvasSize.w > 0) {
      applyCourt(canvasSize.w, canvasSize.h, activeAspect, activeFrac);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtIdx, landscape]);

  // Al girar la pantalla, rota las fichas 90° (conserva los movimientos del
  // usuario) para que el reparto sea izquierda/derecha en horizontal.
  const prevLandscape = useRef(landscape);
  useEffect(() => {
    if (prevLandscape.current !== landscape) {
      const fn = landscape ? rotFwd : rotBack;
      positions.value = positions.value.map(fn);
      prevLandscape.current = landscape;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landscape]);

  const initialSize = Math.max(11, Math.round(radP * 0.95));
  const initialFont = useMemo(
    () =>
      matchFont({
        fontFamily: Platform.select({
          ios: 'Helvetica Neue',
          android: 'sans-serif',
          default: 'sans-serif',
        }),
        fontSize: initialSize,
        fontWeight: 'bold',
      }),
    [initialSize],
  );

  const commitStroke = useCallback(() => {
    const pts = liveStroke.value;
    if (pts.length > 1 && court) {
      const norm = pts.map((p) => ({
        x: (p.x - court.left) / court.w,
        y: (p.y - court.top) / court.h,
      }));
      setStrokes((s) => [...s, { points: norm, color: pencilColor, mul: pencilMul }]);
    }
    liveStroke.value = [];
  }, [liveStroke, court, pencilColor, pencilMul]);

  const eraseAt = useCallback(
    (sx: number, sy: number) => {
      if (!court) return;
      const nx = (sx - court.left) / court.w;
      const ny = (sy - court.top) / court.h;
      const thr = 0.045;
      setStrokes((prev) =>
        prev.filter((st) => !st.points.some((p) => Math.hypot(p.x - nx, p.y - ny) < thr)),
      );
    },
    [court],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          // Al tocar el lienzo, cierra el menú si estaba abierto.
          runOnJS(setMenuOpen)(false);
          // Prioridad: ficha bajo el dedo → mover (aunque haya lápiz/borrador).
          let found = -1;
          let best = Infinity;
          for (let i = positions.value.length - 1; i >= 0; i--) {
            const p = positions.value[i];
            const sx = sLeft.value + p.x * sW.value;
            const sy = sTop.value + p.y * sH.value;
            const dx = e.x - sx;
            const dy = e.y - sy;
            const d2 = dx * dx + dy * dy;
            const rad = (i === BALL_INDEX ? sRadB.value : sRadP.value) + 14;
            if (d2 <= rad * rad && d2 < best) {
              best = d2;
              found = i;
            }
          }
          if (found >= 0) {
            activeIdx.value = found;
            gestureMode.value = 1;
            return;
          }
          if (toolSV.value === 1) {
            liveStroke.value = [{ x: e.x, y: e.y }];
            gestureMode.value = 2;
          } else if (toolSV.value === 2) {
            runOnJS(eraseAt)(e.x, e.y);
            gestureMode.value = 3;
          } else {
            gestureMode.value = 0;
          }
        })
        .onChange((e) => {
          'worklet';
          const m = gestureMode.value;
          if (m === 1) {
            const i = activeIdx.value;
            if (i < 0 || sW.value === 0) return;
            const arr = positions.value.slice();
            const p = arr[i];
            let nx = p.x + e.changeX / sW.value;
            let ny = p.y + e.changeY / sH.value;
            nx = Math.max(0, Math.min(1, nx));
            ny = Math.max(0, Math.min(1, ny));
            arr[i] = { x: nx, y: ny };
            positions.value = arr;
          } else if (m === 2) {
            liveStroke.value = [...liveStroke.value, { x: e.x, y: e.y }];
          } else if (m === 3) {
            runOnJS(eraseAt)(e.x, e.y);
          }
        })
        .onFinalize(() => {
          'worklet';
          if (gestureMode.value === 2) runOnJS(commitStroke)();
          activeIdx.value = -1;
          gestureMode.value = 0;
        }),
    [
      positions,
      sLeft,
      sTop,
      sW,
      sH,
      activeIdx,
      gestureMode,
      toolSV,
      sRadP,
      sRadB,
      liveStroke,
      commitStroke,
      eraseAt,
    ],
  );

  const resetFichas = () => {
    const base = landscape ? INITIAL_NORM_H : INITIAL_NORM;
    positions.value = base.map((p) => ({ ...p }));
    setStrokes([]);
  };
  const clearDrawing = () => setStrokes([]);

  const snapshot = async () => {
    try {
      const image = await canvasRef.current?.makeImageSnapshotAsync();
      if (!image) {
        Alert.alert('Captura', 'No se pudo capturar el lienzo.');
        return;
      }
      const bytes = image.encodeToBytes();
      Alert.alert('Captura OK', `${image.width()}×${image.height()} px · ${(bytes.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      Alert.alert('Error de captura', String(err));
    }
  };

  return (
    <View style={styles.root}>
      {/* Cabecera (franja superior) */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
            <Text style={styles.backLabel}>‹</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>PIZARRA · BETA</Text>
          <Text style={styles.title} numberOfLines={1}>
            {team?.name ?? 'Pizarra táctica'}
          </Text>
        </View>
        <View style={styles.slotChips}>
          {[0, 1].map((slot) => (
            <Pressable key={slot} onPress={() => setPickerSlot(slot)} hitSlop={6}>
              <MiniAvatar
                uri={playerUri(usPlayers[slot])}
                name={playerName(usPlayers[slot])}
                size={36}
                ring={US}
              />
            </Pressable>
          ))}
        </View>
        <Pressable onPress={snapshot} hitSlop={8} style={styles.iconBtn}>
          <Text style={styles.iconTxt}>📸</Text>
        </Pressable>
      </View>

      {/* Lienzo (en el medio, ancho completo) */}
      <View
        style={styles.canvasWrap}
        onLayout={(e) =>
          onLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)
        }
      >
        <GestureDetector gesture={pan}>
          <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
            {imgRect && court ? (
              <>
                <Rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} color={BACKDROP} />
                {courtImg ? (
                  <SkiaImage
                    image={courtImg}
                    x={imgRect.left}
                    y={imgRect.top}
                    width={imgRect.w}
                    height={imgRect.h}
                    fit="fill"
                  />
                ) : null}
                <PencilSkia
                  court={court}
                  strokes={strokes}
                  liveStroke={liveStroke}
                  liveColor={pencilColor}
                  liveMul={pencilMul}
                />
                {identities.map((id, i) =>
                  i === BALL_INDEX && !ballVisible ? null : (
                  <DraggableToken
                    key={TOKENS[i].id}
                    identity={id}
                    index={i}
                    positions={positions}
                    sLeft={sLeft}
                    sTop={sTop}
                    sW={sW}
                    sH={sH}
                    activeIdx={activeIdx}
                    rPx={TOKENS[i].team === 'ball' ? radB : radP}
                    initialFont={initialFont}
                    initialSize={initialSize}
                  />
                  ),
                )}
              </>
            ) : null}
          </Canvas>
        </GestureDetector>

        {/* Fundido superior: funde la cabecera (avatares) con el lienzo */}
        <LinearGradient
          colors={[Colors.background, Colors.background + 'CC', 'transparent']}
          locations={[0, 0.45, 1]}
          style={styles.topFade}
          pointerEvents="none"
        />

        {tool !== 'move' ? (
          <View style={styles.modeBanner} pointerEvents="none">
            <Text style={styles.modeBannerTxt}>
              {tool === 'pencil' ? '✏️ Dibujando' : '🧽 Borrando'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Menú flotante compacto: columna que sale hacia arriba desde el FAB */}
      {menuOpen ? (
        <View style={[styles.fabMenu, { bottom: insets.bottom + 84 }]}>
          {tool === 'pencil' ? (
            <View style={styles.pencilPop}>
              <View style={styles.swatchRow}>
                {PENCIL_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setPencilColor(c)}
                    style={[styles.swatch, { backgroundColor: c }, pencilColor === c && styles.swatchActive]}
                  />
                ))}
              </View>
              <Pressable onPress={() => setWidthIdx((i) => (i + 1) % WIDTHS.length)} style={styles.widthChip}>
                <Text style={styles.widthTxt}>{WIDTHS[widthIdx].key}</Text>
              </Pressable>
            </View>
          ) : null}
          <MiniTool icon="✋" active={tool === 'move'} onPress={() => setTool('move')} />
          <MiniTool icon="✏️" active={tool === 'pencil'} onPress={() => setTool('pencil')} />
          <MiniTool icon="🧽" active={tool === 'eraser'} onPress={() => setTool('eraser')} />
          <MiniTool icon="🎾" active={ballVisible} onPress={() => setBallVisible((v) => !v)} />
          <MiniTool icon="🗑" onPress={clearDrawing} />
          <MiniTool icon="↺" onPress={resetFichas} />
        </View>
      ) : null}

      {/* Botón flotante (FAB) que abre/cierra el menú */}
      <Pressable
        onPress={() => setMenuOpen((o) => !o)}
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        accessibilityRole="button"
        accessibilityLabel="Menú de herramientas"
      >
        <Text style={styles.fabIcon}>
          {menuOpen ? '✕' : tool === 'pencil' ? '✏️' : tool === 'eraser' ? '🧽' : '☰'}
        </Text>
      </Pressable>

      <Modal
        visible={pickerSlot !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerSlot(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerSlot(null)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Jugador {pickerSlot !== null ? pickerSlot + 1 : ''}
            </Text>
            {players.length === 0 ? (
              <Text style={styles.modalEmpty}>No hay jugadores en este equipo.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {players.map((p) => {
                  const isThis = pickerSlot !== null && usPlayers[pickerSlot]?.id === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => choosePlayer(p.id)}
                      style={({ pressed }) => [
                        styles.playerRow,
                        isThis && styles.playerRowActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MiniAvatar uri={playerUri(p)} name={playerName(p)} size={42} ring={isThis ? US : Colors.hairStrong} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.playerName} numberOfLines={1}>{playerName(p)}</Text>
                        <Text style={styles.playerMeta}>{p.pts} pts</Text>
                      </View>
                      {isThis ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Selector de color de pista */}
      <Modal
        visible={courtPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCourtPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCourtPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Color de pista</Text>
            <View style={styles.courtGrid}>
              {COURTS.map((c, i) => (
                <Pressable
                  key={c.key}
                  onPress={() => {
                    setCourtIdx(i);
                    setCourtPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.courtOpt,
                    courtIdx === i && styles.courtOptActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.courtDot, { backgroundColor: c.dot }]} />
                  <Text style={styles.courtOptTxt}>{c.label}</Text>
                  {courtIdx === i ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const MiniTool: React.FC<{
  icon: string;
  active?: boolean;
  onPress: () => void;
}> = ({ icon, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.miniTool, active && styles.miniToolActive, pressed && styles.pressed]}
  >
    <Text style={styles.miniToolIcon}>{icon}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTxt: { fontSize: 18 },
  backLabel: { color: Colors.text, fontSize: 26, lineHeight: 28, marginTop: -2 },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, fontWeight: '500' },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  slotChips: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  canvasWrap: { flex: 1, overflow: 'hidden' },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    zIndex: 5,
  },
  modeBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(0,223,130,0.16)',
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  modeBannerTxt: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  fabMenu: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 30,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 14,
    shadowColor: Colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  fabIcon: { fontSize: 24, color: '#001810', fontWeight: '700' },
  miniTool: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(6,20,16,0.92)',
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  miniToolActive: { backgroundColor: Colors.accent15, borderColor: Colors.accent40 },
  miniToolIcon: { fontSize: 20, color: '#FFFFFF' },
  pencilPop: {
    alignItems: 'center',
    gap: 8,
    padding: 8,
    marginBottom: 2,
    borderRadius: 18,
    backgroundColor: 'rgba(6,20,16,0.92)',
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: 76, justifyContent: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: Colors.text },
  widthChip: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthTxt: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgRaised,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: Colors.hairStrong,
    maxHeight: '85%',
  },
  modalHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.hairStrong, marginBottom: 14 },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalEmpty: { color: Colors.textMuted, fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  playerRowActive: { borderColor: Colors.accent40, backgroundColor: Colors.accent10 },
  playerName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  playerMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  check: { color: Colors.accent, fontSize: 18, fontWeight: '700' },
  courtGrid: { gap: 8 },
  courtOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  courtOptActive: { borderColor: Colors.accent40, backgroundColor: Colors.accent10 },
  courtDot: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  courtOptTxt: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
});
