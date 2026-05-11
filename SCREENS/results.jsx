// TACTIUM — Resultados de jornada (post-match score entry)
// Permite (opcionalmente) añadir el marcador set-a-set de cada pareja.

function ScreenResults({ onBack, onSave, initialFocus = 0, matchResults, setMatchResults }) {
  // 5 partidos. Cada uno: 2 sets + 1 super tiebreak / 3er set opcional.
  const fallback = React.useMemo(() => Array.from({ length: 5 }, () => ({
    sets: [{ us: '', them: '' }, { us: '', them: '' }, { us: '', them: '' }],
    forfeit: false,
  })), []);
  const matches = matchResults || fallback;
  const setMatches = setMatchResults || (() => {});
  const [expanded, setExpanded] = React.useState(initialFocus);

  // Pair from lineup (mock — same names usados en lineup)
  const pairLabels = [
    'Pareja 01 · J. Ruiz / D. Casas',
    'Pareja 02 · S. Caro / E. Vela',
    'Pareja 03 · A. Bravo / N. León',
    'Pareja 04 · O. Mora / R. Lago',
    'Pareja 05 · P. Soto / M. Vidal',
  ];

  // Compute who won each match: pareja gana 2 sets
  const matchOutcome = (m) => {
    if (m.forfeit) return 'lost';
    let usWon = 0, themWon = 0;
    m.sets.forEach(s => {
      const a = parseInt(s.us), b = parseInt(s.them);
      if (Number.isNaN(a) || Number.isNaN(b)) return;
      if (a > b) usWon++;
      else if (b > a) themWon++;
    });
    if (usWon >= 2) return 'won';
    if (themWon >= 2) return 'lost';
    return null;
  };

  const teamScore = matches.reduce((acc, m) => {
    const o = matchOutcome(m);
    if (o === 'won') acc.us++;
    else if (o === 'lost') acc.them++;
    return acc;
  }, { us: 0, them: 0 });

  const pendingCount = matches.filter(m => !matchOutcome(m)).length;
  const anyFilled = matches.some(m => matchOutcome(m));

  const updateSet = (ci, si, side, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    const next = matches.map((m,i) => i !== ci ? m : {
      ...m, sets: m.sets.map((s,j) => j !== si ? s : { ...s, [side]: val })
    });
    setMatches(next);
  };
  const toggleForfeit = (ci) => {
    const next = matches.map((m,i) => i !== ci ? m
      : { ...m, forfeit: !m.forfeit, sets: m.sets.map(() => ({ us: '', them: '' })) });
    setMatches(next);
  };

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
        }}><IconBack size={16} /> Jornada</button>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.textFaint, letterSpacing: 1.5 }}>
          {String(5 - pendingCount).padStart(2,'0')} / 05
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 6 }}>Jornada 07 · Resultado</div>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Añade los marcadores
        </div>
        <div style={{ fontSize: 13, color: TACTIUM.textMuted, marginTop: 8, lineHeight: 1.45 }}>
          Opcional. Puedes guardar parcial o saltarlo y completarlo después.
        </div>
      </div>

      {/* Aggregated score */}
      <div style={{ margin: '14px 20px 4px', padding: '16px 18px',
                    background: `linear-gradient(135deg, ${TACTIUM.bgCard} 0%, ${TACTIUM.bgCard2} 100%)`,
                    border: `1px solid ${TACTIUM.hair}`, borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint,
                        textTransform: 'uppercase', fontWeight: 500 }}>Padel Club</div>
          <div style={{ fontSize: 11, color: TACTIUM.textMuted, marginTop: 2 }}>Local</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 500,
                        color: anyFilled ? TACTIUM.accent : TACTIUM.textFaint,
                        letterSpacing: -1 }}>
            {anyFilled ? teamScore.us : '—'}
          </div>
          <div style={{ width: 1, height: 28, background: TACTIUM.hairStrong }} />
          <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 500,
                        color: anyFilled ? TACTIUM.text : TACTIUM.textFaint,
                        letterSpacing: -1 }}>
            {anyFilled ? teamScore.them : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: TACTIUM.textFaint,
                        textTransform: 'uppercase', fontWeight: 500 }}>Club Visit.</div>
          <div style={{ fontSize: 11, color: TACTIUM.textMuted, marginTop: 2 }}>Rival</div>
        </div>
      </div>

      {/* List of pistas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((m, ci) => (
            <ResultRow key={ci} m={m} ci={ci}
              label={pairLabels[ci]}
              outcome={matchOutcome(m)}
              expanded={expanded === ci}
              onExpand={() => setExpanded(expanded === ci ? -1 : ci)}
              onSet={(si, side, val) => updateSet(ci, si, side, val)}
              onForfeit={() => toggleForfeit(ci)} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '8px 20px 32px', display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{
          flex: 1, height: 52, borderRadius: 14, border: `1px solid ${TACTIUM.hairStrong}`,
          background: 'transparent', color: TACTIUM.textMuted, cursor: 'pointer',
          fontFamily: FONT, fontWeight: 500, fontSize: 14,
        }}>Saltar</button>
        <button onClick={() => { onSave && onSave(matches); onBack(); }} style={{
          flex: 2, height: 52, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: TACTIUM.accent, color: '#000',
          fontFamily: FONT, fontWeight: 500, fontSize: 15, letterSpacing: -0.2,
          boxShadow: `0 8px 24px ${TACTIUM.accent}40`,
        }}>{anyFilled ? `Guardar resultado` : 'Guardar (vacío)'}</button>
      </div>
    </div>
  );
}

function ResultRow({ m, ci, label, outcome, expanded, onExpand, onSet, onForfeit }) {
  const tint = outcome === 'won' ? TACTIUM.accent
            : outcome === 'lost' ? TACTIUM.err
            : TACTIUM.textFaint;
  const setSummary = m.sets
    .filter(s => s.us !== '' || s.them !== '')
    .map(s => `${s.us || '·'}-${s.them || '·'}`).join(' ');

  return (
    <div style={{
      background: TACTIUM.bgCard, borderRadius: 14,
      border: `1px solid ${expanded ? TACTIUM.hairStrong : TACTIUM.hair}`,
      overflow: 'hidden', transition: 'border 200ms',
    }}>
      {/* header row */}
      <button onClick={onExpand} style={{
        width: '100%', padding: '14px 14px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: ci === 0 ? `${TACTIUM.accent}15` : TACTIUM.bgRaised,
          color: ci === 0 ? TACTIUM.accent : TACTIUM.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 12, fontWeight: 500,
        }}>P{ci+1}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
                        color: TACTIUM.text, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: TACTIUM.textFaint, marginTop: 2,
                        fontFamily: MONO, letterSpacing: 0.5 }}>
            {m.forfeit ? 'No presentado'
             : setSummary ? setSummary
             : 'Sin resultado'}
          </div>
        </div>

        {outcome ? (
          <div style={{
            padding: '4px 9px', borderRadius: 7,
            background: `${tint}15`, border: `1px solid ${tint}40`,
            color: tint, fontFamily: MONO, fontSize: 11, fontWeight: 500,
            letterSpacing: 0.5,
          }}>{outcome === 'won' ? 'V' : 'D'}</div>
        ) : (
          <div style={{
            padding: '4px 9px', borderRadius: 7,
            color: TACTIUM.textFaint, fontFamily: MONO, fontSize: 11,
            border: `1px solid ${TACTIUM.hair}`, letterSpacing: 0.5,
          }}>—</div>
        )}
        <IconChevron color={TACTIUM.textFaint} />
      </button>

      {/* expandable body */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${TACTIUM.hair}` }}>
          {/* Forfeit toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 0 14px' }}>
            <button onClick={onForfeit} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: m.forfeit ? TACTIUM.err : TACTIUM.textMuted,
              fontFamily: FONT, fontSize: 12,
            }}>
              <div style={{
                width: 32, height: 18, borderRadius: 9,
                background: m.forfeit ? TACTIUM.err : 'rgba(232,245,239,0.12)',
                position: 'relative', transition: 'all .25s',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 6, background: '#fff',
                  position: 'absolute', top: 3, transition: 'all .25s',
                  left: m.forfeit ? 17 : 3,
                }} />
              </div>
              No presentado / W.O.
            </button>
          </div>

          {!m.forfeit && (
            <React.Fragment>
              {/* Header */}
              <div style={{ display: 'grid',
                            gridTemplateColumns: '40px 1fr 1fr 1fr',
                            gap: 8, marginBottom: 6 }}>
                <div />
                {['Set 1', 'Set 2', 'Set 3'].map((l,i) => (
                  <div key={i} style={{
                    fontSize: 9, letterSpacing: 1.5, color: TACTIUM.textFaint,
                    textTransform: 'uppercase', fontFamily: MONO,
                    textAlign: 'center', fontWeight: 500,
                  }}>{l}{i === 2 ? ' · opc.' : ''}</div>
                ))}
              </div>

              {/* Us */}
              <ScoreRow label="Nos." sets={m.sets} side="us"
                onSet={(si, val) => onSet(si, 'us', val)} accent />
              {/* Them */}
              <ScoreRow label="Riv." sets={m.sets} side="them"
                onSet={(si, val) => onSet(si, 'them', val)} />
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, sets, side, onSet, accent }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr',
                  gap: 8, marginBottom: 6, alignItems: 'center' }}>
      <div style={{ fontSize: 11, color: accent ? TACTIUM.accent : TACTIUM.textMuted,
                    fontFamily: MONO, letterSpacing: 1, fontWeight: 500 }}>{label}</div>
      {sets.map((s, si) => (
        <input key={si} value={s[side]} onChange={e => onSet(si, e.target.value)}
          inputMode="numeric" maxLength={2} placeholder="·"
          style={{
            height: 44, borderRadius: 10, textAlign: 'center',
            background: TACTIUM.bgRaised,
            border: `1px solid ${TACTIUM.hair}`,
            color: accent && s[side] ? TACTIUM.accent : TACTIUM.text,
            fontFamily: MONO, fontSize: 17, fontWeight: 500,
            outline: 'none', minWidth: 0, padding: 0,
          }} />
      ))}
    </div>
  );
}

window.ScreenResults = ScreenResults;
window.computeTeamScore = (matches) => {
  if (!matches || !matches.length) return { us: 0, them: 0, played: 0 };
  let us = 0, them = 0, played = 0;
  matches.forEach(m => {
    if (m.forfeit) { them++; played++; return; }
    let usWon = 0, themWon = 0;
    m.sets.forEach(s => {
      const a = parseInt(s.us), b = parseInt(s.them);
      if (Number.isNaN(a) || Number.isNaN(b)) return;
      if (a > b) usWon++; else if (b > a) themWon++;
    });
    if (usWon >= 2)      { us++; played++; }
    else if (themWon >= 2){ them++; played++; }
  });
  return { us, them, played };
};
