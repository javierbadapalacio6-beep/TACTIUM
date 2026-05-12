# TACTIUM · Landing UI kit

Static recreation of the TACTIUM pre-launch landing (waitlist).

## What's here

- `index.html` — Fully assembled landing page (sticky header → hero → federations marquee → 3-step app preview → 2-perfile split → club deep-dive → features bento → pricing → FAQ → final CTA → footer).
- `components.jsx` — All sections as small composable React components:
  - **Atoms** — `LEyebrow`, `SectionHeader`, `PhoneFrame` (iPhone bezel with Dynamic Island + glow), `WaitlistForm`.
  - **Layout** — `Header`, `Footer`.
  - **Sections** — `Hero`, `FederationsMarquee`, `AppPreview`, `ForWho`, `ForClubs`, `Features`, `Pricing`, `FAQ`, `FinalCta`.

## Notes vs brief

- The hero implements the wireframe from the brief (copy left, two phones in stack rotated −9° / +6°, ambient accent glow, waitlist field + mono compliance line).
- The 3D pala / pista / pelota R3F scenes from §7 of the brief are **omitted** — this is a static UI kit. Drop a `<Canvas>` from `react-three-fiber` in place of the phone stack to wire them up later.
- Scrollytelling (Lenis + ScrollTrigger pin & scrub) is **not** active here; the sections are statically laid out for review. Animation specs are documented in `../../README.md` § Visual foundations → Animation.
- Pricing tiers and microcopy follow §2 (Modelo de negocio) and §11 (Microcopy) exactly.
