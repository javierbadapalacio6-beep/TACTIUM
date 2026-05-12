# TACTIUM · App UI kit

Interactive recreation of the TACTIUM mobile client (iOS).

## What's here

- `index.html` — Click-through demo. Navigation pills above the phone let you jump between screens.
- `components.jsx` — Atoms (`Eyebrow`, `Tile`, `Badge`, `ResultChip`, `PrimaryCTA`, `BackPill`, `IconPill`, `ProgressBar`, `Card`, `BottomTabBar`, `AmbientGlow`) and all Lucide-shaped icons.
- `screens.jsx` — Composed screens: `OnboardingScreen`, `HomeScreen`, `JornadaScreen` (pending + validated states), `AlineacionScreen`, `ClubScreen`.
- `ios-frame.jsx` — Standard iOS device frame (dark variant).

## Coverage vs source screenshots

| Screen | Reference | Recreation |
|---|---|---|
| Onboarding plan picker | `ONBOARDING WELCOME.jpeg` | `OnboardingScreen` |
| Capitán home (empty) | `HOME VACIA.jpeg` | `HomeScreen` |
| Jornada pendiente | `JORNADA SIN ALINEACION...jpeg` | `JornadaScreen` with `state="pending"` |
| Alineación con auto-orden | `ALINEACION.jpeg` | `AlineacionScreen` |
| Jornada + Resultados | `JORNADA + RESULTADOS.jpeg` | `JornadaScreen` with `state="validated"` |
| Club admin | `CLUB.jpeg` + `EQUIPOS CLUB.jpeg` | `ClubScreen` |

Screens not recreated (TIER C — see brief): login, registration, fully-empty seasons / results, onboarding step 1.
