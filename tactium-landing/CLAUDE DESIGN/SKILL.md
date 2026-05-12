---
name: tactium-design
description: Use this skill to generate well-branded interfaces and assets for TACTIUM, either for production or throwaway prototypes/mocks. TACTIUM is a federated-padel team manager (mobile app + pre-launch landing). The aesthetic is dark, monochromatic green (#00DF82 over #030F0F), Inter + JetBrains Mono, "elite lab" tone. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read `README.md` first — it contains the brand voice, content fundamentals, visual foundations, and iconography rules. Then explore:

- `colors_and_type.css` — full token list and component recipes. Import this in any HTML you generate.
- `assets/logo.png` — the master logo.
- `assets/screens/*.jpeg` — real product screenshots for reference & embedding.
- `ui_kits/app/` — mobile-app UI kit. Read `index.html` for the demo, individual `.jsx` files for components (`PhoneFrame`, `JornadaCard`, `ParejaCard`, `BottomTabBar`, `Eyebrow`, `Button`, `Avatar`, `Badge`, etc).
- `ui_kits/landing/` — pre-launch landing UI kit. `Hero`, `AppPreview`, `Features`, `Pricing`, `FAQ`, `FinalCta`.
- `preview/` — small design-system cards you can crib (palette swatches, type specimens, spacing, etc).

When creating **visual artifacts** (slides, prototypes, mocks), copy the assets you need out of this skill folder and write static HTML. Use `colors_and_type.css` as the token source — never invent new colors. Stick to Inter + JetBrains Mono only.

When working on **production code** (Next.js / React Native), read the visual foundations and translate the tokens into the project's idiom (Tailwind v4 CSS-first tokens, Reanimated for the app, GSAP/Motion for the web).

**Non-negotiables**:
- Dark mode only. No light mode.
- One accent (`#00DF82`) only — never introduce a second hue except for semantic warning/error.
- No emoji. No glassmorphism. No stock photography.
- Spanish (Spain) microcopy with `tú`, monospaced uppercase eyebrows, sentence-case headlines.
- Lucide icons exclusively, stroke 1.5–2, color = accent or muted.

If the user invokes this skill with no further guidance, ask what they want to build (a slide, a mock, a landing section, a screen in the app), gather two or three context questions, and then deliver an HTML artifact that uses the system.
