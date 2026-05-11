// TACTIUM — Jornada (match-day overview)

function ScreenJornada({ onBack, onCreateLineup, onAddResults, lineupReady, matchResults }) {
  const [showShare, setShowShare] = React.useState(false);
  const matches = [
    { i: 1, label: 'J. Ruiz / D. Casas',  pts: '1.180', tag: 'P1' },
    { i: 2, label: 'S. Caro / E. Vela',   pts: '1.080', tag: 'P2' },
    { i: 3, label: 'A. Bravo / N. León',  pts: '980',   tag: 'P3' },
    { i: 4, label: 'O. Mora / R. Lago',   pts: '910',   tag: 'P4' },
    { i: 5, label: 'P. Soto / M. Vidal',  pts: '850',   tag: 'P5' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* nav */}
      <div style={{ paddingTop: 60, padding: '60px 20px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.hairStrong}`, background: TACTIUM.bgCard,
          color: TACTIUM.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 14, fontWeight: 500,
        }}><IconBack size={16} /> Inicio</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lineupReady && (
            <button onClick={() => setShowShare(true)} style={{
              height: 36, padding: '0 12px', borderRadius: 12,
              border: `1px solid ${TACTIUM.accent}50`,
              background: `${TACTIUM.accent}12`, color: TACTIUM.accent, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
            }}>
              <IconShare size={14} color={TACTIUM.accent} /> Compartir
            </button>
          )}
          <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.textFaint, letterSpacing: 1.5 }}>J·07 / 18</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
        {/* Hero header */}
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 6 }}>Jornada 07</div>
        <div style={{ fontSize: 38, fontWeight: 500, letterSpacing: -1.2, lineHeight: 1.05 }}>
          vs. Club<br/>Visitante
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <Tag>Domingo 03 May</Tag>
          <Tag>10:00</Tag>
          <Tag>Pista local</Tag>
          <Tag dim>· Liga 25/26</Tag>
        </div>

        {/* Aggregated team score — visible en vivo */}
        {lineupReady && matchResults && (() => {
          const score = (window.computeTeamScore || (() => ({us:0,them:0,played:0})))(matchResults);
          const any = score.played > 0;
          const won = score.us > score.them, lost = score.them > score.us;
          const tint = !any ? TACTIUM.textFaint
                     : won  ? TACTIUM.accent
                     : lost ? TACTIUM.err
                     : TACTIUM.warn;
          return (
            <button onClick={() => onAddResults && onAddResults(0)} style={{
              marginTop: 18, padding: '14px 16px', width: '100%',
              background: TACTIUM.bgCard, borderRadius: 14,
              border: `1px solid ${any ? tint + '40' : TACTIUM.hair}`,
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint,
                              textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
                  Marcador del equipo
                </div>
                <div style={{ fontSize: 11, color: any ? tint : TACTIUM.textMuted,
                              fontFamily: MONO, letterSpacing: 0.5 }}>
                  {any ? `${score.played}/5 partidos resueltos` : 'Aún sin resultados'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 500,
                               color: any ? tint : TACTIUM.textFaint, letterSpacing: -0.8 }}>
                  {any ? score.us : '—'}
                </span>
                <span style={{ width: 1, height: 22, background: TACTIUM.hairStrong }} />
                <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 500,
                               color: any ? TACTIUM.text : TACTIUM.textFaint, letterSpacing: -0.8 }}>
                  {any ? score.them : '—'}
                </span>
              </div>
            </button>
          );
        })()}

        {/* Match list */}
        <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 14 }}>
          <div style={{ ...TYPE.eyebrow, color: TACTIUM.textFaint }}>Parejas · 5 partidos</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 9999,
            background: lineupReady ? `${TACTIUM.accent}15` : `${TACTIUM.warn}15`,
            border: `1px solid ${lineupReady ? TACTIUM.accent + '35' : TACTIUM.warn + '35'}`,
            fontSize: 11, fontWeight: 500,
            color: lineupReady ? TACTIUM.accent : TACTIUM.warn,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: lineupReady ? TACTIUM.accent : TACTIUM.warn,
            }} />
            {lineupReady ? 'Validada' : 'Pendiente'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(m => (
            <MatchRow key={m.i} m={m} ready={lineupReady}
              onClick={() => lineupReady && onAddResults && onAddResults(m.i - 1)} />
          ))}
        </div>

        {lineupReady && (
          <div style={{ marginTop: 10, fontSize: 11, color: TACTIUM.textFaint,
                        letterSpacing: 0.3, textAlign: 'center' }}>
            Toca una pareja para registrar su resultado
          </div>
        )}

        {/* Court legend */}
        <div style={{
          marginTop: 22, padding: '14px 16px',
          background: TACTIUM.bgCard, borderRadius: 14,
          border: `1px solid ${TACTIUM.hair}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <IconAlert size={16} color={TACTIUM.warn} />
          <div style={{ fontSize: 13, color: TACTIUM.textMuted, lineHeight: 1.4 }}>
            La pareja con <span style={{ color: TACTIUM.text, fontWeight: 500 }}>más puntos</span> debe jugar
            en <span style={{ color: TACTIUM.text }}>Pareja 1</span>. Orden descendente.
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onCreateLineup} style={{
          width: '100%', height: 56, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: TACTIUM.accent, color: '#000',
          fontFamily: FONT, fontWeight: 500, fontSize: 17,
          boxShadow: `0 8px 24px ${TACTIUM.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <IconCourt color="#000" size={20} />
          {lineupReady ? 'Editar alineación' : 'Crear alineación'}
        </button>
        {lineupReady && (
          <button onClick={onAddResults} style={{
            width: '100%', height: 48, borderRadius: 14, cursor: 'pointer',
            background: 'transparent', color: TACTIUM.accent,
            border: `1px solid ${TACTIUM.accent}40`,
            fontFamily: FONT, fontWeight: 500, fontSize: 14, letterSpacing: -0.1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Añadir resultados <span style={{ color: TACTIUM.textFaint, fontSize: 12 }}>· opcional</span>
          </button>
        )}
      </div>

      {showShare && <ShareLineupSheet matches={matches} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function Tag({ children, dim }) {
  return (
    <div style={{
      padding: '7px 12px', borderRadius: 9999,
      background: dim ? 'transparent' : TACTIUM.bgCard,
      border: `1px solid ${TACTIUM.hairStrong}`,
      fontSize: 12, color: dim ? TACTIUM.textFaint : TACTIUM.text,
      fontWeight: 500, letterSpacing: -0.1,
    }}>{children}</div>
  );
}

function MatchRow({ m, ready, onClick }) {
  const interactive = ready && onClick;
  const isTop = m.i === 1;
  return (
    <button onClick={interactive ? onClick : undefined} style={{
      width: '100%',
      background: TACTIUM.bgCard,
      borderRadius: R.md,
      border: `1px solid ${isTop && ready ? TACTIUM.accent + '25' : TACTIUM.hair}`,
      padding: 16,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: interactive ? 'pointer' : 'default',
      textAlign: 'left',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: isTop && ready ? `${TACTIUM.accent}15` : TACTIUM.bgRaised,
        border: `1px solid ${isTop && ready ? TACTIUM.accent + '35' : TACTIUM.hair}`,
        color: isTop && ready ? TACTIUM.accent : TACTIUM.text,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: TACTIUM.textFaint, letterSpacing: 0.5,
                       textTransform: 'uppercase', fontWeight: 500, lineHeight: 1 }}>P</span>
        <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, lineHeight: 1.15,
                       letterSpacing: -0.5 }}>{m.i}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2,
                      color: ready ? TACTIUM.text : TACTIUM.textMuted,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      marginBottom: 4 }}>
          {ready ? m.label : 'Sin asignar'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isTop && ready && (
            <span style={{
              fontFamily: MONO, fontSize: 9, color: TACTIUM.accent,
              padding: '2px 6px', borderRadius: 4,
              background: `${TACTIUM.accent}15`, letterSpacing: 0.6, fontWeight: 600,
            }}>TOP</span>
          )}
          {ready && m.pts ? (
            <span style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.textMuted,
                           letterSpacing: 0.2 }}>{m.pts} pts</span>
          ) : (
            <span style={{ fontSize: 11, color: TACTIUM.textFaint }}>Pendiente</span>
          )}
        </div>
      </div>

      <IconChevron color={interactive ? TACTIUM.accent : TACTIUM.textFaint} />
    </button>
  );
}

