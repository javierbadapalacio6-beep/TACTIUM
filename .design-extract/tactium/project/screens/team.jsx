// TACTIUM — Equipo (gestión)

function ScreenTeam({ onBack, players, setPlayers }) {
  const [editing, setEditing] = React.useState(null); // player or null
  const [adding, setAdding] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const sorted = [...players].sort((a,b) => b.pts - a.pts);
  const shown = sorted.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()));
  const totalPts = players.reduce((a,p)=>a+p.pts,0);
  const avg = Math.round(totalPts / players.length);

  const updatePlayer = (id, patch) => {
    setPlayers(players.map(p => p.id === id ? { ...p, ...patch } : p));
  };
  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id));
    setEditing(null);
  };
  const addPlayer = (data) => {
    const id = 'np' + Date.now();
    setPlayers([...players, { id, name: data.name, pts: data.pts, avail: true, pos: data.pos }]);
    setAdding(false);
  };

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
        <button onClick={() => setAdding(true)} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.accent}50`,
          background: `${TACTIUM.accent}15`, color: TACTIUM.accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
        }}><IconPlus size={14} /> Añadir</button>
      </div>

      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 8 }}>Padel Club · 2ª</div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Plantilla
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16,
                      paddingTop: 16, borderTop: `1px solid ${TACTIUM.hair}` }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500,
                          color: TACTIUM.text, letterSpacing: -0.4, lineHeight: 1 }}>{players.length}</div>
            <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5,
                          textTransform: 'uppercase', marginTop: 6 }}>Jugadores</div>
          </div>
          <div style={{ width: 1, background: TACTIUM.hair }} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500,
                          color: TACTIUM.accent, letterSpacing: -0.4, lineHeight: 1 }}>{totalPts}</div>
            <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5,
                          textTransform: 'uppercase', marginTop: 6 }}>Σ pts</div>
          </div>
          <div style={{ width: 1, background: TACTIUM.hair }} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500,
                          color: TACTIUM.text, letterSpacing: -0.4, lineHeight: 1 }}>{avg}</div>
            <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5,
                          textTransform: 'uppercase', marginTop: 6 }}>Media</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{
          height: 38, borderRadius: 11, padding: '0 12px',
          background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hair}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke={TACTIUM.textFaint} strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke={TACTIUM.textFaint} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador" style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: TACTIUM.text, fontFamily: FONT, fontSize: 14,
          }} />
          {search && (
            <button onClick={() => setSearch('')} style={{
              border: 'none', background: 'transparent', color: TACTIUM.textFaint,
              cursor: 'pointer', display: 'flex',
            }}><IconX size={12} /></button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 30px' }}>
        <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                      border: `1px solid ${TACTIUM.hair}`, overflow: 'hidden' }}>
          {shown.map((p, i) => (
            <div key={p.id} onClick={() => setEditing(p)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', cursor: 'pointer',
              borderBottom: i < shown.length - 1 ? `1px solid ${TACTIUM.hair}` : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: TACTIUM.primaryDim, color: TACTIUM.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 11, fontWeight: 500,
              }}>#{String(i+1).padStart(2,'0')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2,
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name}
                  {!p.avail && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                   background: `${TACTIUM.warn}20`, color: TACTIUM.warn,
                                   letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>BAJA</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: TACTIUM.textFaint, marginTop: 2,
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{p.pos}</span>
                  <span style={{ width: 2, height: 2, borderRadius: '50%', background: TACTIUM.textFaint }} />
                  <span style={{ fontFamily: MONO }}>{p.pts} pts</span>
                </div>
              </div>
              {/* points pill with rank */}
              <div style={{
                fontFamily: MONO, fontSize: 12, padding: '4px 10px', borderRadius: 8,
                color: i < 2 ? TACTIUM.accent : TACTIUM.text,
                background: i < 2 ? `${TACTIUM.accent}10` : TACTIUM.bgRaised,
                border: `1px solid ${i < 2 ? TACTIUM.accent + '30' : TACTIUM.hair}`,
                letterSpacing: 0.4,
              }}>{p.pts}</div>
              <IconChevron color={TACTIUM.textFaint} />
            </div>
          ))}
          {shown.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center',
                          fontSize: 13, color: TACTIUM.textFaint }}>
              Ningún jugador encontrado
            </div>
          )}
        </div>
      </div>

      {editing && <EditPlayerSheet player={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => { updatePlayer(editing.id, patch); setEditing(null); }}
        onRemove={() => removePlayer(editing.id)} />}
      {adding && <AddPlayerSheet onClose={() => setAdding(false)} onAdd={addPlayer} />}
    </div>
  );
}

function EditPlayerSheet({ player, onClose, onSave, onRemove }) {
  const [name, setName] = React.useState(player.name);
  const [pts, setPts]   = React.useState(player.pts);
  const [pos, setPos]   = React.useState(player.pos);
  const [avail, setAvail] = React.useState(player.avail);

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
                        textTransform: 'uppercase', fontWeight: 500 }}>Editar</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4, marginTop: 4 }}>
            {player.name}
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <FormRow label="Nombre">
            <input value={name} onChange={e=>setName(e.target.value)} style={inputStyle} />
          </FormRow>
          <FormRow label="Puntos FEP">
            <input type="number" value={pts} onChange={e=>setPts(parseInt(e.target.value)||0)} style={{...inputStyle, fontFamily: MONO}} />
          </FormRow>
          <FormRow label="Posición">
            <div style={{ display: 'flex', gap: 6 }}>
              {['Drive', 'Revés'].map(p => (
                <button key={p} onClick={()=>setPos(p)} style={{
                  flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                  background: pos === p ? TACTIUM.accent : TACTIUM.bgCard,
                  color: pos === p ? '#000' : TACTIUM.text,
                  border: `1px solid ${pos === p ? TACTIUM.accent : TACTIUM.hairStrong}`,
                  fontFamily: FONT, fontSize: 14, fontWeight: 500,
                }}>{p}</button>
              ))}
            </div>
          </FormRow>
          <FormRow label="Disponibilidad">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', background: TACTIUM.bgCard, borderRadius: 11,
                          border: `1px solid ${TACTIUM.hairStrong}` }}>
              <div style={{ fontSize: 14, color: avail ? TACTIUM.text : TACTIUM.textMuted }}>
                {avail ? 'Disponible' : 'No disponible'}
              </div>
              <div onClick={() => setAvail(!avail)} style={{
                width: 50, height: 30, borderRadius: 15, padding: 2, cursor: 'pointer',
                background: avail ? TACTIUM.accent : TACTIUM.bgRaised,
                border: `1px solid ${avail ? TACTIUM.accent : TACTIUM.hairStrong}`,
                display: 'flex', alignItems: 'center',
                justifyContent: avail ? 'flex-end' : 'flex-start',
                transition: 'all 200ms',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: avail ? '#000' : TACTIUM.text,
                }} />
              </div>
            </div>
          </FormRow>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onRemove} style={{
              flex: 1, height: 50, borderRadius: 13, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${TACTIUM.err}40`,
              color: TACTIUM.err, fontFamily: FONT, fontSize: 14, fontWeight: 500,
            }}>Eliminar</button>
            <button onClick={() => onSave({ name, pts, pos, avail })} style={{
              flex: 2, height: 50, borderRadius: 13, cursor: 'pointer',
              background: TACTIUM.accent, color: '#000', border: 'none',
              fontFamily: FONT, fontSize: 15, fontWeight: 500,
              boxShadow: `0 8px 20px ${TACTIUM.accent}40`,
            }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPlayerSheet({ onClose, onAdd }) {
  const [name, setName] = React.useState('');
  const [pts, setPts]   = React.useState(300);
  const [pos, setPos]   = React.useState('Drive');

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
                        textTransform: 'uppercase', fontWeight: 500 }}>Nuevo</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4, marginTop: 4 }}>
            Añadir jugador
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <FormRow label="Nombre">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Player 13"
              autoFocus style={inputStyle} />
          </FormRow>
          <FormRow label="Puntos FEP">
            <input type="number" value={pts} onChange={e=>setPts(parseInt(e.target.value)||0)}
              style={{...inputStyle, fontFamily: MONO}} />
          </FormRow>
          <FormRow label="Posición">
            <div style={{ display: 'flex', gap: 6 }}>
              {['Drive', 'Revés'].map(p => (
                <button key={p} onClick={()=>setPos(p)} style={{
                  flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                  background: pos === p ? TACTIUM.accent : TACTIUM.bgCard,
                  color: pos === p ? '#000' : TACTIUM.text,
                  border: `1px solid ${pos === p ? TACTIUM.accent : TACTIUM.hairStrong}`,
                  fontFamily: FONT, fontSize: 14, fontWeight: 500,
                }}>{p}</button>
              ))}
            </div>
          </FormRow>

          <button disabled={!name} onClick={() => onAdd({ name, pts, pos })} style={{
            width: '100%', height: 52, marginTop: 16, borderRadius: 13, border: 'none',
            cursor: name ? 'pointer' : 'default',
            background: TACTIUM.accent, color: '#000',
            fontFamily: FONT, fontSize: 16, fontWeight: 500,
            boxShadow: name ? `0 8px 20px ${TACTIUM.accent}40` : 'none',
            opacity: name ? 1 : 0.4,
          }}>Añadir al equipo</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  height: 46, borderRadius: 11, padding: '0 14px',
  background: '#0C2222', border: '1px solid rgba(232,245,239,0.10)',
  color: '#E8F5EF', fontFamily: '"Satoshi", system-ui', fontSize: 15, fontWeight: 500,
  outline: 'none',
};

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,245,239,0.32)',
                    textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4,
                    fontFamily: '"Satoshi", system-ui' }}>{label}</div>
      {children}
    </div>
  );
}

window.ScreenTeam = ScreenTeam;
