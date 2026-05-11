// TACTIUM — Temporada detalle (lista de jornadas)

function ScreenSeasonDetail({ onBack, onOpenJornada, seasonId }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  // mock journeys for the active season
  const initial = [
    { i: 1,  date: '14 SEP', time: '10:00', rival: 'Club A',         home: true,  state: 'won',  score: '3‑2', phase: 'liga' },
    { i: 2,  date: '21 SEP', time: '17:00', rival: 'Club B',         home: false, state: 'lost', score: '2‑3', phase: 'liga' },
    { i: 3,  date: '05 OCT', time: '10:00', rival: 'Club C',         home: true,  state: 'won',  score: '4‑1', phase: 'liga' },
    { i: 4,  date: '19 OCT', time: '18:00', rival: 'Club D',         home: false, state: 'won',  score: '3‑2', phase: 'liga' },
    { i: 5,  date: '02 NOV', time: '10:00', rival: 'Club E',         home: true,  state: 'draw', score: '—',    phase: 'liga' },
    { i: 6,  date: '16 NOV', time: '11:00', rival: 'Club F',         home: false, state: 'won',  score: '4‑1', phase: 'liga' },
    { i: 7,  date: '03 MAY', time: '10:00', rival: 'Club Visitante', home: true,  state: 'next', score: '—',    phase: 'liga' },
    { i: 8,  date: '17 MAY', time: '17:00', rival: 'Club G',         home: false, state: 'sched',score: '—',    phase: 'liga' },
    { i: 9,  date: '31 MAY', time: '10:00', rival: 'Club H',         home: true,  state: 'sched',score: '—',    phase: 'liga' },
    { i: 10, date: '14 JUN', time: '18:00', rival: 'Club I',         home: false, state: 'sched',score: '—',    phase: 'liga' },
    { i: 11, date: '28 JUN', time: '10:00', rival: 'Club J',         home: true,  state: 'sched',score: '—',    phase: 'playoff' },
  ];
  const [journeys, setJourneys] = React.useState(initial);
  const [filter, setFilter] = React.useState('all');

  const update = (i, patch) => setJourneys(journeys.map(j => j.i === i ? {...j, ...patch} : j));
  const remove = (i) => setJourneys(journeys.filter(j => j.i !== i));
  const add = (data) => {
    const next = Math.max(...journeys.map(j=>j.i)) + 1;
    setJourneys([...journeys, { i: next, ...data, state: 'sched', score: '—' }]);
    setCreating(false);
  };

  const filtered = journeys.filter(j =>
    filter === 'all' ? true :
    filter === 'liga' ? j.phase === 'liga' :
    filter === 'playoff' ? j.phase === 'playoff' : true
  );
  const liga = journeys.filter(j => j.phase === 'liga').length;
  const playoff = journeys.filter(j => j.phase === 'playoff').length;
  const wins = journeys.filter(j => j.state === 'won').length;
  const draws = journeys.filter(j => j.state === 'draw').length;
  const losses = journeys.filter(j => j.state === 'lost').length;
  const played = wins + draws + losses;

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
        }}><IconBack size={16} /> Temporadas</button>
        <button onClick={() => setCreating(true)} style={{
          height: 36, padding: '0 12px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.accent}50`,
          background: `${TACTIUM.accent}15`, color: TACTIUM.accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
        }}><IconPlus size={14} /> Jornada</button>
      </div>

      {/* Header */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <NeonDot size={6} />
          <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                        textTransform: 'uppercase', fontWeight: 500 }}>Activa · 2ª</div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Temporada 25/26
        </div>

        {/* Stat strip */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16,
                      paddingTop: 14, paddingBottom: 4,
                      borderTop: `1px solid ${TACTIUM.hair}` }}>
          <SeasonMini label="Jornadas" value={`${played}/${journeys.length}`} />
          <div style={{ width: 1, background: TACTIUM.hair }} />
          <SeasonMini label="V" value={wins} highlight />
          <SeasonMini label="E" value={draws} />
          <SeasonMini label="D" value={losses} />
          <div style={{ width: 1, background: TACTIUM.hair }} />
          <SeasonMini label="Tasa V" value={played ? `${Math.round(wins/played*100)}%` : '—'} />
        </div>
      </div>

      {/* Phase filter */}
      <div style={{ padding: '14px 20px 8px' }}>
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: TACTIUM.bgCard, borderRadius: 12,
          border: `1px solid ${TACTIUM.hair}`,
        }}>
          {[
            ['all','Todas', journeys.length],
            ['liga','Liga', liga],
            ['playoff','Playoff', playoff],
          ].map(([k,l,c]) => (
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

      {/* Journey list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        {/* Phase: Liga */}
        {(filter === 'all' || filter === 'liga') && (
          <React.Fragment>
            <PhaseHeader label="Liga regular" count={liga} />
            <JourneyList items={filtered.filter(j => j.phase === 'liga')}
              onOpen={onOpenJornada} onEdit={setEditing} />
          </React.Fragment>
        )}

        {/* Phase: Playoff */}
        {(filter === 'all' || filter === 'playoff') && (
          <React.Fragment>
            <PhaseHeader label="Playoff" count={playoff} dim />
            <JourneyList items={filtered.filter(j => j.phase === 'playoff')}
              onOpen={onOpenJornada} onEdit={setEditing} />
          </React.Fragment>
        )}

        <button onClick={() => setCreating(true)} style={{
          marginTop: 12, width: '100%',
          padding: '14px',
          background: 'transparent',
          border: `1.5px dashed ${TACTIUM.hairStrong}`,
          borderRadius: 14, color: TACTIUM.accent,
          fontFamily: FONT, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <IconPlus size={14} /> Crear nueva jornada
        </button>
      </div>

      {creating && <JourneyEditSheet onClose={() => setCreating(false)}
        onSave={add} title="Nueva jornada" />}
      {editing && <JourneyEditSheet journey={editing}
        onClose={() => setEditing(null)}
        onSave={(data) => { update(editing.i, data); setEditing(null); }}
        onRemove={() => { remove(editing.i); setEditing(null); }}
        title={`Jornada ${String(editing.i).padStart(2,'0')}`} />}
    </div>
  );
}

function SeasonMini({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500,
                    color: highlight ? TACTIUM.accent : TACTIUM.text,
                    letterSpacing: -0.3, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5,
                    textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  );
}

function PhaseHeader({ label, count, dim }) {
  return (
    <div style={{
      marginTop: 16, marginBottom: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 4, height: 14, borderRadius: 2,
                      background: dim ? TACTIUM.primary : TACTIUM.accent }} />
        <div style={{ fontSize: 11, letterSpacing: 3, color: dim ? TACTIUM.textFaint : TACTIUM.text,
                      textTransform: 'uppercase', fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.textFaint, letterSpacing: 1 }}>
        {String(count).padStart(2,'0')}
      </div>
    </div>
  );
}

function JourneyList({ items, onOpen, onEdit }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 14,
                    background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hair}`,
                    fontSize: 13, color: TACTIUM.textFaint, textAlign: 'center' }}>
        Sin jornadas en esta fase
      </div>
    );
  }
  return (
    <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                  border: `1px solid ${TACTIUM.hair}`, overflow: 'hidden' }}>
      {items.map((j, idx) => (
        <JourneyRow key={j.i} j={j} last={idx === items.length - 1}
          onOpen={() => onOpen(j.i)} onEdit={() => onEdit(j)} />
      ))}
    </div>
  );
}

function JourneyRow({ j, last, onOpen, onEdit }) {
  const stateMeta = {
    won:   { color: TACTIUM.accent, bg: `${TACTIUM.accent}12`, label: 'V' },
    draw:  { color: TACTIUM.warn,   bg: `${TACTIUM.warn}15`,   label: 'E' },
    lost:  { color: TACTIUM.err,    bg: `${TACTIUM.err}12`,    label: 'D' },
    next:  { color: TACTIUM.accent, bg: `${TACTIUM.accent}12`, label: '◉' },
    sched: { color: TACTIUM.textFaint, bg: TACTIUM.bgRaised,   label: '—' },
  }[j.state];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      borderBottom: last ? 'none' : `1px solid ${TACTIUM.hair}`,
      position: 'relative',
    }}>
      <button onClick={onOpen} style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, color: 'inherit', textAlign: 'left',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: j.state === 'next' ? `${TACTIUM.accent}15` : TACTIUM.bgRaised,
          color: j.state === 'next' ? TACTIUM.accent : TACTIUM.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 12, fontWeight: 500, position: 'relative',
        }}>
          J{String(j.i).padStart(2,'0')}
          {j.state === 'next' && (
            <div style={{ position: 'absolute', top: -2, right: -2,
                          width: 8, height: 8, borderRadius: '50%',
                          background: TACTIUM.accent,
                          boxShadow: `0 0 6px ${TACTIUM.accent}` }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: -0.1,
                        display: 'flex', alignItems: 'center', gap: 6 }}>
            {j.home ? '' : '@ '}{j.rival}
          </div>
          <div style={{ fontSize: 11, color: TACTIUM.textFaint, marginTop: 2,
                        fontFamily: MONO, letterSpacing: 0.5 }}>
            {j.date}{j.time ? ` · ${j.time}` : ''} · {j.home ? 'CASA' : 'FUERA'}
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 12, padding: '4px 10px', borderRadius: 8,
          color: stateMeta.color, background: stateMeta.bg,
          border: `1px solid ${stateMeta.color}25`,
          letterSpacing: 0.5, minWidth: 44, textAlign: 'center',
        }}>{j.state === 'sched' || j.state === 'next' ? stateMeta.label : `${stateMeta.label} ${j.score}`}</div>
      </button>
      <button onClick={onEdit} style={{
        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
        background: 'transparent', color: TACTIUM.textFaint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9.5 2L12 4.5l-7.5 7.5H2v-2.5L9.5 2z" stroke={TACTIUM.textFaint}
                strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>
    </div>
  );
}

// Parse "03 MAY" → {day:3, month:4} (0-indexed). Returns null if invalid.
const MONTHS_ES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MONTHS_ES_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEK_ES = ['L','M','X','J','V','S','D'];
function parseDate(s) {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\s+([A-ZÁÉÍÓÚ]{3})$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS_ES.indexOf(m[2].toUpperCase());
  if (month < 0) return null;
  return { day, month };
}
function fmtDate(day, month) {
  return `${String(day).padStart(2,'0')} ${MONTHS_ES[month]}`;
}

function CalendarPicker({ value, onPick, onClose }) {
  const today = new Date();
  const init = parseDate(value);
  const [viewMonth, setViewMonth] = React.useState(init?.month ?? today.getMonth());
  const [viewYear, setViewYear] = React.useState(today.getFullYear());

  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) => init && init.day === d && init.month === viewMonth;
  const isToday = (d) => today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40,
                  display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        background: TACTIUM.bgRaised, borderTop: `1px solid ${TACTIUM.hairStrong}`,
        borderRadius: '24px 24px 0 0', padding: '14px 20px 26px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3,
                      background: TACTIUM.hairStrong, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear-1); } else setViewMonth(viewMonth-1); }}
            style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: TACTIUM.bgCard,
                     color: TACTIUM.text, cursor: 'pointer', fontSize: 16 }}>‹</button>
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: -0.2 }}>
            {MONTHS_ES_LONG[viewMonth]} <span style={{ color: TACTIUM.textMuted, fontFamily: MONO, fontSize: 14 }}>{viewYear}</span>
          </div>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear+1); } else setViewMonth(viewMonth+1); }}
            style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: TACTIUM.bgCard,
                     color: TACTIUM.text, cursor: 'pointer', fontSize: 16 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {WEEK_ES.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, color: TACTIUM.textFaint,
                                   fontFamily: MONO, letterSpacing: 1, padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const sel = isSelected(d);
            const tod = isToday(d);
            return (
              <button key={i} onClick={() => { onPick(fmtDate(d, viewMonth)); onClose(); }}
                style={{
                  height: 40, borderRadius: 10, cursor: 'pointer',
                  background: sel ? TACTIUM.accent : 'transparent',
                  color: sel ? '#000' : (tod ? TACTIUM.accent : TACTIUM.text),
                  border: tod && !sel ? `1px solid ${TACTIUM.accent}50` : 'none',
                  fontFamily: MONO, fontSize: 14, fontWeight: sel ? 600 : 400,
                }}>{d}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimePicker({ value, onPick, onClose }) {
  const [h, m] = (value || '10:00').split(':').map(x => parseInt(x, 10));
  const [hour, setHour] = React.useState(isNaN(h) ? 10 : h);
  const [min, setMin]   = React.useState(isNaN(m) ? 0 : m);
  const hours = Array.from({length: 24}, (_, i) => i);
  const mins  = [0, 15, 30, 45];

  const colStyle = {
    flex: 1, height: 200, overflowY: 'auto', scrollSnapType: 'y mandatory',
    paddingTop: 80, paddingBottom: 80,
  };
  const cellStyle = (sel) => ({
    height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: MONO, fontSize: sel ? 22 : 16, color: sel ? TACTIUM.accent : TACTIUM.textMuted,
    fontWeight: sel ? 600 : 400, scrollSnapAlign: 'center', cursor: 'pointer',
    transition: 'all .15s',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40,
                  display: 'flex', flexDirection: 'column' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        background: TACTIUM.bgRaised, borderTop: `1px solid ${TACTIUM.hairStrong}`,
        borderRadius: '24px 24px 0 0', padding: '14px 20px 26px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3,
                      background: TACTIUM.hairStrong, margin: '0 auto 14px' }} />
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 500, marginBottom: 4 }}>Hora</div>
        <div style={{ textAlign: 'center', fontSize: 11, color: TACTIUM.textFaint,
                      fontFamily: MONO, letterSpacing: 1, marginBottom: 16 }}>SELECCIONA</div>

        {/* Wheel-style picker */}
        <div style={{ position: 'relative', display: 'flex', gap: 8,
                      background: TACTIUM.bgCard, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 80, left: 0, right: 0, height: 40,
                        background: `${TACTIUM.accent}10`,
                        borderTop: `1px solid ${TACTIUM.accent}30`,
                        borderBottom: `1px solid ${TACTIUM.accent}30`, pointerEvents: 'none' }} />
          <div style={colStyle}>
            {hours.map(hh => (
              <div key={hh} onClick={() => setHour(hh)} style={cellStyle(hh === hour)}>
                {String(hh).padStart(2,'0')}
              </div>
            ))}
          </div>
          <div style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: MONO, fontSize: 22, color: TACTIUM.accent }}>:</div>
          <div style={colStyle}>
            {mins.map(mm => (
              <div key={mm} onClick={() => setMin(mm)} style={cellStyle(mm === min)}>
                {String(mm).padStart(2,'0')}
              </div>
            ))}
          </div>
        </div>

        {/* Quick chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {['09:00','10:00','11:00','17:00','18:00','19:00','20:00'].map(t => {
            const sel = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}` === t;
            return (
              <button key={t} onClick={() => { const [hh,mm] = t.split(':'); setHour(+hh); setMin(+mm); }}
                style={{
                padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
                background: sel ? `${TACTIUM.accent}15` : TACTIUM.bg,
                color: sel ? TACTIUM.accent : TACTIUM.textMuted,
                border: `1px solid ${sel ? TACTIUM.accent + '40' : TACTIUM.hair}`,
                fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: 0.5,
              }}>{t}</button>
            );
          })}
        </div>

        <button onClick={() => { onPick(`${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`); onClose(); }}
          style={{
            width: '100%', height: 50, borderRadius: 13, marginTop: 16,
            background: TACTIUM.accent, color: '#000', border: 'none', cursor: 'pointer',
            fontFamily: FONT, fontSize: 15, fontWeight: 500,
            boxShadow: `0 8px 20px ${TACTIUM.accent}40`,
          }}>Confirmar</button>
      </div>
    </div>
  );
}

