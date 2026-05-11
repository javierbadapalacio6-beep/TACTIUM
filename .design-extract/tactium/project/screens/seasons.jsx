// TACTIUM — Temporadas (Centro de organización)

function ScreenSeasons({ onBack, onOpenSeason }) {
  const [creating, setCreating] = React.useState(false);

  const seasons = [
    {
      id: 's2526', name: 'Temporada 25/26', cat: '2ª', state: 'En curso',
      progress: 7, total: 18, wins: 5, losses: 1, draws: 1, active: true,
      phase: 'Liga regular',
    },
    {
      id: 's2425', name: 'Temporada 24/25', cat: '2ª', state: 'Finalizada',
      progress: 18, total: 18, wins: 11, losses: 6, draws: 1, active: false,
      phase: 'Playoff · 4º',
    },
    {
      id: 's2324', name: 'Temporada 23/24', cat: '3ª', state: 'Finalizada',
      progress: 16, total: 16, wins: 13, losses: 3, draws: 0, active: false,
      phase: 'Ascenso ✓',
    },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', position: 'relative',
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
        <button onClick={() => setCreating(true)} style={{
          width: 36, height: 36, borderRadius: 12,
          border: `1px solid ${TACTIUM.accent}50`,
          background: `${TACTIUM.accent}15`, color: TACTIUM.accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconPlus size={16} /></button>
      </div>

      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Padel Club · 2ª</div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Temporadas
        </div>
        <div style={{ fontSize: 14, color: TACTIUM.textMuted, marginTop: 8 }}>
          Organiza ligas, playoffs y temporadas pasadas.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 30px' }}>

        {/* Active season — featured card */}
        {seasons.filter(s => s.active).map(s => (
          <SeasonCardActive key={s.id} s={s} onClick={() => onOpenSeason(s.id)} />
        ))}

        {/* Past header */}
        <div style={{ marginTop: 28, fontSize: 11, letterSpacing: 3, color: TACTIUM.textFaint,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 12,
                      display: 'flex', justifyContent: 'space-between' }}>
          <span>Histórico</span>
          <span style={{ fontFamily: MONO, color: TACTIUM.textFaint }}>
            {seasons.filter(s => !s.active).length} temp.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seasons.filter(s => !s.active).map(s => (
            <SeasonCardPast key={s.id} s={s} onClick={() => onOpenSeason(s.id)} />
          ))}
        </div>

        {/* Create new */}
        <button onClick={() => setCreating(true)} style={{
          marginTop: 14, width: '100%',
          padding: '16px',
          background: 'transparent',
          border: `1.5px dashed ${TACTIUM.hairStrong}`,
          borderRadius: 14, color: TACTIUM.accent,
          fontFamily: FONT, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <IconPlus size={14} /> Crear nueva temporada
        </button>
      </div>

      {creating && <CreateSeasonSheet onClose={() => setCreating(false)} />}
    </div>
  );
}

function SeasonCardActive({ s, onClick }) {
  const pct = Math.round(s.progress / s.total * 100);
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(135deg, ${TACTIUM.primary} 0%, ${TACTIUM.bgCard2} 100%)`,
      borderRadius: 22,
      border: `1px solid ${TACTIUM.accent}40`,
      padding: '20px 22px',
      position: 'relative', overflow: 'hidden', cursor: 'pointer',
    }}>
      {/* watermark */}
      <svg width="200" height="140" viewBox="0 0 200 140" style={{
        position: 'absolute', top: -10, right: -30, opacity: 0.14, pointerEvents: 'none',
      }}>
        <rect x="2" y="2" width="196" height="136" rx="2" stroke={TACTIUM.accent} strokeWidth="1" fill="none"/>
        <path d="M100 2v136M2 70h196M55 2v136M145 2v136" stroke={TACTIUM.accent} strokeWidth="1" />
      </svg>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10 }}>
        <NeonDot size={6} />
        <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.accent, letterSpacing: 1.5 }}>
          ACTIVA · {s.phase.toUpperCase()}
        </div>
      </div>

      <div style={{ position: 'relative', fontSize: 26, fontWeight: 500,
                    letterSpacing: -0.7, lineHeight: 1.1, marginBottom: 4 }}>
        {s.name}
      </div>
      <div style={{ position: 'relative', fontSize: 13, color: TACTIUM.textMuted }}>
        {s.cat} categoría · Jornada {s.progress} de {s.total}
      </div>

      {/* Progress */}
      <div style={{ position: 'relative', marginTop: 18, height: 4, borderRadius: 2,
                    background: 'rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`,
                      background: TACTIUM.accent, borderRadius: 2,
                      boxShadow: `0 0 8px ${TACTIUM.accent}80` }} />
      </div>

      {/* Stats grid */}
      <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 16 }}>
        <SeasonStat label="V" value={s.wins} highlight />
        <SeasonStat label="E" value={s.draws} />
        <SeasonStat label="D" value={s.losses} />
        <SeasonStat label="J" value={`${s.progress}/${s.total}`} />
      </div>
    </div>
  );
}

