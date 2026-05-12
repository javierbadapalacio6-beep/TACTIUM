// TACTIUM · App UI kit · atoms & molecules
// All components export to window for cross-script use.

const { useState, useEffect, useRef } = React;

// ───── ICONS (Lucide-shaped, stroke 1.75) ────────────────────────────────
const I = (path, { fill = "none", vb = "24 24" } = {}) =>
  function Icon({ size = 20, color = "currentColor", style }) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${vb.split(" ")[0]} ${vb.split(" ")[1]}`}
        fill={fill} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
        {path}
      </svg>
    );
  };

const IconChevLeft   = I(<path d="m15 18-6-6 6-6"/>);
const IconChevRight  = I(<path d="m9 18 6-6-6-6"/>);
const IconZap        = I(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
const IconTrash      = I(<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>);
const IconCalendar   = I(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>);
const IconMapPin     = I(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>);
const IconUsers      = I(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></>);
const IconUser       = I(<><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 16 0v1"/></>);
const IconBarChart   = I(<><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-6"/></>);
const IconArrowR     = I(<><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>);
const IconChevRightSm = I(<path d="m9 18 6-6-6-6"/>);
const IconPencil     = I(<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>);
const IconMore       = I(<><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>);
const IconGrid       = I(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>);
const IconCheck      = I(<path d="M20 6 9 17l-5-5"/>);
const IconShare      = I(<><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></>);
const IconHome       = I(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>);
const IconHomeFilled = I(<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor"/>, { fill: "none" });
const IconStar       = I(<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" fill="currentColor"/>);
const IconPlus       = I(<><path d="M12 5v14"/><path d="M5 12h14"/></>);

// ───── Eyebrow text ──────────────────────────────────────────────────
function Eyebrow({ children, dim, style }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      letterSpacing: "0.25em", textTransform: "uppercase",
      color: dim ? "var(--color-text-faint)" : "var(--color-accent)",
      ...style,
    }}>{children}</div>
  );
}

// ───── Tile / avatar with initials ───────────────────────────────────
function Tile({ children, variant = "accent", size = 40, radius = 10, style }) {
  const variants = {
    accent: { background: "rgba(0,223,130,0.10)", color: "var(--color-accent)", boxShadow: "inset 0 0 0 1px rgba(0,223,130,0.25)" },
    mute:   { background: "rgba(232,245,239,0.04)", color: "var(--color-text-muted)", boxShadow: "inset 0 0 0 1px var(--color-hair-strong)" },
    brand:  { background: "var(--color-primary)", color: "var(--color-accent)", boxShadow: "inset 0 0 0 1px var(--color-accent-40)" },
    solid:  { background: "var(--color-accent)", color: "var(--color-text-inverse)" },
  }[variant];
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, display: "grid", placeItems: "center",
      fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: size >= 56 ? 22 : 13,
      letterSpacing: "0.02em", flexShrink: 0,
      ...variants, ...style,
    }}>{children}</div>
  );
}

// ───── Badge ────────────────────────────────────────────────────────
function Badge({ children, kind = "accent", dot, style }) {
  const kinds = {
    accent:  { color: "var(--color-accent)", border: "rgba(0,223,130,0.40)", bg: "rgba(0,223,130,0.10)" },
    warn:    { color: "#F2C94C", border: "rgba(242,201,76,0.40)", bg: "rgba(242,201,76,0.10)" },
    error:   { color: "var(--color-error)", border: "rgba(255,107,107,0.40)", bg: "rgba(255,107,107,0.10)" },
    ghost:   { color: "var(--color-text-faint)", border: "var(--color-hair-strong)", bg: "transparent" },
    solid:   { color: "var(--color-accent)", border: "var(--color-accent-55)", bg: "rgba(0,223,130,0.15)" },
  }[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      letterSpacing: "0.20em", textTransform: "uppercase",
      padding: "6px 10px", borderRadius: 8,
      color: kinds.color, background: kinds.bg,
      boxShadow: `inset 0 0 0 1px ${kinds.border}`,
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: kinds.color }}/>}
      {children}
    </span>
  );
}

// ───── Result chip (square V / D / E) ───────────────────────────────
function ResultChip({ result }) {
  const map = {
    V: { color: "var(--color-accent)", border: "rgba(0,223,130,0.50)", bg: "rgba(0,223,130,0.08)" },
    D: { color: "var(--color-error)", border: "rgba(255,107,107,0.50)", bg: "rgba(255,107,107,0.08)" },
    E: { color: "#F2C94C", border: "rgba(242,201,76,0.50)", bg: "rgba(242,201,76,0.08)" },
  }[result];
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, display: "grid", placeItems: "center",
      fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16,
      color: map.color, background: map.bg, boxShadow: `inset 0 0 0 1.2px ${map.border}`,
    }}>{result}</div>
  );
}

// ───── Button (primary CTA + ghost + nav-back) ──────────────────────
function PrimaryCTA({ children, icon: Icon, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      background: "var(--color-accent)", color: "var(--color-text-inverse)",
      fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 18,
      padding: "20px 24px", borderRadius: 999, border: 0,
      boxShadow: "0 14px 36px -10px rgba(0,223,130,0.55)",
      cursor: "pointer", ...style,
    }}>
      {Icon && <Icon size={20} color="var(--color-text-inverse)"/>}
      {children}
    </button>
  );
}

function BackPill({ children = "Inicio", onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "10px 16px 10px 12px",
      background: "var(--color-bg-card)", color: "var(--color-text)",
      borderRadius: 999, border: 0, boxShadow: "inset 0 0 0 1px var(--color-hair-strong)",
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16, cursor: "pointer",
    }}>
      <IconChevLeft size={20} color="var(--color-text)"/>
      {children}
    </button>
  );
}

function IconPill({ icon: Icon, accent, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
      background: accent ? "rgba(0,223,130,0.08)" : "var(--color-bg-card)",
      border: 0, boxShadow: `inset 0 0 0 1px ${accent ? "rgba(0,223,130,0.30)" : "var(--color-hair-strong)"}`,
      cursor: "pointer", ...style,
    }}>
      <Icon size={18} color={accent ? "var(--color-accent)" : "var(--color-text)"}/>
    </button>
  );
}

// ───── Progress bar ─────────────────────────────────────────────────
function ProgressBar({ value = 100, color = "var(--color-accent)", height = 3 }) {
  return (
    <div style={{ height, background: "rgba(232,245,239,0.10)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color }}/>
    </div>
  );
}

// ───── Surface card ─────────────────────────────────────────────────
function Card({ children, selected, padded = true, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "var(--color-bg-card)",
      borderRadius: 16,
      padding: padded ? 14 : 0,
      boxShadow: selected
        ? "inset 0 0 0 1.5px var(--color-accent-55), 0 12px 30px -12px rgba(0,223,130,0.15)"
        : "inset 0 0 0 1px var(--color-hair)",
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}>{children}</div>
  );
}

// ───── Bottom tab bar (capitan) ─────────────────────────────────────
function BottomTabBar({ active = "inicio", onChange = () => {}, mode = "capitan" }) {
  const tabsCapitan = [
    { id: "inicio",      label: "Inicio",      icon: IconHome },
    { id: "temporadas",  label: "Temporadas",  icon: IconCalendar },
    { id: "equipo",      label: "Equipo",      icon: IconUsers },
    { id: "perfil",      label: "Perfil",      icon: IconUser },
  ];
  const tabsClub = [
    { id: "club",   label: "Club",   icon: IconUsers },
    { id: "perfil", label: "Perfil", icon: IconUser },
  ];
  const tabs = mode === "club" ? tabsClub : tabsCapitan;
  return (
    <div style={{
      position: "absolute", left: 14, right: 14, bottom: 24, zIndex: 5,
      background: "rgba(8,24,24,0.85)", backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: 28, padding: 8,
      boxShadow: "inset 0 0 0 1px var(--color-hair-strong), 0 10px 30px -10px rgba(0,0,0,0.6)",
      display: "flex", gap: 2,
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: "transparent", border: 0, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "8px 6px", borderRadius: 20,
            color: on ? "var(--color-text)" : "var(--color-text-muted)",
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
          }}>
            <t.icon size={22} color={on ? "var(--color-text)" : "var(--color-text-muted)"}/>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ───── Glow background ──────────────────────────────────────────────
function AmbientGlow({ pos = "top", color = "rgba(0,223,130,0.18)" }) {
  const placements = {
    top:    { top: -100, left: "50%", transform: "translateX(-50%)" },
    bottom: { bottom: -120, left: "50%", transform: "translateX(-50%)" },
    bottomRight: { bottom: -120, right: -80 },
  };
  return (
    <div aria-hidden style={{
      position: "absolute", width: 360, height: 360, borderRadius: 999,
      filter: "blur(80px)", background: color, pointerEvents: "none",
      ...placements[pos],
    }}/>
  );
}

Object.assign(window, {
  // icons
  IconChevLeft, IconChevRight, IconChevRightSm, IconZap, IconTrash, IconCalendar,
  IconMapPin, IconUsers, IconUser, IconBarChart, IconArrowR, IconPencil, IconMore,
  IconGrid, IconCheck, IconShare, IconHome, IconHomeFilled, IconStar, IconPlus,
  // atoms
  Eyebrow, Tile, Badge, ResultChip, PrimaryCTA, BackPill, IconPill,
  ProgressBar, Card, BottomTabBar, AmbientGlow,
});
