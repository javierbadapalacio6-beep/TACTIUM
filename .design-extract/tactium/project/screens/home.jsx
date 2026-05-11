// TACTIUM — Home
// Hierarchy:
//   1. Hero card (próxima jornada) — dominant focal
//   2. Primary CTA "Crear alineación" — single primary action
//   3. Secondary actions grid (3) + status footer

function ScreenHome({ onOpenJornada, onOpenAvail, onOpenLineup, onOpenSeasons, onOpenTeam, onOpenProfile, players }) {
  const avail = players.filter(p => p.avail).length;
  const total = players.length;
  const pct   = Math.round(avail/total*100);

  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* ── Top bar ──────────────────────────────────────── */}
      <div style={{ paddingTop: 60, padding: '60px 22px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TactiumMark size={34} gradient />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ ...TYPE.meta, color: TACTIUM.textFaint, letterSpacing: 1.6 }}>CAPITÁN</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>Padel Club · 2ª</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton onClick={onOpenSeasons}><IconCalendar size={18} color={TACTIUM.text} /></IconButton>
          <button onClick={onOpenProfile} style={{
            width: 40, height: 40, borderRadius: 12,
            border: `1px solid ${TACTIUM.accent}40`,
            background: `${TACTIUM.accent}10`, color: TACTIUM.accent, cursor: 'pointer',
            fontFamily: FONT, fontSize: 12, fontWeight: 600, letterSpacing: -0.2,
          }}>CP</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 22px 36px' }}>

        {/* ── 1 · Hero — Próxima jornada ──────────────────────── */}
        <div style={{ ...TYPE.eyebrow, marginBottom: 14 }}>Próxima jornada</div>

        <div onClick={onOpenJornada} style={{
          background: `linear-gradient(155deg, ${TACTIUM.primary} 0%, #062520 55%, ${TACTIUM.bg} 100%)`,
          borderRadius: 24, padding: '22px 24px 24px',
          border: `1px solid ${TACTIUM.accent}30`,
          position: 'relative', overflow: 'hidden', cursor: 'pointer',
          boxShadow: `0 16px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset`,
        }}>
          {/* court watermark */}
          <svg width="240" height="160" viewBox="0 0 240 160" style={{
            position: 'absolute', top: -20, right: -50, opacity: 0.16, pointerEvents: 'none',
          }}>
            <rect x="2" y="2" width="236" height="156" rx="3" stroke={TACTIUM.accent} strokeWidth="1.2" fill="none"/>
            <path d="M120 2v156M2 80h236M70 2v156M170 2v156" stroke={TACTIUM.accent} strokeWidth="1" />
            <path d="M70 50h100M70 110h100" stroke={TACTIUM.accent} strokeWidth="0.8" strokeOpacity="0.6" />
          </svg>

          {/* Live badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative' }}>
            <NeonDot size={6} />
            <div style={{ fontFamily: MONO, fontSize: 11, color: TACTIUM.accent, letterSpacing: 1.6 }}>
              J·07 · DOM 03 MAY · 10:00
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, color: TACTIUM.textMuted, marginBottom: 4, fontWeight: 500 }}>vs.</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05, marginBottom: 6 }}>
              Club Visitante
            </div>
            <div style={{ fontSize: 13, color: TACTIUM.textMuted }}>
              Pista local · 5 partidos
            </div>
          </div>

          {/* Status grid */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, position: 'relative' }}>
            <StatChip label="DISPONIBLES" value={`${avail}`} suffix={`/ ${total}`} highlight />
            <StatChip label="ALINEACIÓN" value="—" sub="Pendiente" />
            <StatChip label="DÍAS" value="3" sub="restantes" />
          </div>

          {/* CTA bar */}
          <div style={{
            marginTop: 22, paddingTop: 16, position: 'relative',
            borderTop: `1px solid ${TACTIUM.hairStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, color: TACTIUM.text, fontWeight: 500 }}>Abrir jornada</div>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: TACTIUM.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 18px ${TACTIUM.accent}50`,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#001810" strokeWidth="2.2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h8M7 3l4 4-4 4" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── 2 · Primary CTA ─────────────────────────────────── */}
        <button onClick={onOpenLineup} style={{ ...btnPrimary, marginTop: 22 }}>
          <IconCourt color="#001810" size={20} />
          Crear alineación
        </button>

        {/* ── 3 · Secondary actions ───────────────────────────── */}
        <div style={{ marginTop: 32, ...TYPE.eyebrow, color: TACTIUM.textFaint, marginBottom: 14 }}>
          Atajos
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ActionRow icon={<IconTeam color={TACTIUM.accent} size={20} />}
                     title="Disponibilidad"
                     value={`${avail}/${total}`}
                     hint={`${pct}% del equipo confirmado`}
                     onClick={onOpenAvail} />
          <ActionRow icon={<IconAnalytics color={TACTIUM.accent} size={20} />}
                     title="Plantilla"
                     value={String(players.length)}
                     hint="Estadísticas y puntos FEP"
                     onClick={onOpenTeam} />
          <ActionRow icon={<IconCalendar color={TACTIUM.accent} size={20} />}
                     title="Temporadas"
                     value="25/26"
                     hint="Liga 2ª · jornada 07 de 18"
                     onClick={onOpenSeasons} />
        </div>

        {/* ── 4 · Status footer ───────────────────────────────── */}
        <div style={{
          marginTop: 28, padding: '16px 18px',
          background: TACTIUM.bgCard, borderRadius: R.md,
          border: `1px solid ${TACTIUM.hair}`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `conic-gradient(${TACTIUM.accent} ${pct}%, ${TACTIUM.bgRaised} ${pct}% 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: TACTIUM.bgCard,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 11, color: TACTIUM.accent, fontWeight: 500,
            }}>{pct}%</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Equipo confirmado</div>
            <div style={{ fontSize: 12, color: TACTIUM.textMuted, marginTop: 2 }}>
              {avail} de {total} disponibles para J·07
            </div>
          </div>
          <button onClick={onOpenAvail} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TACTIUM.accent, fontSize: 12, fontWeight: 500, fontFamily: FONT,
          }}>Gestionar →</button>
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 12,
      border: `1px solid ${TACTIUM.hairStrong}`,
      background: TACTIUM.bgCard, color: TACTIUM.text, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

function StatChip({ label, value, suffix, sub, highlight }) {
  const color = highlight ? TACTIUM.accent : TACTIUM.text;
  return (
    <div style={{
      flex: 1, background: 'rgba(0,0,0,0.35)', borderRadius: 12,
      border: `1px solid ${highlight ? TACTIUM.accent + '30' : TACTIUM.hairStrong}`,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, color: TACTIUM.textFaint, letterSpacing: 1.4,
                    fontFamily: MONO, fontWeight: 500 }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 500, color, marginTop: 4,
        letterSpacing: -0.4, display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        {value}{suffix && <span style={{ fontSize: 11, color: TACTIUM.textFaint, fontWeight: 400 }}>{suffix}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: TACTIUM.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ActionRow({ icon, title, value, hint, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: TACTIUM.bgCard,
      border: `1px solid ${TACTIUM.hair}`,
      borderRadius: R.md, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      color: TACTIUM.text, fontFamily: FONT,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11,
        background: `${TACTIUM.accent}12`,
        border: `1px solid ${TACTIUM.accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 12, color: TACTIUM.textMuted, marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 13, color: TACTIUM.text,
        padding: '6px 10px', borderRadius: 8,
        background: TACTIUM.bgRaised,
        letterSpacing: -0.2, fontWeight: 500,
      }}>{value}</div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={TACTIUM.textFaint} strokeWidth="1.5"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3l4 4-4 4" />
      </svg>
    </button>
  );
}

window.ScreenHome = ScreenHome;