window.ScreenJornada = ScreenJornada;

function IconShare({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function ShareLineupSheet({ matches, onClose }) {
  const [copied, setCopied] = React.useState(false);

  const text = [
    `🎾 *TACTIUM · Jornada 07*`,
    `vs. Club Visitante · Dom 03 May · 10:00`,
    ``,
    `*Alineación*`,
    ...matches.map(m => `P${m.i} — ${m.label}  (${m.pts} pts)`),
    ``,
    `Recuerda confirmar disponibilidad 🟢`,
  ].join('\n');

  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareWhatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ text, title: 'Alineación · Jornada 07' }); }
      catch (e) { /* user cancelled */ }
    } else {
      copy();
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30,
                  display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{
        flex: 1, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', cursor: 'pointer',
      }} />
      <div style={{
        background: TACTIUM.bgRaised,
        borderTop: `1px solid ${TACTIUM.hairStrong}`,
        borderRadius: '24px 24px 0 0',
        padding: '14px 0 30px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
        maxHeight: '85%', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3,
                      background: TACTIUM.hairStrong, margin: '0 auto 14px' }} />
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.accent,
                        textTransform: 'uppercase', fontWeight: 500 }}>Compartir alineación</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4, marginTop: 4 }}>
            Avisa al equipo
          </div>
        </div>

        {/* Preview */}
        <div style={{ margin: '0 20px 18px', padding: 14,
                      background: TACTIUM.bgCard, borderRadius: 14,
                      border: `1px solid ${TACTIUM.hair}`,
                      fontFamily: MONO, fontSize: 12, color: TACTIUM.textMuted,
                      whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 220, overflow: 'auto' }}>
          {text}
        </div>

        {/* Quick actions */}
        <div style={{ padding: '0 20px', display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <ShareBtn label="WhatsApp" tint="#25D366" onClick={shareWhatsapp}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.515 5.276l-.999 3.648 3.973-.623z"/>
            </svg>
          </ShareBtn>
          <ShareBtn label={copied ? '¡Copiado!' : 'Copiar'} tint={TACTIUM.accent} onClick={copy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke={TACTIUM.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {copied
                ? <path d="M5 12l4 4L19 6" />
                : <React.Fragment>
                    <rect x="9" y="9" width="11" height="11" rx="2"/>
                    <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
                  </React.Fragment>}
            </svg>
          </ShareBtn>
          <ShareBtn label="Más" tint={TACTIUM.text} onClick={shareNative}>
            <IconShare size={18} color={TACTIUM.text} />
          </ShareBtn>
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <button onClick={onClose} style={{
            width: '100%', height: 50, borderRadius: 13, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${TACTIUM.hairStrong}`,
            color: TACTIUM.textMuted, fontFamily: FONT, fontSize: 14, fontWeight: 500,
          }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function ShareBtn({ label, tint, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      height: 78, borderRadius: 14, cursor: 'pointer',
      background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hair}`,
      color: TACTIUM.text, fontFamily: FONT, fontSize: 12, fontWeight: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, transition: 'all 180ms',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: `${tint}15`, border: `1px solid ${tint}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{children}</div>
      <span style={{ color: tint }}>{label}</span>
    </button>
  );
}
