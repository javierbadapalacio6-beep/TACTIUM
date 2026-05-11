// TACTIUM — Alineación
// Premium: smart suggestions, swap animation, balance score, contextual error copy.

function ScreenLineup({ onBack, players, courts: courtsCount = 5 }) {
  const availPlayers = players.filter(p => p.avail);

  const buildInitial = () => {
    const top = [...availPlayers].sort((a,b)=>b.pts-a.pts).slice(0, courtsCount * 2);
    const slots = [];
    for (let i = 0; i < courtsCount; i++) {
      slots.push([top[i*2]?.id ?? null, top[i*2+1]?.id ?? null]);
    }
    return slots;
  };

  const [pairs, setPairs] = React.useState(buildInitial);
  const [sel, setSel] = React.useState(null);
  const [pulseSet, setPulseSet] = React.useState(new Set());
  const [autoFlash, setAutoFlash] = React.useState(false);
  const [autoDelta, setAutoDelta] = React.useState(null);
  const [autoSort, setAutoSort] = React.useState(true);
  const [swapAnim, setSwapAnim] = React.useState(null); // {ids:[a,b], ts}
  const [floatNumber, setFloatNumber] = React.useState(null); // {value, court}

  React.useEffect(() => { setPairs(buildInitial()); }, [players.length]);

  const findPlayer = (id) => id ? players.find(p => p.id === id) : null;
  const pairPts = (pair) => pair.reduce((a,id) => a + (findPlayer(id)?.pts || 0), 0);

  const sortByPoints = (input) => {
    return [...input]
      .map(pair => {
        const a = findPlayer(pair[0]);
        const b = findPlayer(pair[1]);
        if (a && b) return (a.pts >= b.pts) ? [pair[0], pair[1]] : [pair[1], pair[0]];
        if (a && !b) return [pair[0], null];
        if (!a && b) return [pair[1], null];
        return [null, null];
      })
      .sort((p1, p2) => {
        const f1 = p1.filter(Boolean).length;
        const f2 = p2.filter(Boolean).length;
        if (f1 !== f2) return f2 - f1;
        return pairPts(p2) - pairPts(p1);
      });
  };

  const commit = (next) => {
    const final = autoSort ? sortByPoints(next) : next;
    setPairs(final);
    return final;
  };

  const usedIds = new Set(pairs.flat().filter(Boolean));
  const benchPlayers = availPlayers.filter(p => !usedIds.has(p.id));

  const ptsArr = pairs.map(pairPts);

  // BALANCE SCORE — how monotonically descending is the lineup (0-100, higher = better)
  // Calculated as: % of consecutive pair-pairs where i+1 ≤ i, weighted by smoothness
  const calcBalance = (arr) => {
    const filled = arr.filter((_, i) => pairs[i].filter(Boolean).length === 2);
    if (filled.length < 2) return null;
    let score = 0;
    let total = 0;
    for (let i = 0; i < filled.length - 1; i++) {
      total++;
      const diff = filled[i] - filled[i+1];
      if (diff < 0) score += 0; // inverted = bad
      else if (diff === 0) score += 0.7; // tied
      else score += Math.min(1, diff / 50 + 0.6); // descending = good, smoother = better
    }
    return Math.round((score / total) * 100);
  };
  const balance = calcBalance(ptsArr);

  const validation = ptsArr.map((v, i) => {
    const filled = pairs[i].filter(Boolean).length === 2;
    if (!filled) return { state: 'empty' };
    if (i === 0) return { state: 'ok' };
    if (v > ptsArr[i-1]) {
      const diff = v - ptsArr[i-1];
      return { state: 'err', msg: `P${i+1} supera a P${i} en ${diff} pts`, diff };
    }
    if (i > 0 && (ptsArr[i-1] - v) / Math.max(ptsArr[i-1],1) < 0.05) return { state: 'warn' };
    return { state: 'ok' };
  });
  const allOk = validation.every(v => v.state !== 'err');
  const filledCount = pairs.filter(p => p.filter(Boolean).length === 2).length;

  const pulseCourt = (i) => {
    setPulseSet(s => new Set([...s, i]));
    setTimeout(() => setPulseSet(s => { const n = new Set(s); n.delete(i); return n; }), 500);
  };
  const pulseAll = () => {
    setPulseSet(new Set([0,1,2,3,4]));
    setTimeout(() => setPulseSet(new Set()), 500);
  };
  const triggerSwapAnim = (idA, idB) => {
    setSwapAnim({ ids: [idA, idB], ts: Date.now() });
    setTimeout(() => setSwapAnim(null), 500);
  };

  // SMART SUGGESTION: find one bench↔slot swap that maximizes balance improvement
  const suggestion = React.useMemo(() => {
    if (!allOk || filledCount < 5 || benchPlayers.length === 0) return null;
    const currentBalance = balance ?? 0;
    if (currentBalance >= 92) return null; // already great
    let best = null;
    for (let c = 0; c < courtsCount; c++) {
      for (let s = 0; s < 2; s++) {
        const slotId = pairs[c][s];
        if (!slotId) continue;
        for (const bp of benchPlayers) {
          const next = pairs.map(p => [...p]);
          next[c][s] = bp.id;
          const sorted = sortByPoints(next);
          const newPts = sorted.map(pairPts);
          const newBal = calcBalance(newPts);
          if (newBal != null && newBal > currentBalance + 4) {
            const gain = newBal - currentBalance;
            if (!best || gain > best.gain) {
              best = { gain, out: findPlayer(slotId), in: bp, court: c, slot: s };
            }
          }
        }
      }
    }
    return best;
  }, [pairs, benchPlayers, allOk, filledCount, balance]);

  const applySuggestion = () => {
    if (!suggestion) return;
    const next = pairs.map(p => [...p]);
    next[suggestion.court][suggestion.slot] = suggestion.in.id;
    triggerSwapAnim(suggestion.out.id, suggestion.in.id);
    commit(next);
    pulseAll();
    setAutoDelta(`+${suggestion.gain} equilibrio`);
    setTimeout(() => setAutoDelta(null), 2400);
  };

  // ===== Interaction =====
  const onSlotTap = (court, slot) => {
    const here = pairs[court][slot];
    if (!sel) {
      if (here) setSel({ kind: 'slot', court, slot });
      return;
    }
    if (sel.kind === 'slot' && sel.court === court && sel.slot === slot) {
      setSel(null);
      return;
    }
    if (sel.kind === 'bench') {
      const next = pairs.map(p => [...p]);
      const displaced = next[court][slot];
      next[court][slot] = sel.id;
      if (displaced) triggerSwapAnim(displaced, sel.id);
      else triggerSwapAnim(sel.id, sel.id);
      commit(next);
      pulseAll();
      setSel(null);
      return;
    }
    if (sel.kind === 'slot') {
      const next = pairs.map(p => [...p]);
      const a = next[sel.court][sel.slot];
      const b = next[court][slot];
      next[sel.court][sel.slot] = b;
      next[court][slot] = a;
      if (a && b) triggerSwapAnim(a, b);
      commit(next);
      pulseAll();
      setSel(null);
      return;
    }
  };

  const onBenchTap = (id) => {
    if (!sel) { setSel({ kind: 'bench', id }); return; }
    if (sel.kind === 'bench' && sel.id === id) { setSel(null); return; }
    if (sel.kind === 'slot') {
      const next = pairs.map(p => [...p]);
      const out = next[sel.court][sel.slot];
      next[sel.court][sel.slot] = id;
      if (out) triggerSwapAnim(out, id);
      commit(next);
      pulseAll();
      setSel(null);
      return;
    }
    if (sel.kind === 'bench') setSel({ kind: 'bench', id });
  };

  const onSlotEmpty = (court, slot) => {
    if (!sel) return;
    if (sel.kind === 'bench') {
      const next = pairs.map(p => [...p]);
      next[court][slot] = sel.id;
      commit(next);
      pulseAll();
      setSel(null);
    } else if (sel.kind === 'slot') {
      const next = pairs.map(p => [...p]);
      next[court][slot] = next[sel.court][sel.slot];
      next[sel.court][sel.slot] = null;
      commit(next);
      pulseAll();
      setSel(null);
    }
  };

  const removeFromSlot = (court, slot) => {
    const next = pairs.map(p => [...p]);
    next[court][slot] = null;
    commit(next);
    pulseAll();
    setSel(null);
  };

  const fillEmpty = () => {
    const next = pairs.map(p => [...p]);
    const empties = [];
    next.forEach((p, c) => p.forEach((id, s) => { if (!id) empties.push([c, s]); }));
    const candidates = [...benchPlayers].sort((a,b)=>b.pts-a.pts);
    empties.forEach((es, i) => {
      if (candidates[i]) next[es[0]][es[1]] = candidates[i].id;
    });
    commit(next);
    pulseAll();
    setSel(null);
  };

  const maxPts = Math.max(...ptsArr.filter(v => v > 0), 1);
  const teamPts = ptsArr.reduce((a,b)=>a+b,0);
  const isAnimating = (id) => swapAnim && swapAnim.ids.includes(id);

  return (
    <div onClick={() => setSel(null)} style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <style>{`
        @keyframes lineupCardPulse {
          0%   { box-shadow: 0 0 0 0 ${TACTIUM.accent}66, inset 0 0 0 1px ${TACTIUM.accent}66; }
          70%  { box-shadow: 0 0 0 12px ${TACTIUM.accent}00, inset 0 0 0 1px ${TACTIUM.accent}40; }
          100% { box-shadow: 0 0 0 0 ${TACTIUM.accent}00, inset 0 0 0 1px ${TACTIUM.accent}00; }
        }
        @keyframes lineupSelectGlow {
          0%, 100% { box-shadow: 0 0 0 2px ${TACTIUM.accent}, 0 0 0 6px ${TACTIUM.accent}30; }
          50%      { box-shadow: 0 0 0 2px ${TACTIUM.accent}, 0 0 0 9px ${TACTIUM.accent}10; }
        }
        @keyframes lineupCount {
          from { transform: translateY(3px); opacity: 0.4; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes lineupSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lineupSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lineupSwapFlash {
          0%   { transform: scale(1) rotate(0); background: ${TACTIUM.accent}; color: #000; }
          50%  { transform: scale(1.18) rotate(8deg); background: ${TACTIUM.accent}; color: #000; }
          100% { transform: scale(1) rotate(0); background: ${TACTIUM.accent}15; color: ${TACTIUM.accent}; }
        }
        @keyframes lineupAutoSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes lineupAutoFlash {
          0%, 100% { background: ${TACTIUM.bg}; }
          30%      { background: ${TACTIUM.accent}08; }
        }
        @keyframes lineupBalanceFill {
          from { width: 0; }
        }
        @keyframes lineupSuggestionPop {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lineupBenchHint {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* nav */}
      <div onClick={e => e.stopPropagation()}
           style={{ paddingTop: 60, padding: '60px 20px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.hairStrong}`, background: TACTIUM.bgCard,
          color: TACTIUM.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 14, fontWeight: 500,
        }}><IconBack size={16} /> Jornada</button>

        <button onClick={() => setAutoSort(s => !s)} style={{
          height: 32, padding: '0 12px', borderRadius: 9,
          border: `1px solid ${autoSort ? TACTIUM.accent + '50' : TACTIUM.hairStrong}`,
          background: autoSort ? `${TACTIUM.accent}12` : TACTIUM.bgCard,
          color: autoSort ? TACTIUM.accent : TACTIUM.textMuted, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 12, fontWeight: 500,
          transition: 'all 200ms',
        }}>
          <IconBolt size={12} color={autoSort ? TACTIUM.accent : TACTIUM.textMuted} />
          Auto-orden {autoSort ? '· ON' : '· OFF'}
        </button>
      </div>

      {/* Title with balance score */}
      <div onClick={e => e.stopPropagation()}
           style={{ padding: '20px 24px 6px',
                    animation: autoFlash ? 'lineupAutoFlash 700ms ease-out' : undefined }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 8,
                      fontFamily: MONO }}>Jornada 07 · Alineación</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -1, lineHeight: 1 }}>
            {filledCount}/5 parejas
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {validation.map((v, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: v.state === 'ok' ? TACTIUM.accent
                          : v.state === 'warn' ? TACTIUM.warn
                          : v.state === 'err' ? TACTIUM.err
                          : TACTIUM.hairStrong,
                transition: 'background 280ms',
              }} />
            ))}
          </div>
        </div>

        {/* Balance bar */}
        {balance != null && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2,
                          background: TACTIUM.hair, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${balance}%`, height: '100%',
                background: balance >= 80 ? TACTIUM.accent
                          : balance >= 50 ? TACTIUM.warn
                          : TACTIUM.err,
                transition: 'width 480ms cubic-bezier(.2,.7,.2,1), background 220ms',
              }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600,
                          color: balance >= 80 ? TACTIUM.accent : TACTIUM.textMuted,
                          letterSpacing: 0.5, minWidth: 70, textAlign: 'right' }}>
              {balance}/100 EQUI.
            </div>
          </div>
        )}

        {/* hint / delta */}
        <div style={{ marginTop: 8, fontSize: 12, color: TACTIUM.textFaint, minHeight: 16 }}>
          {autoDelta ? (
            <span style={{ color: TACTIUM.accent, fontWeight: 500,
                           animation: 'lineupSlideUp 200ms ease-out' }}>
              ⚡ {autoDelta}
            </span>
          ) : sel?.kind === 'slot' ? (
            <span style={{ color: TACTIUM.text, animation: 'lineupSlideUp 200ms ease-out' }}>
              Toca otro jugador para intercambiar · o el banquillo
            </span>
          ) : sel?.kind === 'bench' ? (
            <span style={{ color: TACTIUM.text, animation: 'lineupSlideUp 200ms ease-out' }}>
              Toca un slot para colocar a {findPlayer(sel.id)?.name.split(' ')[0]}
            </span>
          ) : autoSort ? (
            <span>Las parejas se ordenan por puntos automáticamente</span>
          ) : (
            <span>Toca un jugador para seleccionar</span>
          )}
        </div>
      </div>

      {/* courts list */}
      <div onClick={e => e.stopPropagation()}
           style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pairs.map((pair, ci) => {
            const v = validation[ci];
            const total = pairPts(pair);
            const filled = pair.filter(Boolean).length === 2;
            const pulsing = pulseSet.has(ci);
            return (
              <CourtRow key={ci}
                court={ci+1}
                p1={findPlayer(pair[0])} p2={findPlayer(pair[1])}
                total={total} maxPts={maxPts}
                filled={filled} state={v.state} message={v.msg} diff={v.diff}
                top={ci === 0 && filled}
                pulsing={pulsing}
                sel={sel}
                selectedSlot={sel?.kind === 'slot' && sel.court === ci ? sel.slot : -1}
                onSlotTap={(s) => onSlotTap(ci, s)}
                onSlotEmpty={(s) => onSlotEmpty(ci, s)}
                onRemove={(s) => removeFromSlot(ci, s)}
                isAnimating={isAnimating}
              />
            );
          })}

          {filledCount < 5 && (
            <button onClick={fillEmpty} style={{
              height: 44, marginTop: 4, borderRadius: 12,
              border: `1px dashed ${TACTIUM.accent}50`,
              background: `${TACTIUM.accent}06`,
              color: TACTIUM.accent, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
            }}>
              <IconBolt size={12} color={TACTIUM.accent} />
              Completar con mejores del banquillo
            </button>
          )}
        </div>
      </div>

      {/* SMART SUGGESTION — floating chip above bench */}
      {suggestion && !sel && (
        <div onClick={e => e.stopPropagation()}
             style={{ padding: '0 16px 8px',
                      animation: 'lineupSuggestionPop 320ms cubic-bezier(.2,.8,.2,1)' }}>
          <button onClick={applySuggestion} style={{
            width: '100%', padding: '10px 14px', borderRadius: 14,
            background: `linear-gradient(90deg, ${TACTIUM.accent}18, ${TACTIUM.accent}08)`,
            border: `1px solid ${TACTIUM.accent}40`,
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', textAlign: 'left',
            color: TACTIUM.text, fontFamily: FONT,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `${TACTIUM.accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconBolt size={14} color={TACTIUM.accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: TACTIUM.accent, fontFamily: MONO,
                            fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase',
                            marginBottom: 2 }}>
                Sugerencia · +{suggestion.gain} equilibrio
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.1 }}>
                Cambia {suggestion.out.name.split(' ')[0]} ↔ {suggestion.in.name.split(' ')[0]}
              </div>
            </div>
            <div style={{ fontSize: 11, color: TACTIUM.accent, fontFamily: MONO,
                          fontWeight: 600, letterSpacing: 1, padding: '4px 8px',
                          background: `${TACTIUM.accent}15`, borderRadius: 6 }}>
              APLICAR
            </div>
          </button>
        </div>
      )}

      {/* bench bar */}
      <BenchBar
        players={benchPlayers}
        sel={sel}
        onTap={onBenchTap}
        teamPts={teamPts}
        isAnimating={isAnimating}
      />

      {/* CTA */}
      <div onClick={e => e.stopPropagation()}
           style={{ padding: '8px 20px 36px', background: TACTIUM.bg }}>
        <button disabled={!allOk || filledCount < 5} style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none',
          cursor: (allOk && filledCount === 5) ? 'pointer' : 'default',
          background: (allOk && filledCount === 5) ? TACTIUM.accent : TACTIUM.bgCard,
          color: (allOk && filledCount === 5) ? '#000' : TACTIUM.textFaint,
          fontFamily: FONT, fontWeight: 500, fontSize: 16, letterSpacing: -0.2,
          boxShadow: (allOk && filledCount === 5) ? `0 8px 24px ${TACTIUM.accent}40` : 'none',
          opacity: (allOk && filledCount === 5) ? 1 : 0.5,
          transition: 'all 220ms',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {!allOk ? <><IconAlert size={14} color={TACTIUM.textFaint} /> Corrige los errores</>
                 : filledCount < 5 ? `Faltan ${5 - filledCount}`
                 : <><IconCheck size={15} color="#000" /> Confirmar alineación</>}
        </button>
      </div>
    </div>
  );
}

