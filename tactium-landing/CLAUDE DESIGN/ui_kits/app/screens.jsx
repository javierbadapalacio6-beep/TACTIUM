// TACTIUM · App UI kit · screens
// HomeScreen, AlineacionScreen, JornadaScreen, ClubScreen, OnboardingWelcome

const { useState: useS } = React;

// ───── Shared screen scaffold ──────────────────────────────────────
function ScreenShell({ children, hasTabBar, bottomCTA, tabActive, onTab, tabMode }) {
  return (
    <div style={{
      position: "relative", height: "100%", overflow: "hidden",
      background: "var(--color-bg)", color: "var(--color-text)",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        height: "100%", overflowY: "auto",
        paddingTop: 56, // below status bar / dynamic island
        paddingBottom: hasTabBar ? 110 : (bottomCTA ? 110 : 40),
      }}>{children}</div>
      {bottomCTA && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 20px 28px",
          background: "linear-gradient(to top, var(--color-bg) 55%, rgba(3,15,15,0))",
        }}>{bottomCTA}</div>
      )}
      {hasTabBar && <BottomTabBar active={tabActive} onChange={onTab} mode={tabMode}/>}
    </div>
  );
}

// ───── Home (capitan) ──────────────────────────────────────────────
function HomeScreen({ go, onTab }) {
  return (
    <ScreenShell hasTabBar tabActive="inicio" onTab={onTab}>
      <AmbientGlow pos="top" color="rgba(0,223,130,0.10)"/>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Tile variant="brand" size={48} radius={12}>T</Tile>
          <div style={{ flex: 1 }}>
            <Eyebrow dim>CAPITÁN</Eyebrow>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 18, marginTop: 4 }}>
              SMASH TEAM · 3ª · Grupo C
            </div>
          </div>
          <IconPill icon={IconCalendar}/>
        </div>

        <div style={{ height: 36 }}/>
        <Eyebrow>PRÓXIMA JORNADA</Eyebrow>

        <div onClick={() => go("jornada")} style={{
          marginTop: 12, background: "var(--color-bg-card)", borderRadius: 24, padding: 26,
          boxShadow: "inset 0 0 0 1px var(--color-hair)",
          textAlign: "center", cursor: "pointer",
        }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: "var(--color-text)" }}>Aún no hay jornadas</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Crea una temporada activa desde la pestaña Temporadas.
          </div>
          <div style={{ marginTop: 22 }}>
            <button style={{
              background: "var(--color-accent)", color: "var(--color-text-inverse)",
              border: 0, borderRadius: 999, padding: "16px 28px",
              fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, cursor: "pointer",
              boxShadow: "0 10px 30px -8px rgba(0,223,130,0.55)",
              display: "inline-flex", alignItems: "center", gap: 10,
            }}>
              Crear temporada <IconArrowR size={18} color="var(--color-text-inverse)"/>
            </button>
          </div>
        </div>

        <div style={{ height: 40 }}/>
        <Eyebrow dim>ATAJOS</Eyebrow>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <ShortcutRow icon={IconUsers} title="Disponibilidad" sub="0% del equipo confirmado" stat="0/1"/>
          <ShortcutRow icon={IconBarChart} title="Plantilla" sub="Estadísticas y puntos FEP" stat="0"/>
          <ShortcutRow icon={IconCalendar} title="Temporadas" sub="Sin temporada activa" stat="—"/>
        </div>

        <div style={{ height: 24 }}/>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "var(--color-bg-card)", borderRadius: 16, padding: "14px 16px",
          boxShadow: "inset 0 0 0 1px var(--color-hair)",
        }}>
          <RingStat value={0}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Equipo confirmado</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 2 }}>
              0 de 1 disponibles para J·07
            </div>
          </div>
          <div style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 14 }}>Gestionar →</div>
        </div>
      </div>
    </ScreenShell>
  );
}

