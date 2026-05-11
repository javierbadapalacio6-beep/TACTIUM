// TACTIUM — Onboarding 2: Añadir jugadores

function ScreenAddPlayers({ onNext, onBack, players, setPlayers }) {
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newPts, setNewPts] = React.useState('');
  const [newSide, setNewSide] = React.useState('Drive');

  const add = () => {
    if (!newName) return;
    const id = 'np' + Date.now();
    setPlayers([...players, { id, name: newName, pts: parseInt(newPts) || 200, avail: true, pos: newSide }]);
    setNewName(''); setNewPts(''); setNewSide('Drive'); setAdding(false);
  };
  const cycleSide = (id) => {
    const order = ['Drive', 'Revés', 'Ambos'];
    setPlayers(players.map(p => p.id === id
      ? { ...p, pos: order[(order.indexOf(p.pos) + 1) % 3] }
      : p));
  };
  const remove = (id) => setPlayers(players.filter(p => p.id !== id));

  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Header */}
      <div style={{ paddingTop: 60, padding: '60px 20px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, border: 'none', background: 'transparent',
          color: TACTIUM.textMuted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconBack /></button>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 22, height: 3, borderRadius: 2, background: TACTIUM.primary }} />
          <div style={{ width: 22, height: 3, borderRadius: 2, background: TACTIUM.accent }} />
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '32px 24px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>Paso 02 — Plantilla</div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05,
                      marginBottom: 8 }}>Añade jugadores</div>
        <div style={{ fontSize: 15, color: TACTIUM.textMuted, lineHeight: 1.4 }}>
          Mínimo 10 jugadores. Los puntos FEP determinan el orden de las parejas.
        </div>
      </div>

      {/* Counter strip */}
      <div style={{ margin: '20px 24px 8px', display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: TACTIUM.textMuted, letterSpacing: 1 }}>
          {String(players.length).padStart(2,'0')} / 10 mínimo
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.textFaint, letterSpacing: 1 }}>
          Σ {players.reduce((a,p)=>a+p.pts,0)} pts
        </div>
      </div>

      {/* Player list — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                      border: `1px solid ${TACTIUM.hair}`, overflow: 'hidden' }}>
          {players.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i < players.length - 1 ? `1px solid ${TACTIUM.hair}` : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: TACTIUM.primaryDim, color: TACTIUM.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 12, fontWeight: 500,
              }}>{String(i+1).padStart(2,'0')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>{p.name}</div>
                <button onClick={() => cycleSide(p.id)} style={{
                  marginTop: 3, padding: '2px 8px', borderRadius: 6,
                  background: 'transparent', border: `1px solid ${TACTIUM.hair}`,
                  color: TACTIUM.textFaint, fontFamily: MONO, fontSize: 10,
                  letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
                }}>{p.pos}</button>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: TACTIUM.text,
                            background: TACTIUM.bgRaised, padding: '4px 10px', borderRadius: 8,
                            letterSpacing: 0.4 }}>{p.pts}</div>
              <button onClick={() => remove(p.id)} style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'transparent', color: TACTIUM.textFaint,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconX /></button>
            </div>
          ))}

          {/* Add row */}
          {adding ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
                          background: TACTIUM.bgCard2 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={newName} onChange={e=>setNewName(e.target.value)}
                  placeholder="Nombre"
                  autoFocus
                  style={{
                    flex: 1, background: TACTIUM.bgRaised, border: `1px solid ${TACTIUM.hairStrong}`,
                    borderRadius: 10, padding: '10px 12px', color: TACTIUM.text,
                    fontFamily: FONT, fontSize: 14, outline: 'none',
                  }} />
                <input value={newPts} onChange={e=>setNewPts(e.target.value)}
                  placeholder="Pts" type="number"
                  style={{
                    width: 64, background: TACTIUM.bgRaised, border: `1px solid ${TACTIUM.hairStrong}`,
                    borderRadius: 10, padding: '10px 12px', color: TACTIUM.text,
                    fontFamily: MONO, fontSize: 14, outline: 'none', textAlign: 'center',
                  }} />
                <button onClick={add} style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: TACTIUM.accent, color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><IconCheck /></button>
              </div>
              <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10,
                            background: TACTIUM.bgRaised, border: `1px solid ${TACTIUM.hair}` }}>
                {['Drive', 'Revés', 'Ambos'].map(s => {
                  const sel = newSide === s;
                  return (
                    <button key={s} onClick={() => setNewSide(s)} style={{
                      flex: 1, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: sel ? TACTIUM.accent : 'transparent',
                      color: sel ? '#000' : TACTIUM.textMuted,
                      fontFamily: FONT, fontSize: 12, fontWeight: 500, letterSpacing: 0.3,
                      transition: 'all 180ms',
                    }}>{s}</button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              width: '100%', padding: '14px 16px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              color: TACTIUM.accent, fontFamily: FONT, fontSize: 15, fontWeight: 500,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 10,
                            background: TACTIUM.primaryDim, color: TACTIUM.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconPlus />
              </div>
              Añadir jugador
            </button>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 20px 40px' }}>
        <button onClick={onNext} style={{
          width: '100%', height: 56, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: TACTIUM.accent, color: '#000',
          fontFamily: FONT, fontWeight: 500, fontSize: 17, letterSpacing: -0.2,
          boxShadow: `0 8px 24px ${TACTIUM.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>Entrar al equipo <IconChevron size={14} color="#000" /></button>
      </div>
    </div>
  );
}

window.ScreenAddPlayers = ScreenAddPlayers;
