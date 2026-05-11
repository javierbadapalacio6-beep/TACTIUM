// TACTIUM — Disponibilidad

function ScreenAvailability({ onBack, players, setPlayers }) {
  const [filter, setFilter] = React.useState('all');

  const toggle = (id) => {
    setPlayers(players.map(p => p.id === id ? { ...p, avail: !p.avail } : p));
  };

  const sorted = [...players].sort((a,b) => b.pts - a.pts);
  const shown = sorted.filter(p =>
    filter === 'all' ? true : filter === 'on' ? p.avail : !p.avail
  );
  const availCount = players.filter(p=>p.avail).length;

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
        <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.accent, letterSpacing: 1.5 }}>
          {availCount}/{players.length} DISP.
        </div>
      </div>

      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Jornada 07</div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Disponibilidad
        </div>
        <div style={{ fontSize: 14, color: TACTIUM.textMuted, marginTop: 8 }}>
          Toca el toggle para confirmar quién juega.
        </div>
      </div>

      {/* segmented filter */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: TACTIUM.bgCard, borderRadius: 12,
          border: `1px solid ${TACTIUM.hair}`,
        }}>
          {[['all','Todos', players.length], ['on','Disp.', availCount], ['off','No', players.length-availCount]].map(([k, l, c]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              flex: 1, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: filter === k ? TACTIUM.bgRaised : 'transparent',
              color: filter === k ? TACTIUM.text : TACTIUM.textMuted,
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>{l} <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{c}</span></button>
          ))}
        </div>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 30px' }}>
        <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                      border: `1px solid ${TACTIUM.hair}`, overflow: 'hidden' }}>
          {shown.map((p, i) => (
            <div key={p.id} onClick={() => toggle(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i < shown.length - 1 ? `1px solid ${TACTIUM.hair}` : 'none',
              cursor: 'pointer',
              opacity: p.avail ? 1 : 0.55,
              transition: 'opacity 200ms',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                background: p.avail ? TACTIUM.primaryDim : TACTIUM.bgRaised,
                color: p.avail ? TACTIUM.accent : TACTIUM.textFaint,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 12, fontWeight: 500,
              }}>{p.name.split(' ')[1] || (i+1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: TACTIUM.textFaint, marginTop: 1 }}>
                  {p.pos} · {p.pts} pts
                </div>
              </div>
              <Toggle on={p.avail} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{
      width: 50, height: 30, borderRadius: 15, padding: 2,
      background: on ? TACTIUM.accent : TACTIUM.bgRaised,
      border: `1px solid ${on ? TACTIUM.accent : TACTIUM.hairStrong}`,
      display: 'flex', alignItems: 'center',
      justifyContent: on ? 'flex-end' : 'flex-start',
      transition: 'all 200ms ease',
      boxShadow: on ? `0 0 16px ${TACTIUM.accent}50` : 'none',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: on ? '#000' : TACTIUM.text,
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

window.ScreenAvailability = ScreenAvailability;
