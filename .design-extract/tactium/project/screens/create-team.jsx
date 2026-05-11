// TACTIUM — Onboarding 1: Crear equipo (one-page form)

function ScreenCreateTeam({ onNext, onBack }) {
  const [name, setName]             = React.useState('Padel Club');
  const [federation, setFederation] = React.useState('');
  const [league, setLeague]         = React.useState('');
  const [cat, setCat]               = React.useState('2ª');
  const [group, setGroup]           = React.useState('');
  const [hasGroup, setHasGroup]     = React.useState(true);
  const cats = ['1ª', '2ª', '3ª', '4ª'];

  const valid = name.trim() && federation.trim() && league.trim() && cat
                && (!hasGroup || group.trim());

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
          <div style={{ width: 28, height: 3, borderRadius: 2, background: TACTIUM.accent,
                        boxShadow: `0 0 8px ${TACTIUM.accent}80` }} />
          <div style={{ width: 18, height: 3, borderRadius: 2, background: TACTIUM.hairStrong }} />
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '28px 24px 0', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 10,
                      fontFamily: MONO }}>Paso 01 · Equipo</div>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: -0.7, lineHeight: 1.05,
                      marginBottom: 6 }}>Crea tu equipo</div>
        <div style={{ fontSize: 14, color: TACTIUM.textMuted, lineHeight: 1.4 }}>
          Configura los datos de la competición. Lo podrás editar después.
        </div>

        {/* Nombre */}
        <div style={{ marginTop: 24 }}>
          <FieldLabel>Nombre del equipo</FieldLabel>
          <div style={{
            background: TACTIUM.bgCard, borderRadius: 14, padding: '14px 16px',
            border: `1px solid ${TACTIUM.hairStrong}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 5, height: 20, borderRadius: 3, background: TACTIUM.accent }} />
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="Padel Club" style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: TACTIUM.text, fontFamily: FONT, fontSize: 17, fontWeight: 500,
            }} />
          </div>
        </div>

        {/* Federación */}
        <div style={{ marginTop: 18 }}>
          <FieldLabel>Federación</FieldLabel>
          <input value={federation} onChange={e => setFederation(e.target.value)}
            placeholder="Federación Española de Pádel" style={ctInputStyle} />
        </div>

        {/* Liga */}
        <div style={{ marginTop: 18 }}>
          <FieldLabel>Liga</FieldLabel>
          <input value={league} onChange={e => setLeague(e.target.value)}
            placeholder="Liga por equipos absoluta" style={ctInputStyle} />
        </div>

        {/* Categoría */}
        <div style={{ marginTop: 18 }}>
          <FieldLabel>Categoría</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {cats.map(c => {
              const sel = cat === c;
              return (
                <button key={c} onClick={() => setCat(c)} style={{
                  height: 52, borderRadius: 12, cursor: 'pointer',
                  background: sel ? TACTIUM.accent : TACTIUM.bgCard,
                  color: sel ? '#000' : TACTIUM.text,
                  border: `1px solid ${sel ? TACTIUM.accent : TACTIUM.hairStrong}`,
                  fontFamily: FONT, fontWeight: 500, fontSize: 18,
                  letterSpacing: -0.4, transition: 'all 200ms',
                }}>{c}</button>
              );
            })}
          </div>
        </div>

        {/* Grupo */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 10 }}>
            <FieldLabel inline>Grupo</FieldLabel>
            <button onClick={() => setHasGroup(!hasGroup)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: TACTIUM.textMuted, fontFamily: FONT, fontSize: 12,
            }}>
              <div style={{
                width: 34, height: 20, borderRadius: 10,
                background: hasGroup ? TACTIUM.accent : 'rgba(232,245,239,0.12)',
                position: 'relative', transition: 'all .3s',
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7, background: '#fff',
                  position: 'absolute', top: 3, transition: 'all .3s',
                  left: hasGroup ? 17 : 3,
                }} />
              </div>
              {hasGroup ? 'Sí' : 'Sin grupos'}
            </button>
          </div>
          {hasGroup && (
            <input value={group} onChange={e => setGroup(e.target.value)}
              placeholder="Grupo A" style={ctInputStyle} />
          )}
        </div>

        {/* Preview */}
        <div style={{ marginTop: 22, marginBottom: 8,
                      background: TACTIUM.bgCard, borderRadius: 16,
                      border: `1px solid ${TACTIUM.hairStrong}`, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TactiumMark size={36} gradient />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis' }}>{name || 'Sin nombre'}</div>
              <div style={{ fontSize: 11, color: TACTIUM.textMuted, marginTop: 2,
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis', fontFamily: MONO }}>
                {[cat, hasGroup && group, league].filter(Boolean).join(' · ') || 'Configura categoría'}
              </div>
            </div>
            <NeonDot size={7} />
          </div>
          {federation && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${TACTIUM.hair}`,
                          fontSize: 10, color: TACTIUM.textFaint, fontFamily: MONO,
                          letterSpacing: 0.5 }}>
              {federation}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '8px 20px 32px' }}>
        <button onClick={onNext} disabled={!valid} style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          cursor: valid ? 'pointer' : 'default',
          background: TACTIUM.accent, color: '#000',
          fontFamily: FONT, fontWeight: 500, fontSize: 16, letterSpacing: -0.2,
          opacity: valid ? 1 : 0.4,
          boxShadow: valid ? `0 8px 24px ${TACTIUM.accent}40` : 'none',
        }}>Continuar</button>
      </div>
    </div>
  );
}

function FieldLabel({ children, inline }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.textFaint,
                  textTransform: 'uppercase', marginBottom: inline ? 0 : 8,
                  fontFamily: MONO, fontWeight: 500 }}>{children}</div>
  );
}

function ChipPicker({ options, value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {options.map(o => {
        const sel = value === o;
        return (
          <button key={o} onClick={() => onPick(o)} style={{
            padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
            background: sel ? `${TACTIUM.accent}15` : TACTIUM.bgCard,
            color: sel ? TACTIUM.accent : TACTIUM.textMuted,
            border: `1px solid ${sel ? TACTIUM.accent + '40' : TACTIUM.hair}`,
            fontFamily: FONT, fontSize: 11, fontWeight: 500,
          }}>{o}</button>
        );
      })}
    </div>
  );
}

const ctInputStyle = {
  width: '100%', height: 48, padding: '0 14px', borderRadius: 12,
  background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hairStrong}`,
  color: TACTIUM.text, fontFamily: 'Satoshi', fontSize: 14, fontWeight: 500,
  outline: 'none', boxSizing: 'border-box',
};

window.ScreenCreateTeam = ScreenCreateTeam;