function ShortcutRow({ icon: Icon, title, sub, stat }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "var(--color-bg-card)", borderRadius: 16, padding: "14px 16px",
      boxShadow: "inset 0 0 0 1px var(--color-hair)",
    }}>
      <Tile variant="accent" size={44} radius={12}><Icon size={20} color="var(--color-accent)"/></Tile>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text)",
        background: "rgba(232,245,239,0.04)", padding: "8px 12px", borderRadius: 10,
        boxShadow: "inset 0 0 0 1px var(--color-hair-strong)", letterSpacing: "0.05em",
      }}>{stat}</div>
      <IconChevRightSm size={18} color="var(--color-text-faint)"/>
    </div>
  );
}

function RingStat({ value }) {
  const r = 18, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div style={{ position: "relative", width: 48, height: 48 }}>
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(232,245,239,0.10)" strokeWidth="3"/>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 24 24)"/>
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text)", letterSpacing: "0.05em",
      }}>{value}%</div>
    </div>
  );
}

// ───── Jornada (matchday detail) ───────────────────────────────────
function JornadaScreen({ go, state = "pending" }) {
  // pending = no lineup yet, validated = with results
  const cta = state === "pending"
    ? <PrimaryCTA icon={IconGrid} onClick={() => go("alineacion")}>Crear alineación</PrimaryCTA>
    : <PrimaryCTA icon={IconGrid} onClick={() => go("alineacion")}>Ver alineación</PrimaryCTA>;

  return (
    <ScreenShell bottomCTA={cta}>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BackPill onClick={() => go("home")}>Inicio</BackPill>
          <IconPill icon={state === "pending" ? IconPencil : IconShare}/>
        </div>

        <div style={{ height: 24 }}/>
        <Eyebrow>JORNADA 01 · {state === "pending" ? "Temporada 26/27" : "Temporada 2026"}</Eyebrow>
        <h1 style={{ marginTop: 8, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          vs. {state === "pending" ? "CD Padel" : "Fort Padel"}
        </h1>

        <div style={{ height: 16 }}/>
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Tile variant="accent" size={52} radius={12}>{state === "pending" ? "CP" : "FP"}</Tile>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.20em", color: "var(--color-text-faint)" }}>RIVAL</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 2 }}>{state === "pending" ? "CD Padel" : "Fort Padel"}</div>
              </div>
            </div>
            <Badge kind={state === "pending" ? "accent" : "ghost"} dot={state === "pending"}>
              {state === "pending" ? "LOCAL" : "○ VISITANTE"}
            </Badge>
          </div>
          <div style={{ height: 1, background: "var(--color-hair)", margin: "16px 0" }}/>
          <div style={{ display: "flex", gap: 28 }}>
            <FieldRow icon={IconCalendar} top={state === "pending" ? "Sábado 09 may" : "Sábado 02 may"} bot={state === "pending" ? "12:00" : "11:30"}/>
            <FieldRow icon={IconMapPin} top={state === "pending" ? "Club SMASH" : "Club 1"} bot=""/>
          </div>
        </Card>

        <div style={{ height: 14 }}/>
        {state === "pending" ? (
          <Card style={{ padding: 18 }}>
            <Badge kind="ghost" dot>Sin alineación</Badge>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <div style={{ color: "var(--color-text-muted)" }}>Crea la alineación primero</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, color: "var(--color-text-faint)", letterSpacing: "0.10em" }}>— | —</div>
            </div>
          </Card>
        ) : (
          <div style={{
            position: "relative", background: "var(--color-bg-card)", borderRadius: 16, padding: 18,
            boxShadow: "inset 0 0 0 1px rgba(242,201,76,0.40)",
          }}>
            <div style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 3, background: "#F2C94C", borderRadius: 2 }}/>
            <div style={{ paddingLeft: 8 }}>
              <Badge kind="warn" dot>Empate</Badge>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Acta cerrada · empate</div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 36, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span>2</span>
                  <span style={{ color: "var(--color-text-faint)", fontWeight: 300, fontSize: 28 }}>|</span>
                  <span style={{ color: "#F2C94C" }}>1</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 24 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow dim>Alineación</Eyebrow>
            <div style={{ fontWeight: 800, fontSize: 28, marginTop: 6, letterSpacing: "-0.02em" }}>
              {state === "pending" ? "5 parejas" : "3 parejas"}
            </div>
          </div>
          <Badge kind={state === "pending" ? "warn" : "accent"} dot>
            {state === "pending" ? "PENDIENTE" : "VALIDADA"}
          </Badge>
        </div>

        <div style={{ height: 14 }}/>
        {state === "pending" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--color-bg-card)", borderRadius: 14, padding: 14,
                boxShadow: "inset 0 0 0 1px var(--color-hair)",
              }}>
                <PIndexTile n={n} muted/>
                <div>
                  <div style={{ color: "var(--color-text-muted)", fontWeight: 700, fontSize: 17 }}>Sin asignar</div>
                  <div style={{ color: "var(--color-text-faint)", fontSize: 13, marginTop: 2 }}>Pendiente</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ResultRow p={1} top names="Juan García / Carlos Pérez" pts="4300 pts" sets="6-4 · 6-4" result="D"/>
            <ResultRow p={2} names="Pedro López / Miguel Ruiz" pts="3800 pts" sets="W.O." result="D"/>
            <ResultRow p={3} names="David Sánchez / Antonio Martín" pts="3800 pts" sets="1-6 · 1-6" result="V"/>
          </div>
        )}

        <div style={{ height: 32 }}/>
      </div>
    </ScreenShell>
  );
}