// ============= COURT ROW =============
function CourtRow({ court, p1, p2, total, maxPts, filled, state, message, diff, top, pulsing,
                    sel, selectedSlot, onSlotTap, onSlotEmpty, onRemove, isAnimating }) {
  const pctOfMax = maxPts ? Math.min(100, (total / maxPts) * 100) : 0;
  const tint = state === 'err' ? TACTIUM.err
             : state === 'warn' ? TACTIUM.warn
             : top ? TACTIUM.accent
             : TACTIUM.text;

  return (
    <div className="lineup-court" style={{
      background: TACTIUM.bgCard,
      borderRadius: 16,
      border: `1px solid ${state === 'err' ? TACTIUM.err + '60'
                          : top ? TACTIUM.accent + '30'
                          : TACTIUM.hair}`,
      overflow: 'hidden',
      position: 'relative',
      animation: pulsing ? 'lineupCardPulse 500ms ease-out' : undefined,
      transition: 'border 220ms',
    }}>
      <div style={{ padding: '11px 14px 9px',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: state === 'err' ? `${TACTIUM.err}18`
                    : top ? `${TACTIUM.accent}18`
                    : TACTIUM.bgRaised,
          color: state === 'err' ? TACTIUM.err
               : top ? TACTIUM.accent
               : TACTIUM.text,
          fontFamily: MONO, fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 220ms',
        }}>P{court}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            height: 3, borderRadius: 2, background: TACTIUM.hair, overflow: 'hidden',
          }}>
            <div style={{
              width: `${pctOfMax}%`, height: '100%', background: tint,
              transition: 'width 380ms cubic-bezier(.2,.7,.2,1), background 220ms',
            }} />
          </div>
          {top && state !== 'err' && (
            <div style={{ fontSize: 9, color: TACTIUM.accent, fontFamily: MONO,
                          fontWeight: 600, letterSpacing: 1.2, marginTop: 4,
                          textTransform: 'uppercase' }}>Pareja titular</div>
          )}
          {state === 'err' && message && (
            <div style={{ fontSize: 10, color: TACTIUM.err, fontFamily: MONO,
                          fontWeight: 500, letterSpacing: 0.4, marginTop: 4,
                          animation: 'lineupSlideUp 200ms ease-out' }}>
              {message}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', minWidth: 50 }} key={total}>
          <div style={{
            fontFamily: MONO, fontSize: 22, fontWeight: 500,
            color: tint, letterSpacing: -0.6, lineHeight: 1,
            animation: 'lineupCount 240ms ease-out',
          }}>{filled ? total : '—'}</div>
          <div style={{ fontSize: 9, color: TACTIUM.textFaint, letterSpacing: 1.2,
                        textTransform: 'uppercase', marginTop: 3, fontFamily: MONO }}>pts</div>
        </div>
      </div>

      <div style={{ padding: '0 8px 8px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <SlotTile p={p1} selected={selectedSlot === 0} error={state === 'err'}
                  ghost={sel && !p1 && (sel.kind === 'bench' || (sel.kind === 'slot'))}
                  onTap={() => p1 ? onSlotTap(0) : onSlotEmpty(0)}
                  onRemove={p1 ? () => onRemove(0) : null}
                  animating={p1 && isAnimating(p1.id)} />
        <SlotTile p={p2} selected={selectedSlot === 1} error={state === 'err'}
                  ghost={sel && !p2 && (sel.kind === 'bench' || (sel.kind === 'slot'))}
                  onTap={() => p2 ? onSlotTap(1) : onSlotEmpty(1)}
                  onRemove={p2 ? () => onRemove(1) : null}
                  animating={p2 && isAnimating(p2.id)} />
      </div>
    </div>
  );
}

// ============= SLOT TILE =============
function SlotTile({ p, selected, error, ghost, onTap, onRemove, animating }) {
  const [pressed, setPressed] = React.useState(false);

  if (!p) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onTap(); }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          height: 52, borderRadius: 11, cursor: 'pointer',
          border: `1px dashed ${ghost ? TACTIUM.accent + '70' : TACTIUM.hairStrong}`,
          background: ghost ? `${TACTIUM.accent}10` : 'transparent',
          color: ghost ? TACTIUM.accent : TACTIUM.textFaint,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: FONT, fontSize: 12, fontWeight: 500,
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'all 160ms',
        }}>
        {ghost ? '↓ Colocar aquí' : <><IconPlus size={12} /> Vacío</>}
      </button>
    );
  }

  const initials = (p.name.split(' ')[1] || p.name).slice(0, 2).toUpperCase();
  const firstName = p.name.split(' ')[0];
  const lastInitial = p.name.split(' ')[1]?.[0] || '';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: '100%', height: 52, borderRadius: 11, cursor: 'pointer',
        background: selected ? `${TACTIUM.accent}14`
                  : error ? `${TACTIUM.err}08`
                  : TACTIUM.bgRaised,
        border: `1px solid ${selected ? TACTIUM.accent
                              : error ? TACTIUM.err + '40'
                              : TACTIUM.hair}`,
        padding: '0 8px', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 9,
        color: TACTIUM.text, fontFamily: FONT,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 160ms',
        animation: selected ? 'lineupSelectGlow 1.4s ease-in-out infinite' : undefined,
      }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: selected ? TACTIUM.accent : `${TACTIUM.accent}15`,
        color: selected ? '#000' : TACTIUM.accent,
        fontFamily: MONO, fontSize: 10, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 200ms',
        animation: animating ? 'lineupSwapFlash 500ms ease-out' : undefined,
      }}>{initials}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: 1.1 }}>
          {firstName} {lastInitial}.
        </div>
        <div style={{ fontSize: 9.5, color: TACTIUM.textFaint, letterSpacing: 0.5,
                      textTransform: 'uppercase', marginTop: 2, fontFamily: MONO }}>
          {p.pos} · <span style={{ color: TACTIUM.textMuted }}>{p.pts}</span>
        </div>
      </div>
    </button>
  );
}

