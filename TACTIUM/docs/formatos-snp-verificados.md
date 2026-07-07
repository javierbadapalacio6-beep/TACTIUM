# Formatos SNP / QSNP / SNP Seniors / LAPI — verificados contra normativa oficial

> Fuente: normativas oficiales 2025-26 (PDFs aportados por Javier, 7-jul-2026).
> SNP: Normativa XII Edición · QSNP: Normativa QSeries · Seniors: Normativa SNP Seniors · LAPI: Normativa España 2025-26 (act. 03/12/2025) + Dossier Road to Hexagon 26-27.
> Estado en código: `federations.ts` corregido (courts + strength order). LAPI ya estaba correcto (3/3, sin orden). Pendiente: puntuación ponderada SNP y validación de edad Seniors.

## Tabla comparativa

| | **SNP** | **SNP Seniors** | **QSNP (QSeries)** |
|---|---|---|---|
| Partidos por eliminatoria | **5** | **3** | **1** (liga de parejas) |
| Jugadores alineados | 10 | 6 | 2 |
| Plantilla máxima | 13 (con máx. 3 incorporaciones nuevas) | — | pareja |
| Puntos por partido | P1=3, P2=3, P3=2, P4=2, P5=2 (**12 en juego**) | P1=3, P2=3, P3=2 (**8 en juego**) | Ganado=3, perdido=1 |
| ¿Empate posible? | Sí, 6-6 en Fase Regular Zonal | — | No |
| Desempate (playoffs/finales) | Resultado de la **pareja 3** | Resultado de la **pareja 3** | — |
| Orden de parejas | **Automático e inalterable**: por suma de puntos ranking SNP de los 2 integrantes (pareja 1 = mayor suma) | Igual que SNP | Libre |
| Empates de puntos entre parejas | 1º mejor ranking individual; 2º peor ranking individual; 3º capitán elige **en bloque** | 1º mejor ranking individual; 2º peor ranking individual | — |
| Restricción de edad | — | +40 años (cumplidos en la edición) y **cada pareja debe sumar ≥90 años** | — |
| Acta/alineación oficial | Web móvil SNP, confirmada **15 min antes** | Zona privada web, 15 min antes | Zona privada web, 15 min antes |
| Clasificación de liga | Suma total de puntos de todos los partidos | Igual | Igual |

## Cambios ya aplicados en `src/core/data/federations.ts`

- `LEAGUE_RULES`: SNP 3→**5**; añadidos `qsnp`/`qseries` (1) y `snp seniors`/`seniors` (3). **El orden de patrones es crítico**: 'qsnp' y 'snp seniors' contienen 'snp' y deben matchear antes.
- `STRENGTH_ORDER_BY_LEAGUE`: SNP false→**true**. La validación existente (P1 ≥ P2 ≥ … por puntos combinados de pareja) replica la semántica del auto-orden SNP usando `players.pts` como proxy del ranking SNP.

## Pendiente de implementar (por prioridad)

1. **Marcador ponderado SNP/Seniors.** `match_results`/`matchdays.outcome` cuentan partidos ganados (p.ej. 3-2); el capitán SNP piensa en puntos (p.ej. 7-5, con empate 6-6 posible). Mínimo viable: mostrar el resultado en puntos junto al de partidos cuando la liga sea SNP/Seniors. La lógica de standings NO es nuestra (la lleva la web SNP), solo presentación.
2. **Auto-orden visible.** En SNP el capitán empareja libre y el orden 1-5 se calcula solo. El botón "auto-ordenar" existente ya hace esto; para SNP debería ser el comportamiento por defecto (no opcional) con aviso "orden calculado según normativa SNP".
3. **Validación de edad Seniors** (pareja ≥90 años, jugador ≥40). Requiere `players.birthdate`, que hoy NO existe en la tabla. Añadir columna opcional; validar solo si hay datos.
4. **QSNP: decidir alcance.** Es liga de parejas (1 partido, 2 jugadores): el dolor de gestión de plantilla casi no existe. Recomendación: soportarlo pasivamente (el motor ya devuelve 1 pista) pero NO invertir en features específicas.

## LAPI — verificado (normativa 2025-26 + dossier R2H)

**El código ya estaba correcto: 3 partidos, sin orden de fuerza. No requiere cambios en `federations.ts`.**

- **Formato:** 3 partidos por enfrentamiento (parejas 1, 2 y 3), al mejor de 3 sets con punto de oro y tie-break.
- **Jugadores:** 6 por enfrentamiento; plantilla de **9 a 15** (capitán incluido); altas hasta antes de la jornada 2; sustituciones posteriores solo por lesión/traslado justificados.
- **La peculiaridad clave — sorteo de cruces:** el capitán forma sus 3 parejas libremente, pero los CRUCES contra el rival se deciden por **sorteo físico 15 min antes** (DNIs boca abajo; cada capitán elige a ciegas una pareja rival). No hay pareja-1-contra-pareja-1 por nivel. Implicación de producto: para LAPI la alineación TACTIUM es "elegir 6 de 15 y formar 3 parejas" — el orden es irrelevante y no debe validarse ni mostrarse como en FEP/SNP.
- **Puntuación de standings (la lleva la app oficial LAPI, no nosotros):** ganar 2-1 = 3 pts · ganar 3-0 = 4 pts · perder presentándose = 1 pt · incomparecencias 0 / -1 / -5 y multas. Desempate: encuentros ganados → partidos → sets → juegos.
- **Restricciones de nivel:** máx. 1 jugador top-10 del Ranking Absoluto de la Comunidad por alineación en 1ª categoría; en el resto de categorías, nadie del top-40. Edad mínima 13 años.
- **Acta oficial:** en la app LAPI (se abre 15 min antes al capitán local; el visitante valida; auto-subida 1 h después). Igual que con SNP: TACTIUM es la herramienta INTERNA del equipo antes del enfrentamiento; el acta es de su plataforma.
- **⚠️ Hallazgo estratégico (dossier R2H 26-27):** LAPI se presenta como "un proyecto social, global y mundial, **de la mano de Playtomic**". Playtomic es su partner tecnológico. La vía top-down (acuerdo con la organización LAPI) queda prácticamente cerrada; la captación LAPI debe ser **bottom-up** (capitanes directamente, que sí sufren el caos interno del equipo que la app oficial no resuelve). Para top-down institucional, priorizar SNP.
- **R2H (Road to Hexagon):** 30+ sedes nacionales, 3vs3 semanal, todos contra todos por sede, conecta con la Hexagon Cup (ene–feb). Ventana de visibilidad interesante para marketing de invierno.

## Detalles operativos útiles para marketing/onboarding

- El capitán SNP debe confirmar el acta 15 min antes o hay sanción → mensaje de venta natural: "lleva la alineación decidida antes de llegar a pista".
- Los puntos de ranking SNP usados son los del sistema oficial "estén o no actualizados" → nuestro `pts` es proxy, avisar al usuario de mantenerlo al día.
- Turnos: único (5 partidos a la vez) o doble (2+3) → la distribución `tandas` de matchdays ya lo puede representar.
- SNP: mínimo 8 enfrentamientos por equipo en fase regular; jugadores necesitan ≥1 enfrentamiento disputado para jugar playoffs (relevante para tracking de participación).