function SeasonStat({ label, value, highlight }) {
  return (
    <div style={{
      flex: 1, padding: '8px 0', borderRadius: 10,
      background: 'rgba(0,0,0,0.3)', border: `1px solid ${TACTIUM.hairStrong}`,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500,
                    color: highlight ? TACTIUM.accent : TACTIUM.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: TACTIUM.textFaint, letterSpacing: 1.5,
                    textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SeasonCardPast({ s, onClick }) {
  const winRate = Math.round(s.wins / s.total * 100);
  const promoted = s.phase.includes('✓');
  return (
    <div onClick={onClick} style={{
      background: TACTIUM.bgCard, borderRadius: 14,
      border: `1px solid ${TACTIUM.hair}`,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: promoted ? `${TACTIUM.accent}15` : TACTIUM.bgRaised,
        color: promoted ? TACTIUM.accent : TACTIUM.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: 0.5,
      }}>{s.id.slice(1).slice(0,2)}/{s.id.slice(3,5)}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: -0.1 }}>{s.name}</div>
        <div style={{ fontSize: 12, color: TACTIUM.textFaint, marginTop: 2 }}>
          {s.phase} · {s.cat}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: TACTIUM.text }}>
          {s.wins}-{s.draws}-{s.losses}
        </div>
        <div style={{ fontSize: 10, color: TACTIUM.accent, marginTop: 2,
                      letterSpacing: 0.5, fontWeight: 500 }}>{winRate}% V</div>
      </div>

      <IconChevron color={TACTIUM.textFaint} />
    </div>
  );
}

function CreateSeasonSheet({ onClose }) {
  const [name, setName] = React.useState('Temporada 26/27');
  const [phase, setPhase] = React.useState('liga');
  const phases = [
    { id: 'liga', label: 'Liga regular', sub: '18 jornadas' },
    { id: 'playoff', label: 'Playoff', sub: 'Eliminatorias' },
    { id: 'mixto', label: 'Liga + Playoff', sub: 'Formato completo' },
  ];

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
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3,
                      background: TACTIUM.hairStrong, margin: '0 auto 14px' }} />
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.accent,
                        textTransform: 'uppercase', fontWeight: 500 }}>Nueva</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4, marginTop: 4 }}>
            Crear temporada
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.textFaint,
                        textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>Nombre</div>
          <div style={{ background: TACTIUM.bgCard, borderRadius: 12, padding: '14px 16px',
                        border: `1px solid ${TACTIUM.hairStrong}`,
                        display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 5, height: 18, borderRadius: 3, background: TACTIUM.accent }} />
            <input value={name} onChange={e=>setName(e.target.value)} style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: TACTIUM.text, fontFamily: FONT, fontSize: 16, fontWeight: 500,
            }} />
          </div>

          <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.textFaint,
                        textTransform: 'uppercase', margin: '20px 0 8px', paddingLeft: 4 }}>Formato</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {phases.map(p => {
              const sel = phase === p.id;
              return (
                <button key={p.id} onClick={() => setPhase(p.id)} style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12,
                  background: sel ? `${TACTIUM.accent}10` : TACTIUM.bgCard,
                  border: `1px solid ${sel ? TACTIUM.accent + '50' : TACTIUM.hair}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: sel ? TACTIUM.accent : 'transparent',
                    border: `1.5px solid ${sel ? TACTIUM.accent : TACTIUM.hairStrong}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: TACTIUM.text }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: TACTIUM.textFaint, marginTop: 2 }}>{p.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={onClose} style={{
            width: '100%', height: 52, marginTop: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: TACTIUM.accent, color: '#000',
            fontFamily: FONT, fontWeight: 500, fontSize: 16,
            boxShadow: `0 8px 24px ${TACTIUM.accent}40`,
          }}>Crear temporada</button>
        </div>
      </div>
    </div>
  );
}

window.ScreenSeasons = ScreenSeasons;