function FieldRow({ icon: Icon, top, bot }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Tile variant="mute" size={40} radius={10}><Icon size={18} color="var(--color-text-muted)"/></Tile>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{top}</div>
        {bot && <div style={{ color: "var(--color-text-faint)", fontSize: 14, marginTop: 1 }}>{bot}</div>}
      </div>
    </div>
  );
}

function PIndexTile({ n, muted }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center",
      flexDirection: "column", background: muted ? "rgba(232,245,239,0.04)" : "rgba(0,223,130,0.10)",
      color: muted ? "var(--color-text-muted)" : "var(--color-accent)",
      boxShadow: `inset 0 0 0 1px ${muted ? "var(--color-hair-strong)" : "var(--color-accent-25)"}`,
      fontFamily: "var(--font-sans)", fontWeight: 700,
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.10em", lineHeight: 1 }}>P</div>
      <div style={{ fontSize: 17, lineHeight: 1.1 }}>{n}</div>
    </div>
  );
}

function ResultRow({ p, top, names, pts, sets, result }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--color-bg-card)", borderRadius: 14, padding: 14,
      boxShadow: top ? "inset 0 0 0 1.2px var(--color-accent-40)" : "inset 0 0 0 1px var(--color-hair)",
    }}>
      <PIndexTile n={p}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{names}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          {top && <Badge kind="solid" style={{ padding: "3px 7px", fontSize: 9 }}>TOP</Badge>}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>{pts}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-faint)", letterSpacing: "0.20em" }}>SETS</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: result === "V" ? "var(--color-accent)" : "var(--color-error)", letterSpacing: "0.05em" }}>{sets}</span>
        </div>
      </div>
      <ResultChip result={result}/>
    </div>
  );
}

