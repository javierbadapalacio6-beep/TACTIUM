# Prompt experto — Integrar TACTIUM ARENA en la app React Native

Copia este prompt en una sesión de desarrollo sobre la carpeta `TACTIUM/`:

---

Actúa como desarrollador senior de React Native con más de 10 años de experiencia. En este repo Expo (SDK 54, React Navigation 7, Reanimated 4, Skia, Supabase, estructura por features en `src/features/`) integra la feature **Arena de juegos**, replicando el prototipo `TACTIUM-ARENA-prototipo.html` (misma UX, textos y sistema de puntos).

Requisitos:

1. Crea `src/features/arena/` con `screens/` (ArenaHubScreen, MatchArcadeScreen, PadelCrushScreen, TacticalQuizScreen, ReflexScreen, TriviaScreen, PredictScreen, ResultScreen, ArenaRankingScreen), `components/`, `data/` (situaciones del quiz y preguntas del trivial como TS tipado) y `hooks/`.
   - **Partido Arcade**: porta el motor del prototipo (física con altura z, gravedad, rebote suelo/pared, red a 0,9 m, puntuación 15/30/40/AD, 3 juegos) a Skia (`@shopify/react-native-skia`) con el game loop en Reanimated (frame callback), control táctil por arrastre y 3 tiros (globo/plana/remate) con el solver de trayectoria `aim()` que garantiza pasar la red.
   - **Padel Crush**: porta el match-3 8×8 (especiales: línea de 4 → cruz que limpia fila+columna; 5 → bola de oro que elimina un tipo; cascadas con multiplicador, niveles con objetivo, reshuffle si no hay jugadas). Grid con Reanimated layout animations.
2. Añade `ArenaStack.tsx` en `src/navigation/` y una entrada al hub desde Home. Registra los tipos en `navigation/types.ts`.
3. Usa el tema existente (`src/core/theme`): Colors, Spacing, Radius, Typography. Nada de colores hardcodeados.
4. Pista del quiz táctico: dibujada con `react-native-svg` (ya instalada), vista cenital 10×20, jugadores como círculos y trayectoria de bola con flecha discontinua.
5. Juego de Reflejos: Reanimated 4 para spawn/animación de bolas, 45 s, combo x1–x5, 3 vidas, dificultad creciente.
6. Persistencia: XP, racha diaria y mejores marcas en Supabase (tabla `arena_progress`, RLS por usuario) con fallback offline en AsyncStorage. Ranking por club reutilizando la relación club-usuario existente.
7. Predicción: usa los partidos reales de `features/matches`/`seasons` si hay jornada activa; si no, oculta el modo.
8. Gratis para todos los usuarios (sin gate de suscripción por ahora), pero deja un flag `ARENA_REQUIRES_PRO = false` centralizado.
9. Sigue las convenciones del repo (naming, exports, estilo de pantallas existentes). TypeScript estricto, sin `any`.

Entrega por fases y compila con `npx tsc --noEmit` antes de dar cada fase por cerrada.