// ============= BENCH BAR =============
function BenchBar({ players, sel, onTap, teamPts, isAnimating }) {
  const sorted = [...players].sort((a,b)=>b.pts-a.pts);
  const slotSelected = sel?.kind === 'slot';

  return (
    <div onClick={e => e.stopPropagation()}
         style={{
      borderTop: `1px solid ${slotSelected ? TACTIUM.accent + '40' : TACTIUM.hair}`,
      background: slotSelected ? `${TACTIUM.accent}06` : TACTIUM.bgCard,
      padding: '10px 0 8px',
      transition: 'all 220ms',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, color: slotSelected ? TACTIUM.accent : TACTIUM.textFaint,
                        letterSpacing: 1.6, transition: 'color 220ms',
                        textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO }}>
            Banquillo · {players.length}
          </div>
          {slotSelected && (
            <div style={{ fontSize: 10, color: TACTIUM.accent, fontFamily: MONO,
                          letterSpacing: 1, fontWeight: 600,
                          padding: '2px 6px', borderRadius: 4,
                          background: `${TACTIUM.accent}18`,
                          animation: 'lineupSlideDown 220ms ease-out' }}>
              ↓ TOCA UNO
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.2,
                      textTransform: 'uppercase', fontFamily: MONO, fontWeight: 500 }}>
          Σ equipo <span style={{ color: TACTIUM.text, marginLeft: 4 }}>{teamPts}</span>
        </div>
      </div>

      {players.length === 0 ? (
        <div style={{ padding: '8px 18px 4px', fontSize: 12, color: TACTIUM.textFaint }}>
          Todos los jugadores están alineados
        </div>
      ) : (
        <div style={{
          display: 'flex', gap: 8, padding: '0 16px 4px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {sorted.map(p => (
            <BenchChip key={p.id} p={p}
              selected={sel?.kind === 'bench' && sel.id === p.id}
              dimmed={sel && !(sel.kind === 'bench' && sel.id === p.id)}
              animating={isAnimating(p.id)}
              onTap={() => onTap(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BenchChip({ p, selected, dimmed, animating, onTap }) {
  const [pressed, setPressed] = React.useState(false);
  const initials = (p.name.split(' ')[1] || p.name).slice(0, 2).toUpperCase();

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        height: 56, padding: '0 12px 0 8px', borderRadius: 14,
        background: selected ? `${TACTIUM.accent}14` : TACTIUM.bgRaised,
        border: `1px solid ${selected ? TACTIUM.accent : TACTIUM.hair}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        cursor: 'pointer', color: TACTIUM.text, fontFamily: FONT,
        opacity: dimmed && !selected ? 0.5 : 1,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'all 180ms',
        boxShadow: selected ? `0 6px 16px ${TACTIUM.accent}30` : `0 1px 0 ${TACTIUM.hair}`,
        animation: selected ? 'lineupSelectGlow 1.4s ease-in-out infinite' : undefined,
      }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: selected ? TACTIUM.accent : `${TACTIUM.accent}15`,
        color: selected ? '#000' : TACTIUM.accent,
        fontFamily: MONO, fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 200ms',
        animation: animating ? 'lineupSwapFlash 500ms ease-out' : undefined,
      }}>{initials}</div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: -0.1, lineHeight: 1.1,
                      whiteSpace: 'nowrap' }}>
          {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
        </div>
        <div style={{ fontSize: 9.5, color: TACTIUM.textFaint, fontFamily: MONO,
                      letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' }}>
          {p.pos} · {p.pts}
        </div>
      </div>
    </button>
  );
}

window.ScreenLineup = ScreenLineup;