function JourneyEditSheet({ journey, onClose, onSave, onRemove, title }) {
  const [rival, setRival] = React.useState(journey?.rival || '');
  const [date, setDate]   = React.useState(journey?.date  || '');
  const [time, setTime]   = React.useState(journey?.time  || '10:00');
  const [home, setHome]   = React.useState(journey?.home ?? true);
  const [phase, setPhase] = React.useState(journey?.phase || 'liga');
  const [score, setScore] = React.useState((journey?.score && journey.score !== '—') ? journey.score : '');
  const [state, setState] = React.useState(journey?.state || 'sched');
  const [showCal, setShowCal]   = React.useState(false);
  const [showTime, setShowTime] = React.useState(false);

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
                        textTransform: 'uppercase', fontWeight: 500 }}>{journey ? 'Editar' : 'Crear'}</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4, marginTop: 4 }}>
            {title}
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <FormRow label="Rival">
            <input value={rival} onChange={e=>setRival(e.target.value)} placeholder="Club X"
              autoFocus style={inputStyle} />
          </FormRow>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <FormRow label="Fecha">
                <button onClick={() => setShowCal(true)} style={{
                  ...inputStyle, fontFamily: MONO, letterSpacing: 0.5, cursor: 'pointer',
                  textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: date ? TACTIUM.text : TACTIUM.textFaint,
                }}>
                  <span>{date || '—'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TACTIUM.accent} strokeWidth="1.6">
                    <rect x="3" y="5" width="18" height="16" rx="2"/>
                    <path d="M3 9h18M8 3v4M16 3v4"/>
                  </svg>
                </button>
              </FormRow>
            </div>
            <div style={{ flex: 1 }}>
              <FormRow label="Hora">
                <button onClick={() => setShowTime(true)} style={{
                  ...inputStyle, fontFamily: MONO, letterSpacing: 0.5, cursor: 'pointer',
                  textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  color: TACTIUM.text,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TACTIUM.accent} strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                  </svg>
                  {time}
                </button>
              </FormRow>
            </div>
          </div>

          <FormRow label="Localización">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['true','Casa'], ['false','Fuera']].map(([v,l]) => {
                const sel = String(home) === v;
                return (
                  <button key={v} onClick={()=>setHome(v === 'true')} style={{
                    flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                    background: sel ? TACTIUM.accent : TACTIUM.bgCard,
                    color: sel ? '#000' : TACTIUM.text,
                    border: `1px solid ${sel ? TACTIUM.accent : TACTIUM.hairStrong}`,
                    fontFamily: FONT, fontSize: 14, fontWeight: 500,
                  }}>{l}</button>
                );
              })}
            </div>
          </FormRow>

          <FormRow label="Fase">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['liga','Liga'], ['playoff','Playoff']].map(([v,l]) => {
                const sel = phase === v;
                return (
                  <button key={v} onClick={()=>setPhase(v)} style={{
                    flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                    background: sel ? TACTIUM.bgCard : TACTIUM.bgCard,
                    color: sel ? TACTIUM.accent : TACTIUM.textMuted,
                    border: `1px solid ${sel ? TACTIUM.accent + '60' : TACTIUM.hairStrong}`,
                    fontFamily: FONT, fontSize: 14, fontWeight: 500,
                  }}>{l}</button>
                );
              })}
            </div>
          </FormRow>

          {journey && (
            <React.Fragment>
              <FormRow label="Resultado">
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['sched','—'],['won','V'],['draw','E'],['lost','D']].map(([v,l]) => {
                    const sel = state === v;
                    const tint = v === 'won' ? TACTIUM.accent
                              : v === 'draw' ? TACTIUM.warn
                              : v === 'lost' ? TACTIUM.err
                              : TACTIUM.textMuted;
                    return (
                      <button key={v} onClick={()=>setState(v)} style={{
                        flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                        background: sel ? `${tint}15` : TACTIUM.bgCard,
                        color: sel ? tint : TACTIUM.textMuted,
                        border: `1px solid ${sel ? tint + '60' : TACTIUM.hairStrong}`,
                        fontFamily: MONO, fontSize: 14, fontWeight: 500,
                      }}>{l}</button>
                    );
                  })}
                </div>
              </FormRow>
              {state !== 'sched' && (
                <FormRow label="Marcador">
                  <input value={score} onChange={e=>setScore(e.target.value)}
                    placeholder="3‑2"
                    style={{...inputStyle, fontFamily: MONO}} />
                </FormRow>
              )}
            </React.Fragment>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {journey && (
              <button onClick={onRemove} style={{
                flex: 1, height: 50, borderRadius: 13, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${TACTIUM.err}40`,
                color: TACTIUM.err, fontFamily: FONT, fontSize: 14, fontWeight: 500,
              }}>Eliminar</button>
            )}
            <button disabled={!rival || !date || !time}
              onClick={() => onSave({ rival, date, time, home, phase,
                                       ...(journey ? { state, score: (state === 'sched' ? '—' : (score || '—')) } : {}) })}
              style={{
              flex: journey ? 2 : 1, height: 50, borderRadius: 13,
              cursor: (rival && date && time) ? 'pointer' : 'default',
              background: TACTIUM.accent, color: '#000', border: 'none',
              fontFamily: FONT, fontSize: 15, fontWeight: 500,
              boxShadow: (rival && date && time) ? `0 8px 20px ${TACTIUM.accent}40` : 'none',
              opacity: (rival && date && time) ? 1 : 0.4,
            }}>{journey ? 'Guardar' : 'Crear jornada'}</button>
          </div>
        </div>
      </div>

      {showCal && <CalendarPicker value={date} onPick={setDate} onClose={() => setShowCal(false)} />}
      {showTime && <TimePicker value={time} onPick={setTime} onClose={() => setShowTime(false)} />}
    </div>
  );
}

window.ScreenSeasonDetail = ScreenSeasonDetail;