// ───── Alineación (lineup builder) ────────────────────────────────
function AlineacionScreen({ go }) {
  return (
    <ScreenShell bottomCTA={
      <PrimaryCTA icon={IconCheck} onClick={() => go("jornada-validated")}>Confirmar alineación</PrimaryCTA>
    }>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BackPill onClick={() => go("jornada")}>Jornada</BackPill>
          <div style={{ display: "flex", gap: 8 }}>
            <IconPill icon={IconTrash}/>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 14px", background: "transparent",
              color: "var(--color-accent)", borderRadius: 999,
              border: 0, boxShadow: "inset 0 0 0 1px var(--color-accent-40)",
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              <IconZap size={14} color="var(--color-accent)"/> Auto-orden · ON
            </button>
          </div>
        </div>

        <div style={{ height: 18 }}/>
        <Eyebrow>JORNADA · J·01 · ALINEACIÓN</Eyebrow>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>3/3 parejas</h1>
          <IconMore size={20} color="var(--color-accent)" style={{ marginTop: 14 }}/>
        </div>

        <div style={{ marginTop: 10 }}><ProgressBar value={100}/></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Las parejas se ordenan por puntos automáticamente</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "var(--color-text)", letterSpacing: "0.05em" }}>100/100 <span style={{ color: "var(--color-text-faint)" }}>EQUI.</span></span>
        </div>

        <div style={{ height: 16 }}/>
        <div style={{ display: "flex", gap: 8 }}>
          <Pill on icon><IconStar size={12} color="var(--color-accent)"/> Variante 1</Pill>
          <Pill><IconPlus size={12} color="var(--color-text-faint)"/> NUEVA</Pill>
        </div>

        <div style={{ height: 20 }}/>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ParejaCard selected n={1} label="PAREJA TITULAR" pts={4600} pct={100} a={{ init: "GA", name: "Juan G.", hand: "Drive", pts: 2400 }} b={{ init: "LÓ", name: "Pedro L.", hand: "Revés", pts: 2200 }}/>
          <ParejaCard n={2} pts={3800} pct={82} a={{ init: "SÁ", name: "David S.", hand: "Drive", pts: 2050 }} b={{ init: "MA", name: "Antonio M.", hand: "Drive", pts: 1750 }}/>
          <ParejaCard n={3} pts={3500} pct={76} a={{ init: "PÉ", name: "Carlos P.", hand: "Revés", pts: 1900 }} b={{ init: "RU", name: "Miguel R.", hand: "Revés", pts: 1600 }}/>
        </div>

        <div style={{ height: 28 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 14, borderTop: "1px solid var(--color-hair)" }}>
          <div>
            <Eyebrow dim style={{ fontSize: 10 }}>BANQUILLO · 0</Eyebrow>
            <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 6 }}>Todos los jugadores disponibles están alineados</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.20em", color: "var(--color-text-faint)" }}>Σ EQUIPO</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, color: "var(--color-text)", letterSpacing: "0.02em" }}>11900</div>
          </div>
        </div>

        <div style={{ height: 32 }}/>
      </div>
    </ScreenShell>
  );
}

function Pill({ children, on, icon }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "10px 14px", borderRadius: 999,
      background: on ? "rgba(0,223,130,0.10)" : "transparent",
      color: on ? "var(--color-accent)" : "var(--color-text-faint)",
      boxShadow: `inset 0 0 0 1px ${on ? "var(--color-accent-40)" : "var(--color-hair-strong)"}`,
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.20em",
      textTransform: "uppercase",
    }}>{children}</div>
  );
}

