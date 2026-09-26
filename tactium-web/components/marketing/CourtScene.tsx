"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Pista de pádel en 3D (react-three-fiber): líneas de neón, paredes de
 * cristal traslúcidas, red de malla, una bola que va y viene y polvo en
 * suspensión. Gira sola y sigue al puntero con un parallax suave.
 *
 * Medidas reales: 20 × 10 m, red a 0,88 m, línea de saque a 6,95 m de la red,
 * paredes de fondo de 3 m + 1 m de malla, laterales de 3 m en los 4 m junto al
 * fondo y 1 m de malla en el resto.
 */

const ACCENT = "#00df82";
const PRIMARY = "#03624c";
const BG = "#030f0f";

const L = 20;
const W = 10;
const HX = L / 2;
const HZ = W / 2;
const SERVICE = 3.05; // 10 − 6.95
const NET_H = 0.88;
const WALL_H = 3;
const FENCE_H = 4;
const SIDE_GLASS = 4;

function seg(out: number[], a: number[], b: number[]) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** Líneas de la pista (suelo + red) — un solo `LineSegments`. */
function useCourtLines() {
  return useMemo(() => {
    const v: number[] = [];
    seg(v, [-HX, 0, -HZ], [HX, 0, -HZ]);
    seg(v, [HX, 0, -HZ], [HX, 0, HZ]);
    seg(v, [HX, 0, HZ], [-HX, 0, HZ]);
    seg(v, [-HX, 0, HZ], [-HX, 0, -HZ]);
    seg(v, [-SERVICE, 0, -HZ], [-SERVICE, 0, HZ]);
    seg(v, [SERVICE, 0, -HZ], [SERVICE, 0, HZ]);
    seg(v, [-SERVICE, 0, 0], [SERVICE, 0, 0]);
    // Postes y cinta de la red.
    seg(v, [0, 0, -HZ], [0, NET_H, -HZ]);
    seg(v, [0, 0, HZ], [0, NET_H, HZ]);
    seg(v, [0, NET_H, -HZ], [0, NET_H, HZ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
}

/** Aristas de las paredes (cristal y malla), más tenues que el suelo. */
function useWallLines() {
  return useMemo(() => {
    const v: number[] = [];
    for (const x of [-HX, HX]) {
      seg(v, [x, 0, -HZ], [x, FENCE_H, -HZ]);
      seg(v, [x, 0, HZ], [x, FENCE_H, HZ]);
      seg(v, [x, WALL_H, -HZ], [x, WALL_H, HZ]);
      seg(v, [x, FENCE_H, -HZ], [x, FENCE_H, HZ]);
    }
    for (const z of [-HZ, HZ]) {
      for (const sx of [-1, 1]) {
        const x0 = sx * HX;
        const x1 = sx * (HX - SIDE_GLASS);
        seg(v, [x1, 0, z], [x1, FENCE_H, z]);
        seg(v, [x0, WALL_H, z], [x1, WALL_H, z]);
        seg(v, [x0, FENCE_H, z], [x1, FENCE_H, z]);
      }
      // Valla baja (1 m) entre los dos tramos de cristal.
      seg(v, [-(HX - SIDE_GLASS), 1, z], [HX - SIDE_GLASS, 1, z]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
}

function GlassPane({
  position,
  rotationY = 0,
  width,
  height,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={ACCENT}
        transparent
        opacity={0.045}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Court() {
  const floorLines = useCourtLines();
  const wallLines = useWallLines();
  return (
    <group>
      {/* Suelo: un lienzo verde profundo con el borde fundido. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[L, W]} />
        <meshBasicMaterial color={PRIMARY} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[16, 48]} />
        <meshBasicMaterial color={PRIMARY} transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <lineSegments geometry={floorLines}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.95} />
      </lineSegments>
      <lineSegments geometry={wallLines}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.34} />
      </lineSegments>

      {/* Red: malla de alambre. */}
      <mesh position={[0, NET_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[W, NET_H, 30, 4]} />
        <meshBasicMaterial color={ACCENT} wireframe transparent opacity={0.28} />
      </mesh>

      {/* Cristales de fondo y laterales. */}
      <GlassPane position={[-HX, WALL_H / 2, 0]} rotationY={Math.PI / 2} width={W} height={WALL_H} />
      <GlassPane position={[HX, WALL_H / 2, 0]} rotationY={Math.PI / 2} width={W} height={WALL_H} />
      {[-1, 1].map((sz) =>
        [-1, 1].map((sx) => (
          <GlassPane
            key={`${sz}${sx}`}
            position={[sx * (HX - SIDE_GLASS / 2), WALL_H / 2, sz * HZ]}
            width={SIDE_GLASS}
            height={WALL_H}
          />
        ))
      )}
    </group>
  );
}

function Ball() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.getElapsedTime() * 0.55;
    // Va y vuelve entre las dos líneas de saque con un globo por encima de la red.
    const p = Math.sin(t);
    m.position.x = p * 7.5;
    m.position.y = 0.5 + Math.pow(Math.cos(t), 2) * 2.4;
    m.position.z = Math.sin(t * 0.5) * 2.2;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.2, 20, 20]} />
      <meshBasicMaterial color={ACCENT} />
    </mesh>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const n = 360;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 34;
      arr[i * 3 + 1] = Math.random() * 7;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.012;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={ACCENT}
        size={0.07}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Giro lento + parallax con el puntero (suavizado). */
function Rig({ children, still }: { children: React.ReactNode; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });
  useFrame(({ clock, pointer }) => {
    const g = ref.current;
    if (!g) return;
    const t = still ? 0 : clock.getElapsedTime();
    target.current.x += (pointer.x - target.current.x) * 0.05;
    target.current.y += (pointer.y - target.current.y) * 0.05;
    g.rotation.y = -0.55 + t * 0.06 + target.current.x * 0.22;
    g.rotation.x = 0.04 - target.current.y * 0.06;
  });
  return <group ref={ref}>{children}</group>;
}

export default function CourtScene({
  active = true,
  still = false,
}: {
  /** Parado cuando no se ve: no consume GPU fuera de pantalla. */
  active?: boolean;
  /** Sin giro ni bola (reduced motion): un fotograma bonito y quieto. */
  still?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={active && !still ? "always" : "demand"}
      camera={{ position: [0, 10.5, 27], fov: 33, near: 0.1, far: 90 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
      onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
    >
      <fog attach="fog" args={[BG, 24, 54]} />
      <Rig still={still}>
        <Court />
        {!still && <Ball />}
        <Dust />
      </Rig>
    </Canvas>
  );
}
