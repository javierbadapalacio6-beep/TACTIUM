// TACTIUM — Alineación
// Premium feel: pair-points hero, lightweight player chips, motion + validation.

function ScreenLineup({ onBack, players, courts: courtsCount = 5 }) {
  const availPlayers = players.filter(p => p.avail);

  const buildInitial = () => {
    const top = [...availPlayers].sort((a,b)=>b.pts-a.pts).slice(0, courtsCount * 2);
    const pairs = [];
    for (let i = 0; i < courtsCount; i++) {
      pairs.push([top[i*2]?.id, top[i*2+1]?.id]);
    }
    return pairs;
  };

  const [pairs, setPairs] = React.useState(buildInitial);
  const [selected, setSelected] = React.useState(null);
  const [showSheet, setShowSheet] = React.useState(false);
  const [pulseCourt, setPulseCourt] = React.useState(null); // motion feedback

  React.useEffect(() => { setPairs(buildInitial()); }, [players.length]);

  const findPlayer = (id) => players.find(p => p.id === id);
  const pairPts = (pair) => pair.reduce((a,id) => a + (findPlayer(id)?.pts || 0), 0);
  const usedIds = new Set(pairs.flat().filter(Boolean));

  const ptsArr = pairs.map(pairPts);
  const validation = ptsArr.map((v, i) => {
    if (i === 0) return { ok: true };
    if (v > ptsArr[i-1]) return { ok: false, msg: `Debería ser ≤ ${ptsArr[i-1]} pts (P${i})` };
    return { ok: true };
  });
  const allOk = validation.every(v => v.ok);
  const filledCount = pairs.filter(p => p.filter(Boolean).length === 2).length;

  const openSlot = (court, slot) => {
    setSelected({ court, slot });
    setShowSheet(true);
  };

  const triggerPulse = (court) => {
    setPulseCourt(court);
    setTimeout(() => setPulseCourt(null), 420);
  };

  const assignPlayer = (id) => {
    if (!selected) return;
    const next = pairs.map(p => [...p]);
    next.forEach(p => p.forEach((pid, i) => { if (pid === id) p[i] = undefined; }));
    next[selected.court][selected.slot] = id;
    setPairs(next);
    triggerPulse(selected.court);
    setShowSheet(false);
    setSelected(null);
  };

  const clearSlot = () => {
    if (!selected) return;
    const next = pairs.map(p => [...p]);
    next[selected.court][selected.slot] = undefined;
    setPairs(next);
    setShowSheet(false);
    setSelected(null);
  };

  // auto-balance: re-sort pairs descending so they're valid
  const autoBalance = () => {
    const flat = pairs.flat().filter(Boolean).map(findPlayer).filter(Boolean);
    flat.sort((a,b)=>b.pts-a.pts);
    const next = [];
    for (let i = 0; i < courtsCount; i++) {
      next.push([flat[i*2]?.id, flat[i*2+1]?.id]);
    }
    setPairs(next);
    triggerPulse(-1); // pulse all
    setTimeout(() => setPulseCourt(null), 600);
  };

  const maxPts = Math.max(...ptsArr.filter(v => v > 0), 1);

  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <style>{`
        @keyframes lineupPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 ${TACTIUM.accent}55; }
          50% { transform: scale(1.012); box-shadow: 0 0 0 6px ${TACTIUM.accent}00; }
          100% { transform: scale(1); box-shadow: 0 0 0 0 ${TACTIUM.accent}00; }
        }
        @keyframes lineupSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ptsCount {
          from { transform: translateY(4px); opacity: 0.4; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>

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

        <button onClick={autoBalance} style={{
          height: 32, padding: '0 12px', borderRadius: 9,
          border: `1px solid ${TACTIUM.accent}35`, background: `${TACTIUM.accent}10`,
          color: TACTIUM.accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 12, fontWeight: 500,
        }}>
          <IconBolt size={12} color={TACTIUM.accent} /> Auto
        </button>
      </div>

      {/* Title */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 8,
                      fontFamily: MONO }}>Jornada 07 · Alineación</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -1, lineHeight: 1 }}>
            5 parejas
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* progress dots */}
            <div style={{ display: 'flex', gap: 4 }}>
              {pairs.map((p, i) => {
                const f = p.filter(Boolean).length;
                const full = f === 2;
                const half = f === 1;
                const ok = validation[i].ok;
                return (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: full ? (ok ? TACTIUM.accent : TACTIUM.err)
                                    : half ? TACTIUM.warn : TACTIUM.hairStrong,
                    transition: 'background 220ms',
                  }} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* courts list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pairs.map((pair, ci) => {
            const v = validation[ci];
            const total = pairPts(pair);
            const filled = pair.filter(Boolean).length === 2;
            const isPulsing = pulseCourt === ci || pulseCourt === -1;
            return (
              <CourtCard key={ci} court={ci+1}
                p1={findPlayer(pair[0])} p2={findPlayer(pair[1])}
                total={total} maxPts={maxPts}
                valid={v.ok} message={v.msg} filled={filled}
                onSlot={(slot) => openSlot(ci, slot)}
                top={ci === 0}
                pulsing={isPulsing}
              />
            );
          })}
        </div>

        {/* footer summary */}
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 14,
          background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hair}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <FooterStat label="Σ pts equipo" value={ptsArr.reduce((a,b)=>a+b,0)} />
          <div style={{ width: 1, height: 28, background: TACTIUM.hair }} />
          <FooterStat label="Asignados" value={`${usedIds.size}/10`} />
          <div style={{ width: 1, height: 28, background: TACTIUM.hair }} />
          <FooterStat label="Banquillo" value={availPlayers.length - usedIds.size} dim />
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 20px 40px' }}>
        <button disabled={!allOk || filledCount < 5} style={{
          width: '100%', height: 56, borderRadius: 16, border: 'none',
          cursor: (allOk && filledCount === 5) ? 'pointer' : 'default',
          background: (allOk && filledCount === 5) ? TACTIUM.accent : TACTIUM.bgCard,
          color: (allOk && filledCount === 5) ? '#000' : TACTIUM.textFaint,
          fontFamily: FONT, fontWeight: 500, fontSize: 17, letterSpacing: -0.2,
          boxShadow: (allOk && filledCount === 5) ? `0 8px 24px ${TACTIUM.accent}40` : 'none',
          opacity: (allOk && filledCount === 5) ? 1 : 0.55,
          transition: 'all 220ms',
        }}>
          {!allOk ? 'Corrige los errores'
                 : filledCount < 5 ? `Faltan ${5 - filledCount} parejas`
                 : 'Confirmar alineación'}
        </button>
      </div>

      {showSheet && (
        <PlayerSheet
          players={availPlayers}
          usedIds={usedIds}
          currentId={selected ? pairs[selected.court][selected.slot] : null}
          onPick={assignPlayer}
          onClear={clearSlot}
          onClose={() => { setShowSheet(false); setSelected(null); }}
          court={selected ? selected.court + 1 : 0}
        />
      )}
    </div>
  );
}

function FooterStat({ label, value, dim }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9.5, color: TACTIUM.textFaint, letterSpacing: 1.5,
                    textTransform: 'uppercase', fontFamily: MONO, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, fontFamily: MONO, marginTop: 4,
                    color: dim ? TACTIUM.textMuted : TACTIUM.text, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

function CourtCard({ court, p1, p2, total, maxPts, valid, message, filled, onSlot, top, pulsing }) {
  const pctOfMax = maxPts ? Math.min(100, (total / maxPts) * 100) : 0;
  const tint = !valid ? TACTIUM.err : top ? TACTIUM.accent : TACTIUM.text;

  return (
    <div style={{
      background: TACTIUM.bgCard,
      borderRadius: 18,
      border: `1px solid ${!valid ? TACTIUM.err + '50'
                                  : top ? TACTIUM.accent + '30'
                                  : TACTIUM.hair}`,
      overflow: 'hidden',
      position: 'relative',
      animation: pulsing ? 'lineupPulse 420ms ease-out' : undefined,
      transition: 'border 220ms',
    }}>
      {/* HERO header: court id + giant pair total */}
      <div style={{ padding: '14px 16px 12px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: `1px solid ${TACTIUM.hair}` }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: top ? `${TACTIUM.accent}18` : TACTIUM.bgRaised,
          color: top ? TACTIUM.accent : TACTIUM.text,
          fontFamily: MONO, fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, letterSpacing: -0.2,
        }}>P{court}</div>

        {/* progress bar (visual weight of pair vs max) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <div style={{ fontSize: 12, color: TACTIUM.textFaint, letterSpacing: 1.2,
                          textTransform: 'uppercase', fontFamily: MONO, fontWeight: 500 }}>
              {top ? 'Titular · P1' : `Pista ${court}`}
            </div>
            {top && filled && valid && (
              <div style={{
                fontSize: 9, color: TACTIUM.accent, letterSpacing: 1, fontFamily: MONO,
                fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: `${TACTIUM.accent}15`, textTransform: 'uppercase',
              }}>Top score</div>
            )}
          </div>
          <div style={{
            height: 4, borderRadius: 2, background: TACTIUM.hair, overflow: 'hidden',
          }}>
            <div style={{
              width: `${pctOfMax}%`, height: '100%',
              background: tint,
              transition: 'width 360ms cubic-bezier(.2,.7,.2,1), background 220ms',
            }} />
          </div>
        </div>

        {/* HERO total points */}
        <div style={{ textAlign: 'right', minWidth: 56 }} key={total}>
          <div style={{
            fontFamily: MONO, fontSize: 28, fontWeight: 500,
            color: tint, letterSpacing: -1, lineHeight: 1,
            animation: 'ptsCount 280ms ease-out',
          }}>
            {filled ? total : '—'}
          </div>
          <div style={{ fontSize: 9, color: TACTIUM.textFaint, letterSpacing: 1.5,
                        textTransform: 'uppercase', marginTop: 4, fontFamily: MONO }}>pts</div>
        </div>
      </div>

      {/* lightweight player chips */}
      <div style={{ padding: '12px 12px 14px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <PlayerChip p={p1} onClick={() => onSlot(0)} />
        <PlayerChip p={p2} onClick={() => onSlot(1)} />
      </div>

      {/* feedback */}
      {!valid && message && (
        <div style={{
          padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
          background: `${TACTIUM.err}10`, borderTop: `1px solid ${TACTIUM.err}30`,
          fontSize: 12, color: TACTIUM.err, fontWeight: 500,
          animation: 'lineupSlideIn 220ms ease-out',
        }}>
          <IconAlert size={13} color={TACTIUM.err} />
          {message}
        </div>
      )}
    </div>
  );
}

function PlayerChip({ p, onClick }) {
  const [pressed, setPressed] = React.useState(false);

  if (!p) {
    return (
      <button
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          height: 56, borderRadius: 12, cursor: 'pointer',
          border: `1px dashed ${TACTIUM.hairStrong}`,
          background: 'transparent', color: TACTIUM.textFaint,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: FONT, fontSize: 12, fontWeight: 500,
          transition: 'all 160ms',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
        }}>
        <IconPlus size={13} /> Añadir
      </button>
    );
  }

  const initials = (p.name.split(' ')[1] || p.name).slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        height: 56, borderRadius: 12, cursor: 'pointer',
        background: 'transparent',
        border: `1px solid ${TACTIUM.hair}`,
        padding: '0 10px 0 8px', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        color: TACTIUM.text, fontFamily: FONT,
        transition: 'all 180ms',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
      }}>
      {/* tiny avatar dot */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: `${TACTIUM.accent}12`,
        color: TACTIUM.accent,
        fontFamily: MONO, fontSize: 10, fontWeight: 600,
        letterSpacing: 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{initials}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: 1.15 }}>
          {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
        </div>
        <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 0.5,
                      textTransform: 'uppercase', marginTop: 2, fontFamily: MONO }}>
          {p.pos} · <span style={{ color: TACTIUM.textMuted }}>{p.pts} pts</span>
        </div>
      </div>
    </button>
  );
}

function PlayerSheet({ players, usedIds, currentId, onPick, onClear, onClose, court }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
    }}>
      <div onClick={onClose} style={{
        flex: 1, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        cursor: 'pointer',
      }} />
      <div style={{
        background: TACTIUM.bgRaised,
        borderTop: `1px solid ${TACTIUM.hairStrong}`,
        borderRadius: '24px 24px 0 0',
        padding: '14px 0 30px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
        maxHeight: '60%',
        display: 'flex', flexDirection: 'column',
        animation: 'lineupSlideIn 280ms ease-out',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3,
                      background: TACTIUM.hairStrong, margin: '0 auto 10px' }} />
        <div style={{ padding: '0 20px 12px', display: 'flex',
                      alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: TACTIUM.accent,
                          textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO }}>Pista {court}</div>
            <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: -0.3, marginTop: 2,
                          color: TACTIUM.text }}>Selecciona jugador</div>
          </div>
          {currentId && (
            <button onClick={onClear} style={{
              height: 30, padding: '0 12px', borderRadius: 8,
              background: 'transparent', border: `1px solid ${TACTIUM.err}40`,
              color: TACTIUM.err, fontFamily: FONT, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>Quitar</button>
          )}
        </div>
        <div style={{ overflowY: 'auto', padding: '0 16px' }}>
          {[...players].sort((a,b)=>b.pts-a.pts).map(p => {
            const used = usedIds.has(p.id) && p.id !== currentId;
            return (
              <button key={p.id} disabled={used} onClick={() => onPick(p.id)} style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 12px',
                background: 'transparent', border: 'none', cursor: used ? 'default' : 'pointer',
                borderBottom: `1px solid ${TACTIUM.hair}`,
                opacity: used ? 0.35 : 1, textAlign: 'left',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `${TACTIUM.accent}12`, color: TACTIUM.accent,
                  fontFamily: MONO, fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{(p.name.split(' ')[1] || p.name).slice(0,2).toUpperCase()}</div>
                <div style={{ flex: 1, color: TACTIUM.text, fontSize: 15, fontWeight: 500 }}>
                  {p.name}
                  {used && <span style={{ fontSize: 11, color: TACTIUM.textFaint,
                                          marginLeft: 8, fontWeight: 400 }}>· asignado</span>}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 13, color: TACTIUM.text }}>{p.pts}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.ScreenLineup = ScreenLineup;
