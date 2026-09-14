---
name: tactium-design
description: Use this skill to generate well-branded interfaces and assets for TACTIUM, either for production or throwaway prototypes/mocks. TACTIUM is a federated-padel team manager (mobile app + landing + web app). The aesthetic is monochromatic green, "elite lab" tone, Satoshi + JetBrains Mono. Dual theme — dark is the signature (#00DF82 over #030F0F) and light is a first-class peer (#00995E over #F4F7F5). Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read `README.md` first — it contains the brand voice, content fundamentals, visual foundations, and iconography rules. Then explore:

- `colors_and_type.css` — full token list and component recipes, **both themes**. Import this in any HTML you generate.
- `assets/logo.png` — the master logo.
- `assets/screens/*.jpeg` — real product screenshots for reference & embedding. ⚠️ These are all **dark-mode** captures, taken before light mode shipped. Use them for layout and copy reference, never as proof of what light mode looks like.
- `ui_kits/app/` — mobile-app UI kit. Read `index.html` for the demo, individual `.jsx` files for components (`PhoneFrame`, `JornadaCard`, `ParejaCard`, `BottomTabBar`, `Eyebrow`, `Button`, `Avatar`, `Badge`, etc).
- `ui_kits/landing/` — landing UI kit. `Hero`, `AppPreview`, `Features`, `Pricing`, `FAQ`, `FinalCta`.
- `preview/` — small design-system cards you can crib (palette swatches, type specimens, spacing, etc).

When creating **visual artifacts** (slides, prototypes, mocks), copy the assets you need out of this skill folder and write static HTML. Use `colors_and_type.css` as the token source — never invent new colors, never hardcode a hex that already has a token. Stick to Satoshi + JetBrains Mono only.

When working on **production code** (Next.js / React Native), read the visual foundations and translate the tokens into the project's idiom (Tailwind v4 CSS-first tokens for web, `useColors()` + `makeStyles(c)` for the app, Reanimated for the app, GSAP/Motion for the web).

## Dual theme — how to get it right

TACTIUM ships a real light mode (Ajustes → APARIENCIA → Claro / Oscuro / Sistema). Both themes use the **same token keys** with different values, so component code never branches on theme — it just reads `var(--color-*)`.

**Dark is the signature.** It's the default, it's what the brand is known for, and it's what you show first unless asked otherwise. Light is a peer, not an afterthought: it must look deliberate, not like the dark theme with the lights turned on.

Three rules that get broken constantly:

1. **The accent changes.** Light mode uses `#00995E`, not `#00DF82`. The neon green scores 1.6:1 on white — it fails WCAG as text, as a border, and as a focus ring. `#00995E` clears 4.6:1 on `#F4F7F5` and still works as a fill with white text on top.
2. **Glows disappear in light.** In dark, the green halo is the visual signature. In light, it reads as dirt. `--glow-accent-*` resolve to `none`, and depth comes from soft neutral shadows plus hairlines instead. A light mode with green halos is wrong, no exceptions.
3. **Shadows lighten and shorten.** The dark recipes (black at 60–80%) smear grey over a light background. Light uses a tint of the text color, low opacity, short blur — already wired into `--shadow-card-*`.

Corollaries worth remembering: the ambient backdrop (two radial gradients) drops to a quarter intensity or disappears in light; semantic warning/error have their own light values (`#B7791F` / `#D93B41`) because the dark ones vibrate on white; and **share cards and the splash stay dark always**, whatever theme the product is in — they're brand assets, not UI.

Ship every screen in both themes and include a working toggle. `colors_and_type.css` documents the exact wiring at the bottom, including the anti-flash script.

## Typography

**Satoshi** (400 / 500 / 700 / 900) is the official sans — that's how it's declared in `TACTIUM/src/core/theme/fonts.ts`. Loaded from Fontshare in `colors_and_type.css`. Inter remains only as a fallback in the stack; don't specify it deliberately.

**JetBrains Mono** (400–700) for eyebrows, tabular data, scores, FEP points, codes and prices. Always `tabular-nums`.

Headlines run heavy (700–900) with `-0.02em` tracking and `1.02–1.1` line-height. No serifs, no decorative display faces.

⚠️ **Satoshi has no 600 or 800** — its weights are 300 / 400 / 500 / 700 / 900. Migrating from the old Inter scale: `800 → 900`, `600 → 500`. Ask for a weight that doesn't exist and the browser synthesises it; the headline comes out muddy.

Satoshi replaced Inter on 2026-08-10 across all four brand documents (this skill, `README.md`, `../BRAND_SYSTEM.md`, `../DESIGN_SYSTEM.md`). Anything still naming Inter as primary predates that and is stale.

## Scope — which document governs what

- **Product screens** (mobile app, web app) → this skill. Dual theme.
- **Marketing assets** (carousels, posts, stories, reels) → `../DESIGN_SYSTEM.md`. **Dark only, on purpose** — a brand is recognised in a feed by repeating itself. Don't generate social assets in light.
- **Landing** → dark only too, same reasoning.
- **Brand identity at large** (logo, wordmark, archetype, voice) → `../BRAND_SYSTEM.md`.

Marketing being dark-only and the product being dual-theme are both correct; they don't contradict each other.

## Non-negotiables

- **Dual theme.** Dark by default and dark-first, but light is fully supported and must be designed, not derived. Never hardcode a color that has a token.
- One accent only — never introduce a second hue except for semantic warning/error, and use the token so it follows the theme.
- No emoji. No glassmorphism. No stock photography.
- Spanish (Spain) microcopy with `tú`, monospaced uppercase eyebrows, sentence-case headlines. Glossary: pista, pareja, jornada, capitán/capitana, federación, alineación, plantilla, temporada, puntos FEP.
- Lucide icons exclusively, stroke 1.5–2, color = accent or muted. Never pure white, never multicolor.
- Motion: `cubic-bezier(0.25, 1, 0.5, 1)`, 140 / 220 / 460 ms, no bounce or spring, always respect `prefers-reduced-motion`.
- Visible focus rings. A lot of the web app is used with a keyboard.

If the user invokes this skill with no further guidance, ask what they want to build (a slide, a mock, a landing section, a screen in the app, a screen in the web app), gather two or three context questions, and then deliver an HTML artifact that uses the system.