function ParejaCard({ n, label, pts, pct = 100, a, b, selected }) {
  return (
    <Card selected={selected} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <Tile variant={selected ? "accent" : "mute"} size={36} radius={9} style={{ fontSize: 12 }}>P{n}</Tile>
          {label && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", color: "var(--color-accent)", textTransform: "uppercase" }}>{label}</span>
          )}
          <div style={{ flex: 1, height: 3, background: "rgba(232,245,239,0.10)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: selected ? "var(--color-accent)" : "rgba(232,245,239,0.55)" }}/>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 28, color: selected ? "var(--color-accent)" : "var(--color-text)", letterSpacing: "-0.01em", lineHeight: 1 }}>{pts}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.20em", color: "var(--color-text-faint)", marginTop: 2 }}>PTS</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        {[a, b].map((p, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(232,245,239,0.02)", borderRadius: 12, padding: "10px 12px",
            boxShadow: "inset 0 0 0 1px var(--color-hair)",
          }}>
            <Tile variant="accent" size={36} radius={999}>{p.init}</Tile>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{p.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)", letterSpacing: "0.05em" }}>{p.hand} · {p.pts}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ───── Club (admin) ────────────────────────────────────────────────
function ClubScreen({ go, onTab }) {
  return (
    <ScreenShell hasTabBar tabActive="club" onTab={onTab} tabMode="club">
      <AmbientGlow pos="top" color="rgba(0,223,130,0.08)"/>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Tile variant="brand" size={48} radius={12}>T</Tile>
          <div style={{ flex: 1 }}>
            <Eyebrow>CLUB · ADMIN</Eyebrow>
            <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>TACTIUM Test Club</div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--color-accent)", boxShadow: "0 0 12px var(--color-accent)" }}/>
        </div>

        <div style={{ height: 22 }}/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: "16px 0", borderTop: "1px solid var(--color-hair)", borderBottom: "1px solid var(--color-hair)" }}>
          <Stat label="EQUIPOS" value="7"/>
          <div style={{ borderLeft: "1px solid var(--color-hair)", paddingLeft: 20 }}>
            <Stat label="FEDERACIÓN" value="FAP"/>
          </div>
        </div>

        <div style={{ marginTop: 18, color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.55 }}>
          Vista global del club. Las jornadas y los resultados los gestiona el capitán de cada equipo — desde aquí solo administras la estructura.
        </div>

        <div style={{ height: 24 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow dim>PRÓXIMAS JORNADAS</Eyebrow>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-faint)", fontSize: 11, letterSpacing: "0.10em" }}>07</span>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", marginTop: 12, paddingBottom: 8, marginLeft: -20, paddingLeft: 20, marginRight: -20 }}>
          {[
            { id: "J·02", date: "Sáb 16 May", time: "20:00", rival: "vs.CD Rivales", fed: "MOCK FAP MASC" },
            { id: "J·01", date: "Sáb 16 May", time: "20:00", rival: "vs.Padel Club Centro", fed: "MOCK FMP MASC" },
            { id: "J·01", date: "Sáb 16 May", time: "20:00", rival: "vs.Smash", fed: "MOCK FAP MASC" },
          ].map((j, i) => (
            <div key={i} style={{
              minWidth: 220, background: "var(--color-bg-card)", borderRadius: 18, padding: 16,
              boxShadow: "inset 0 0 0 1px var(--color-hair)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Eyebrow style={{ fontSize: 11 }}>{j.id}</Eyebrow>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--color-accent)" }}/>
              </div>
              <div style={{ marginTop: 16, fontWeight: 700, fontSize: 17 }}>{j.date}</div>
              <div style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 4, letterSpacing: "0.05em" }}>{j.time}</div>
              <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>{j.rival}</div>
              <div style={{ height: 1, background: "var(--color-hair)", margin: "14px 0 10px" }}/>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-faint)", letterSpacing: "0.20em" }}>{j.fed}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow dim>ÚLTIMOS RESULTADOS</Eyebrow>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-faint)", fontSize: 11, letterSpacing: "0.10em" }}>01</span>
        </div>
        <div style={{ marginTop: 12, background: "var(--color-bg-card)", borderRadius: 18, padding: 18, boxShadow: "inset 0 0 0 1.2px var(--color-accent-25)", maxWidth: 230 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center",
              color: "var(--color-accent)", boxShadow: "inset 0 0 0 1.2px var(--color-accent-40)",
              fontWeight: 700, fontSize: 14,
            }}>V</div>
            <Eyebrow style={{ fontSize: 11, color: "var(--color-text-faint)" }}>J·01</Eyebrow>
          </div>
          <div style={{ marginTop: 16, fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em", color: "var(--color-accent)" }}>
            5 <span style={{ color: "var(--color-text-faint)", fontWeight: 400 }}>·</span> <span style={{ color: "var(--color-text)" }}>0</span>
          </div>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 16 }}>vs.Jwjsjsjs</div>
          <div style={{ height: 1, background: "var(--color-hair)", margin: "14px 0 8px" }}/>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-faint)", letterSpacing: "0.20em" }}>MOCK FAP MASC</div>
        </div>

        <div style={{ height: 28 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow dim>EQUIPOS</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-faint)", fontSize: 11, letterSpacing: "0.10em" }}>07</span>
            <IconPill icon={IconPlus} accent/>
          </div>
        </div>
        <div style={{ marginTop: 12, background: "var(--color-bg-card)", borderRadius: 18, boxShadow: "inset 0 0 0 1px var(--color-hair)", overflow: "hidden" }}>
          {[
            ["Mock FAP Masc",    "masculino", "Grupo A"],
            ["Mock FMP Masc",    "masculino", "Grupo A"],
            ["Mock FCantP Fem",  "femenino",  "Grupo A"],
            ["Mock FMurP Fem",   "femenino",  "Grupo A"],
          ].map(([name, sex, group], i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14, padding: 14,
              borderBottom: i < 3 ? "1px solid var(--color-hair)" : "none",
            }}>
              <Tile variant="accent" size={44} radius={10}>2ª</Tile>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-faint)", letterSpacing: "0.05em", marginTop: 2 }}>2ª · {sex} · {group}</div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 2 }}>6 jugadores</div>
              </div>
              <IconPill icon={IconPencil} accent/>
            </div>
          ))}
        </div>

        <div style={{ height: 32 }}/>
      </div>
    </ScreenShell>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", color: "var(--color-text-faint)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 28, marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

