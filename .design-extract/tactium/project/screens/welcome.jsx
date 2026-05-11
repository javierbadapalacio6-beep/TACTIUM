// TACTIUM — Welcome / intro carousel (pre-login)

function ScreenWelcome({ onFinish }) {
  const [step, setStep] = React.useState(0);
  const slides = [
    {
      tag: 'PADEL FIRST · SPORTS ALWAYS',
      title: 'El laboratorio\ntáctico de tu equipo',
      body: 'Decisiones basadas en datos. Alineaciones inteligentes. Siempre un paso por delante.',
      Visual: HeroVisual,
    },
    {
      tag: '01 · DISPONIBILIDAD',
      title: 'Sabe quién juega\nen segundos',
      body: 'Tus jugadores marcan disponibilidad con un toque. Tú ves el equipo listo antes de cada jornada.',
      Visual: AvailVisual,
    },
    {
      tag: '02 · ALINEACIONES',
      title: 'Crea parejas\nque ganan',
      body: 'Forma parejas, ordénalas por puntos, valida la regla oficial al instante. Sin hojas, sin errores.',
      Visual: LineupVisual,
    },
    {
      tag: '03 · TEMPORADA',
      title: 'Lleva el control\nde la liga',
      body: 'Jornadas, resultados, racha y tasa de victoria. Toda la temporada en una sola pantalla.',
      Visual: SeasonVisual,
    },
  ];
  const s = slides[step];
  const last = step === slides.length - 1;

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: TACTIUM.bg, color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: -120, left: -80, right: -80, height: 480,
        background: `radial-gradient(60% 70% at 50% 50%, ${TACTIUM.primary}55, transparent 70%)`,
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: '15%', width: 380, height: 380,
        background: `radial-gradient(circle, ${TACTIUM.accent}1f, transparent 70%)`,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '64px 24px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TactiumMark size={22} gradient />
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 4, color: TACTIUM.text }}>TACTIUM</div>
        </div>
        {!last ? (
          <button onClick={onFinish} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TACTIUM.textMuted, fontFamily: FONT, fontSize: 14, fontWeight: 500,
          }}>Saltar</button>
        ) : <div style={{ width: 48 }} />}
      </div>

      {/* Visual */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px 0',
      }} key={step /* trigger fade-in on step change */}>
        <div style={{ animation: 'tactiumFadeUp .5s ease-out both' }}>
          <s.Visual />
        </div>
      </div>

      {/* Copy */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 28px' }}>
        <div style={{
          fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
          textTransform: 'uppercase', fontWeight: 500, marginBottom: 14,
          fontFamily: MONO,
        }}>{s.tag}</div>
        <div style={{
          fontSize: 32, lineHeight: 1.05, fontWeight: 500,
          letterSpacing: -0.8, marginBottom: 14, whiteSpace: 'pre-line',
        }}>
          {s.title.split('\n').map((line, i) => (
            <div key={i}>
              {i === s.title.split('\n').length - 1 && step !== 0
                ? <span>{line.split(' ').slice(0, -1).join(' ')} <span style={{ color: TACTIUM.accent }}>{line.split(' ').slice(-1)[0]}</span></span>
                : line}
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 15, lineHeight: 1.5, color: TACTIUM.textMuted,
          maxWidth: 320,
        }}>{s.body}</div>
      </div>

      {/* Dots + CTA */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '28px 24px 36px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-start', paddingLeft: 4 }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              height: 4, borderRadius: 2, transition: 'all .3s',
              width: i === step ? 24 : 6,
              background: i === step ? TACTIUM.accent : 'rgba(232,245,239,0.18)',
              boxShadow: i === step ? `0 0 8px ${TACTIUM.accent}80` : 'none',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              width: 56, height: 56, borderRadius: 28, cursor: 'pointer',
              background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hairStrong}`,
              color: TACTIUM.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M15 6l-6 6 6 6"/>
              </svg>
            </button>
          )}
          <button onClick={() => last ? onFinish() : setStep(step + 1)} style={{
            flex: 1, height: 56, borderRadius: 28, cursor: 'pointer',
            background: TACTIUM.accent, color: '#000', border: 'none',
            fontFamily: FONT, fontSize: 16, fontWeight: 500, letterSpacing: -0.2,
            boxShadow: `0 12px 30px ${TACTIUM.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {last ? 'Empezar' : 'Continuar'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tactiumFadeUp {
          from { opacity: 0; transform: translateY(12px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tactiumPulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%      { opacity: .8;  transform: scale(1.06); }
        }
        @keyframes tactiumDash {
          to { stroke-dashoffset: -24; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- Visuals ---------------- */

function HeroVisual() {
  // Padel court schematic with player dots & trajectory
  return (
    <svg width="280" height="220" viewBox="0 0 280 220">
      <defs>
        <linearGradient id="court" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TACTIUM.primary} stopOpacity=".55"/>
          <stop offset="100%" stopColor={TACTIUM.bg} stopOpacity=".3"/>
        </linearGradient>
      </defs>
      <rect x="20" y="14" width="240" height="180" rx="6"
            fill="url(#court)" stroke={TACTIUM.accent} strokeOpacity=".55" strokeWidth="1.2"/>
      <line x1="20" y1="104" x2="260" y2="104" stroke={TACTIUM.accent} strokeOpacity=".7" strokeWidth="1.2" strokeDasharray="4 4"/>
      <line x1="140" y1="14" x2="140" y2="60" stroke={TACTIUM.accent} strokeOpacity=".25" strokeWidth="1"/>
      <line x1="140" y1="148" x2="140" y2="194" stroke={TACTIUM.accent} strokeOpacity=".25" strokeWidth="1"/>
      <line x1="20" y1="60" x2="260" y2="60" stroke={TACTIUM.accent} strokeOpacity=".25" strokeWidth="1"/>
      <line x1="20" y1="148" x2="260" y2="148" stroke={TACTIUM.accent} strokeOpacity=".25" strokeWidth="1"/>

      {/* Trayectoria sutil entre los jugadores de fondo (cruzada) */}
      <path d="M 55 175 Q 140 105 225 50" fill="none"
            stroke={TACTIUM.accent} strokeWidth="1.2" strokeDasharray="3 4" opacity=".35"
            style={{ animation: 'tactiumDash 1.2s linear infinite' }}/>

      {/* Players — parejas bien separadas, una pareja con un jugador a la derecha del PLAN y otra con un jugador a la izquierda */}
      {[
        [55, 175],  [200, 135],   // pareja inferior (lado A): exterior izq + interior derecha (al lado del PLAN)
        [80, 80],   [225, 50],    // pareja superior (lado B): interior izquierda (al lado del PLAN) + exterior dcha
      ].map(([x,y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" fill={TACTIUM.accent} opacity=".15"
                  style={{ animation: `tactiumPulse 2s ease-in-out ${i*.2}s infinite` }}/>
          <circle cx={x} cy={y} r="5" fill={TACTIUM.accent}/>
        </g>
      ))}

      {/* Score chip */}
      <g transform="translate(140, 104)">
        <circle r="22" fill={TACTIUM.bg} stroke={TACTIUM.accent} strokeOpacity=".6"/>
        <text textAnchor="middle" y="2" fill={TACTIUM.accent}
              fontFamily="JetBrains Mono" fontSize="9" letterSpacing="1">PLAN</text>
        <text textAnchor="middle" y="13" fill={TACTIUM.text}
              fontFamily="JetBrains Mono" fontSize="7" opacity=".6">ADAPT · WIN</text>
      </g>
    </svg>
  );
}

function AvailVisual() {
  const rows = [
    { name: 'Jugador 01', pts: '6.2', on: true },
    { name: 'Jugador 02', pts: '5.8', on: true },
    { name: 'Jugador 03', pts: '5.4', on: false },
    { name: 'Jugador 04', pts: '5.1', on: true },
  ];
  return (
    <div style={{
      width: 290, padding: 14, borderRadius: 18,
      background: `linear-gradient(180deg, ${TACTIUM.bgCard}, ${TACTIUM.bgRaised})`,
      border: `1px solid ${TACTIUM.hair}`,
      boxShadow: `0 30px 60px rgba(0,0,0,.5), 0 0 0 1px ${TACTIUM.accent}10`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint, fontFamily: MONO }}>DISPONIBILIDAD</div>
        <div style={{ fontSize: 10, color: TACTIUM.accent, fontFamily: MONO }}>3 / 4</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: i < rows.length - 1 ? `1px solid ${TACTIUM.hair}` : 'none',
          animation: `tactiumFadeUp .4s ease-out ${i * .08}s both`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14,
                          background: TACTIUM.bg, border: `1px solid ${TACTIUM.hairStrong}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: TACTIUM.textMuted, fontFamily: MONO }}>
              {String(i+1).padStart(2,'0')}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: 10, color: TACTIUM.textFaint, fontFamily: MONO }}>{r.pts} PTS</div>
            </div>
          </div>
          <div style={{
            width: 40, height: 24, borderRadius: 12,
            background: r.on ? TACTIUM.accent : 'rgba(232,245,239,0.12)',
            position: 'relative', transition: 'all .3s',
            boxShadow: r.on ? `0 0 12px ${TACTIUM.accent}60` : 'none',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 9, background: '#fff',
              position: 'absolute', top: 3, transition: 'all .3s',
              left: r.on ? 19 : 3,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupVisual() {
  const pairs = [
    { a: '01', b: '02', sum: 12.0, ok: true },
    { a: '03', b: '04', sum: 10.5, ok: true },
    { a: '05', b: '06', sum: 9.2,  ok: true },
  ];
  return (
    <div style={{
      width: 290, padding: 16, borderRadius: 18,
      background: `linear-gradient(180deg, ${TACTIUM.bgCard}, ${TACTIUM.bgRaised})`,
      border: `1px solid ${TACTIUM.hair}`,
      boxShadow: `0 30px 60px rgba(0,0,0,.5), 0 0 0 1px ${TACTIUM.accent}10`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint, fontFamily: MONO }}>ALINEACIÓN</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 8px', borderRadius: 10,
                      background: `${TACTIUM.accent}15`, border: `1px solid ${TACTIUM.accent}40` }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: TACTIUM.accent,
                          boxShadow: `0 0 6px ${TACTIUM.accent}` }} />
          <span style={{ fontSize: 9, color: TACTIUM.accent, fontFamily: MONO, letterSpacing: 1 }}>VÁLIDA</span>
        </div>
      </div>
      {pairs.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 8, borderRadius: 12,
          background: TACTIUM.bg, border: `1px solid ${TACTIUM.hair}`,
          animation: `tactiumFadeUp .4s ease-out ${i * .1}s both`,
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 11,
                        background: TACTIUM.accent, color: '#000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, fontFamily: MONO }}>{i+1}</div>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {[p.a, p.b].map((n, j) => (
              <div key={j} style={{
                flex: 1, padding: '6px 10px', borderRadius: 8,
                background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hair}`,
                fontSize: 11, fontFamily: MONO, color: TACTIUM.text,
              }}>P{n}</div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 500, color: TACTIUM.accent }}>
            {p.sum.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeasonVisual() {
  const journeys = [
    { v: 'V', c: TACTIUM.accent }, { v: 'V', c: TACTIUM.accent },
    { v: 'D', c: '#FF5C5C' },      { v: 'V', c: TACTIUM.accent },
    { v: 'E', c: '#FFB547' },      { v: 'V', c: TACTIUM.accent },
    { v: '·', c: TACTIUM.textFaint }, { v: '·', c: TACTIUM.textFaint },
  ];
  return (
    <div style={{
      width: 290, padding: 18, borderRadius: 18,
      background: `linear-gradient(180deg, ${TACTIUM.bgCard}, ${TACTIUM.bgRaised})`,
      border: `1px solid ${TACTIUM.hair}`,
      boxShadow: `0 30px 60px rgba(0,0,0,.5), 0 0 0 1px ${TACTIUM.accent}10`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint, fontFamily: MONO }}>TEMPORADA 25/26</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>2ª Categoría</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: TACTIUM.accent, fontFamily: MONO, letterSpacing: -0.5 }}>67%</div>
          <div style={{ fontSize: 9, color: TACTIUM.textFaint, fontFamily: MONO, letterSpacing: 1 }}>VICTORIAS</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 14 }}>
        {journeys.map((j, i) => (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: 8,
            background: j.v === '·' ? 'transparent' : `${j.c}18`,
            border: `1px solid ${j.v === '·' ? TACTIUM.hair : j.c + '50'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: j.c, fontFamily: MONO, fontSize: 11, fontWeight: 600,
            animation: `tactiumFadeUp .4s ease-out ${i * .05}s both`,
          }}>{j.v}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: `1px solid ${TACTIUM.hair}` }}>
        {[['JUGADAS','6'], ['VICT.','4'], ['EMP.','1'], ['DERR.','1']].map(([l,v]) => (
          <div key={l} style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontFamily: MONO, fontWeight: 500, color: TACTIUM.text }}>{v}</div>
            <div style={{ fontSize: 9, color: TACTIUM.textFaint, fontFamily: MONO, letterSpacing: 1 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ScreenWelcome = ScreenWelcome;
