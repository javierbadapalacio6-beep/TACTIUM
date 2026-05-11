// TACTIUM iconography — minimal line icons matching brand kit (1.6 stroke)

function IconRacquet({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="10" cy="9" rx="6.5" ry="7" stroke={color} strokeWidth="1.6"/>
      <path d="M14.5 13.5L20 20M20 20l1.5-1.5M20 20l-1.5 1.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M5 6.5h10M5 9h10M5 11.5h10M7.5 4v10M10 4v10M12.5 4v10" stroke={color} strokeWidth="0.8" opacity="0.55"/>
    </svg>
  );
}

function IconCourt({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="1" stroke={color} strokeWidth="1.6"/>
      <path d="M12 5v14M3 12h18M7.5 5v14M16.5 5v14" stroke={color} strokeWidth="1.6" opacity="0.7"/>
    </svg>
  );
}

function IconAnalytics({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20V12M10 20V4M16 20v-6M22 20H2" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconTeam({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3.5" stroke={color} strokeWidth="1.6"/>
      <circle cx="17" cy="10" r="2.8" stroke={color} strokeWidth="1.6"/>
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M15 17c0.5-2 2.4-3.5 4-3.5s2.5 1 3 2.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconFocus({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconCalendar({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.6"/>
      <path d="M3 10h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconChevron({ size = 14, color = 'currentColor', dir = 'right' }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M5 2l5 5-5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function IconCheck({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3 3L13 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function IconPlus({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M2 8h12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconBack({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M11 3l-6 6 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function IconX({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M3 3l8 8M11 3l-8 8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconBolt({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" fill={color}/>
    </svg>
  );
}

function IconAlert({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2L1 14h14L8 2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M8 6v4M8 12v0.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconHandle({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="5" cy="3" r="1" fill={color}/>
      <circle cx="9" cy="3" r="1" fill={color}/>
      <circle cx="5" cy="7" r="1" fill={color}/>
      <circle cx="9" cy="7" r="1" fill={color}/>
      <circle cx="5" cy="11" r="1" fill={color}/>
      <circle cx="9" cy="11" r="1" fill={color}/>
    </svg>
  );
}

// Brand "Aa" mark in a rounded square — matches the logo from the brand kit
// Brand mark — T inside a circle with three descending dots on the left.
// Matches the official TACTIUM brand kit (lime → neon green gradient).
function TactiumMark({ size = 28, color, bg = null, gradient = false, mono = false }) {
  const accent = (typeof TACTIUM !== 'undefined' ? TACTIUM.accent : '#00DF82');
  const stroke = color || (mono ? '#fff' : accent);
  const id = React.useMemo(() => 'tg' + Math.random().toString(36).slice(2, 8), []);
  const useGrad = gradient && !mono;
  const strokeRef = useGrad ? `url(#${id})` : stroke;
  const fillRef   = useGrad ? `url(#${id})` : stroke;

  return (
    <div style={{
      width: size, height: size, borderRadius: bg ? size * 0.22 : 0,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 64 64" fill="none">
        {useGrad && (
          <defs>
            <linearGradient id={id} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#A8FF60" />
              <stop offset="1" stopColor={accent} />
            </linearGradient>
          </defs>
        )}
        {/* Outer circle */}
        <circle cx="32" cy="32" r="26" stroke={strokeRef} strokeWidth="3.2" />
        {/* T — vertical stem + horizontal bar */}
        <path d="M22 20 H44 M33 20 V46" stroke={strokeRef} strokeWidth="3.2"
              strokeLinecap="round" />
        {/* Three descending dots on the left edge of the circle */}
        <circle cx="14" cy="28" r="2.4" fill={fillRef} />
        <circle cx="11" cy="35" r="1.8" fill={fillRef} />
        <circle cx="9"  cy="41" r="1.2" fill={fillRef} />
      </svg>
    </div>
  );
}

// Wordmark — "TACTIUM" in brand letterspacing
function TactiumWordmark({ size = 18, color = '#fff', tagline = false }) {
  const accent = (typeof TACTIUM !== 'undefined' ? TACTIUM.accent : '#00DF82');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <div style={{
        fontFamily: FONT, fontSize: size, fontWeight: 400, color,
        letterSpacing: size * 0.18, textTransform: 'uppercase',
        paddingLeft: size * 0.18, // optical balance for tracking
      }}>TACTIUM</div>
      {tagline && (
        <div style={{
          fontFamily: FONT, fontSize: size * 0.32, color: accent,
          letterSpacing: size * 0.12, textTransform: 'uppercase',
          marginTop: size * 0.45, fontWeight: 500,
        }}>Create. Analyze. Elevate.</div>
      )}
    </div>
  );
}

// Small "ball" dot — neon punctuation
function NeonDot({ size = 8, color }) {
  const c = color || (typeof TACTIUM !== 'undefined' ? TACTIUM.accent : '#00DF82');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: c,
      boxShadow: `0 0 ${size}px ${c}`,
    }} />
  );
}

Object.assign(window, {
  IconRacquet, IconCourt, IconAnalytics, IconTeam, IconFocus, IconCalendar,
  IconChevron, IconCheck, IconPlus, IconBack, IconX, IconBolt, IconAlert, IconHandle,
  TactiumMark, TactiumWordmark, NeonDot,
});