// ───── Onboarding welcome ─────────────────────────────────────────
function OnboardingScreen({ go }) {
  return (
    <ScreenShell>
      <AmbientGlow pos="top" color="rgba(0,223,130,0.14)"/>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Tile variant="brand" size={42} radius={11}>T</Tile>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em" }}>TACTIUM</div>
          </div>
          <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-sans)", fontSize: 16 }}>Salir</span>
        </div>

        <div style={{ height: 28 }}/>
        <Eyebrow>BIENVENIDO</Eyebrow>
        <h1 style={{ marginTop: 8, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>¿Cómo vas a empezar?</h1>
        <p style={{ marginTop: 14, color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.55 }}>
          Puedes gestionar un único equipo o estructurar varios bajo un club.
        </p>

        <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 999, boxShadow: "inset 0 0 0 1px var(--color-accent-40)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-accent)" }}/>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-accent)", letterSpacing: "0.10em" }}>
            14 días gratis en cualquier plan · Cancela cuando quieras
          </span>
        </div>

        <div style={{ height: 22 }}/>
        <PlanCard tag="RÁPIDO" title="Equipo independiente" desc="Un solo equipo. Empieza rápido sin estructura adicional." price="4,99 €/mes" onClick={() => go("home")}/>
        <div style={{ height: 14 }}/>
        <PlanCard tag="ESCALABLE" title="Club con varios equipos" desc="Para clubes con múltiples equipos y capitanes." price="desde 11,99 €/mes" onClick={() => go("club")}/>

        <div style={{ height: 22 }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--color-text-faint)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-hair)" }}/>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.20em" }}>0</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-hair)" }}/>
        </div>

        <div style={{ height: 14 }}/>
        <Card style={{ padding: 18 }}>
          <Badge kind="accent">SIEMPRE GRATIS</Badge>
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 17 }}>Tengo un código de invitación</div>
          <div style={{ marginTop: 6, color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5 }}>
            Jugadores y capitanes invitados a un club acceden sin pagar nada.
          </div>
        </Card>
        <div style={{ height: 28 }}/>
      </div>
    </ScreenShell>
  );
}

function PlanCard({ tag, title, desc, price, onClick }) {
  return (
    <Card style={{ padding: 18, position: "relative" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Badge kind="accent">{tag}</Badge>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--color-accent)" }}/>
      </div>
      <div style={{ marginTop: 12, fontWeight: 700, fontSize: 20 }}>{title}</div>
      <div style={{ marginTop: 6, color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text-faint)", letterSpacing: "0.05em" }}>Tras prueba: {price}</div>
      <div style={{ height: 1, background: "var(--color-hair)", margin: "16px 0 12px" }}/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 15 }}>Empezar</span>
        <IconArrowR size={18} color="var(--color-accent)"/>
      </div>
    </Card>
  );
}

Object.assign(window, {
  HomeScreen, JornadaScreen, AlineacionScreen, ClubScreen, OnboardingScreen,
});
