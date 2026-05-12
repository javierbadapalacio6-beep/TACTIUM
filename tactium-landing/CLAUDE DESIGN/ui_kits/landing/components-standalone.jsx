// TACTIUM · Landing UI kit · components & sections

const { useState: useS2 } = React;

// ───── ICONS (Lucide) ─────────────────────────────────────────────
const L = (path) => function I({ size = 20, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>{path}</svg>
  );
};
const LArrow   = L(<><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>);
const LZap     = L(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
const LCheck   = L(<path d="M20 6 9 17l-5-5"/>);
const LBell    = L(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>);
const LShield  = L(<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>);
const LLayers  = L(<><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>);
const LUsers   = L(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/></>);
const LRefresh = L(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>);
const LBolt    = L(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
const LPlus    = L(<><path d="M12 5v14"/><path d="M5 12h14"/></>);
const LMinus   = L(<path d="M5 12h14"/>);
const LMail    = L(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>);
const LX       = L(<><path d="m18 6-12 12"/><path d="m6 6 12 12"/></>);

// ───── Eyebrow + section header ──────────────────────────────────
function LEyebrow({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      letterSpacing: "0.30em", textTransform: "uppercase",
      color: "var(--color-accent)", ...style,
    }}>{children}</div>
  );
}

function SectionHeader({ eyebrow, title, sub, align = "left", style }) {
  return (
    <div style={{ textAlign: align, maxWidth: 720, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0, ...style }}>
      {eyebrow && <LEyebrow style={{ marginBottom: 16 }}>{eyebrow}</LEyebrow>}
      <h2 style={{
        fontFamily: "var(--font-sans)", fontWeight: 800,
        fontSize: "clamp(32px, 4.4vw, 56px)", letterSpacing: "-0.02em", lineHeight: 1.05,
        margin: 0, color: "var(--color-text)",
      }}>{title}</h2>
      {sub && (
        <p style={{
          marginTop: 18, color: "var(--color-text-muted)",
          fontSize: 18, lineHeight: 1.55, maxWidth: 620,
          marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0,
        }}>{sub}</p>
      )}
    </div>
  );
}

// ───── Phone frame (matches brief: r42, dynamic island, glow) ─────
function PhoneFrame({ src, width = 280, tilt = 0, glow, style, floatDelay = 0 }) {
  const h = Math.round(width * 19.5 / 9);
  return (
    <div className="tk-phone" style={{
      position: "relative", width, height: h,
      rotate: `${tilt}deg`,
      transition: "rotate 460ms cubic-bezier(0.25,1,0.5,1)",
      animationDelay: `${floatDelay}s`,
      ...style,
    }}>
      {glow && (
        <div aria-hidden style={{
          position: "absolute", inset: -60, filter: "blur(80px)",
          background: "radial-gradient(circle, rgba(0,223,130,0.30), transparent 60%)",
          pointerEvents: "none",
        }}/>
      )}
      <div style={{
        position: "relative", width: "100%", height: "100%",
        borderRadius: 42, overflow: "hidden", background: "#000",
        boxShadow:
          "0 50px 100px -20px rgba(0,0,0,0.85)," +
          "inset 0 0 0 1.5px rgba(232,245,239,0.10)," +
          "inset 0 0 0 8px #0A0A0A",
      }}>
        {/* dynamic island */}
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          width: width * 0.30, height: 26, borderRadius: 99, background: "#000",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)", zIndex: 2,
        }}/>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
      </div>
    </div>
  );
}

// ───── Email waitlist form ───────────────────────────────────────
function WaitlistForm({ small }) {
  const fs = small ? 15 : 16;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{
          flex: "1 1 280px", minWidth: 260, display: "flex", alignItems: "center", gap: 12,
          background: "var(--color-bg-card)", padding: "0 18px", height: 60, borderRadius: 14,
          boxShadow: "inset 0 0 0 1px var(--color-hair-strong)",
        }}>
          <LMail size={18} color="var(--color-text-faint)"/>
          <input placeholder="email@dominio.com" style={{
            flex: 1, background: "transparent", border: 0, outline: 0,
            color: "var(--color-text)", fontSize: fs, fontFamily: "var(--font-sans)",
          }}/>
        </div>
        <button style={{
          height: 60, padding: "0 26px", borderRadius: 14, border: 0, cursor: "pointer",
          background: "var(--color-accent)", color: "var(--color-text-inverse)",
          fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: fs,
          display: "inline-flex", alignItems: "center", gap: 10,
          boxShadow: "0 14px 40px -8px rgba(0,223,130,0.55)",
        }}>Entrar en la lista <LArrow size={18} color="var(--color-text-inverse)"/></button>
      </div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.20em",
        color: "var(--color-text-faint)", textTransform: "uppercase",
      }}>14 días gratis · Cancela cuando quieras</div>
    </div>
  );
}

// ───── Header ────────────────────────────────────────────────────
function Header() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(3,15,15,0.72)",
      backdropFilter: "blur(12px) saturate(180%)",
      WebkitBackdropFilter: "blur(12px) saturate(180%)",
      borderBottom: "1px solid var(--color-hair)",
    }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: "var(--color-primary)",
            display: "grid", placeItems: "center", color: "var(--color-accent)",
            fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 20,
            boxShadow: "inset 0 0 0 1px var(--color-accent-40)",
          }}>T</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 18, letterSpacing: "0.04em" }}>TACTIUM</div>
        </div>
        <nav className="site-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["Producto","Clubs","Precios","FAQ"].map(l => (
            <a key={l} className="site-nav-link" href={"#" + l.toLowerCase()} style={{
              fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text-muted)",
            }}>{l}</a>
          ))}
          <button style={{
            padding: "10px 18px", borderRadius: 999, border: 0,
            background: "var(--color-accent)", color: "var(--color-text-inverse)",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            boxShadow: "0 8px 24px -6px rgba(0,223,130,0.40)",
          }}>Entrar →</button>
        </nav>
      </div>
    </header>
  );
}

// ───── Hero ──────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      {/* aurora */}
      <div aria-hidden style={{
        position: "absolute", top: -200, left: "20%", width: 600, height: 600,
        filter: "blur(120px)", background: "radial-gradient(circle, rgba(0,223,130,0.16), transparent 65%)",
        pointerEvents: "none",
      }}/>
      <div aria-hidden style={{
        position: "absolute", top: 60, right: -100, width: 500, height: 500,
        filter: "blur(120px)", background: "radial-gradient(circle, rgba(0,223,130,0.10), transparent 65%)",
        pointerEvents: "none",
      }}/>

      <div style={{
        position: "relative", maxWidth: 1152, margin: "0 auto",
        padding: "96px 24px 120px",
        display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center",
      }} className="hero-grid">
        {/* copy */}
        <div>
          <LEyebrow>PRE-LANZAMIENTO · 2026</LEyebrow>
          <h1 style={{
            marginTop: 22, fontFamily: "var(--font-sans)", fontWeight: 800,
            fontSize: "clamp(40px, 6.4vw, 76px)", lineHeight: 1.02, letterSpacing: "-0.025em",
            color: "var(--color-text)",
          }}>
            El sistema operativo<br/>
            del pádel <span style={{ color: "var(--color-accent)" }}>federado.</span>
          </h1>
          <p style={{
            marginTop: 22, color: "var(--color-text-muted)", fontSize: 19, lineHeight: 1.55, maxWidth: 540,
          }}>
            Alineaciones con auto-balance por puntos FEP, variantes ilimitadas por jornada y notificaciones a los jugadores convocados — en dos minutos.
          </p>
          <div style={{ marginTop: 32, maxWidth: 520 }}>
            <WaitlistForm/>
          </div>
          <div style={{
            marginTop: 36, display: "flex", gap: 28, color: "var(--color-text-faint)",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase",
            flexWrap: "wrap",
          }}>
            <span><span style={{ color: "var(--color-accent)" }}>●</span> FEP · FAP · FMP · LAPI · EPF</span>
            <span><span style={{ color: "var(--color-accent)" }}>●</span> iOS + Android</span>
          </div>
        </div>

        {/* phones */}
        <div className="hero-phones" style={{
          position: "relative", height: 640, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "absolute", left: "8%", top: 80, transform: "rotate(-9deg)" }}>
            <PhoneFrame src={window.__resources.splashImg} width={250} glow floatDelay={0}/>
          </div>
          <div style={{ position: "absolute", right: 0, top: 0, transform: "rotate(6deg)" }}>
            <PhoneFrame src={window.__resources.alineacionImg} width={300} glow floatDelay={1.4}/>
          </div>
          {/* floor reflection */}
          <div aria-hidden style={{
            position: "absolute", bottom: -40, left: "10%", right: "10%", height: 1,
            background: "linear-gradient(to right, transparent, rgba(0,223,130,0.40), transparent)",
          }}/>
        </div>
      </div>
    </section>
  );
}

// ───── AppPreview ────────────────────────────────────────────────
function AppPreview() {
  const steps = [
    { id: "01", title: "PROGRAMA", desc: "Crea la temporada, importa la plantilla y deja que TACTIUM ordene a los jugadores por puntos FEP.", img: window.__resources.jornadaPendienteImg },
    { id: "02", title: "ALINEA",   desc: "Auto-orden por puntos en cada pareja. Variantes ilimitadas — pruebas escenarios sin tocar la oficial.", img: window.__resources.alineacionImg },
    { id: "03", title: "CIERRA",   desc: "Confirmas el acta tras el partido. Resultados, sets y W.O. en un solo gesto.", img: window.__resources.jornadaResultadosImg },
  ];
  return (
    <section id="producto" style={{ padding: "120px 24px", position: "relative" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <SectionHeader
          eyebrow="UN FLUJO · TRES PASOS"
          title="Dos minutos antes del partido. Alineación lista."
          sub="No más PDFs, no más grupos de WhatsApp confusos. TACTIUM acompaña al capitán desde que se publica la jornada hasta que se cierra el acta."
        />

        <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }} className="three-col">
          {steps.map((s, i) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <div className="step-phone" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 540 }}>
                <PhoneFrame src={s.img} width={230} tilt={i === 1 ? 0 : (i === 0 ? -4 : 4)} glow={i === 1} floatDelay={i * 0.8}/>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, paddingTop: 18, borderTop: "1px solid var(--color-hair)" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
                  color: "var(--color-accent)", letterSpacing: "0.20em",
                }}>{s.id}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-faint)", letterSpacing: "0.20em" }}>·</span>
                <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em", margin: 0 }}>{s.title}</h3>
              </div>
              <p style={{ color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───── Federations marquee ───────────────────────────────────────
function FederationsMarquee() {
  const feds = ["FEP","FAP","FMP","FCantP","FMurP","FNP","LAPI","EPF BIZKAIA"];
  const loop = [...feds, ...feds];
  return (
    <section style={{
      padding: "48px 0", borderTop: "1px solid var(--color-hair)", borderBottom: "1px solid var(--color-hair)",
      overflow: "hidden", position: "relative", background: "var(--color-bg)",
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <LEyebrow>FEDERACIONES SOPORTADAS</LEyebrow>
      </div>
      <div style={{
        display: "flex", gap: 64, animation: "tactium-marquee 30s linear infinite",
        width: "max-content",
      }}>
        {loop.map((f, i) => (
          <div key={i} style={{
            fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18,
            letterSpacing: "0.25em", color: "var(--color-text-faint)",
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 64,
          }}>
            <span>{f}</span>
            <span style={{ color: "rgba(232,245,239,0.20)" }}>·</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes tactium-marquee { to { transform: translateX(-50%); } }`}</style>
    </section>
  );
}

// ───── ForWho · 2 cols ───────────────────────────────────────────
function ForWho() {
  return (
    <section style={{ padding: "120px 24px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <SectionHeader eyebrow="PARA QUIÉN ES TACTIUM" title="Dos perfiles, una herramienta."/>
        <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="two-col">
          {[
            { tag: "PERFIL 01", icon: LUsers, title: "Eres capitán", lead: "Gestionas 1 equipo, 8–30 jugadores.", bullets: ["Alineación oficial lista en 2 minutos", "Variantes ilimitadas sin perder la oficial", "Notificaciones push automáticas al equipo", "Validación sets / W.O. en el acta"] },
            { tag: "PERFIL 02", icon: LShield, title: "Eres club", lead: "Gestionas 3–25 equipos bajo un mismo club.", bullets: ["Vista global de jornadas y resultados", "Estructura por federación y categoría", "Delegas en capitanes con roles separados", "Importas plantillas desde el día uno"] },
          ].map(p => (
            <div key={p.tag} style={{
              background: "var(--color-bg-card)", borderRadius: 24, padding: 36,
              boxShadow: "var(--shadow-card-soft)", position: "relative", overflow: "hidden",
            }}>
              <div aria-hidden style={{
                position: "absolute", top: -80, right: -80, width: 220, height: 220,
                borderRadius: 999, background: "radial-gradient(circle, rgba(0,223,130,0.18), transparent 70%)",
                filter: "blur(40px)", pointerEvents: "none",
              }}/>
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: "rgba(0,223,130,0.10)",
                  display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px var(--color-accent-25)",
                }}>
                  <p.icon size={24} color="var(--color-accent)"/>
                </div>
                <LEyebrow style={{ marginTop: 22 }}>{p.tag}</LEyebrow>
                <h3 style={{ marginTop: 10, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{p.title}</h3>
                <p style={{ marginTop: 8, color: "var(--color-text-muted)", fontSize: 16 }}>{p.lead}</p>
                <ul style={{ marginTop: 24, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {p.bullets.map(b => (
                    <li key={b} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 8, display: "grid", placeItems: "center",
                        background: "rgba(0,223,130,0.10)", boxShadow: "inset 0 0 0 1px var(--color-accent-40)", flexShrink: 0, marginTop: 1,
                      }}><LCheck size={12} color="var(--color-accent)"/></span>
                      <span style={{ color: "var(--color-text)", fontSize: 15 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───── ForClubs deep-dive (split) ────────────────────────────────
function ForClubs() {
  return (
    <section id="clubs" style={{ padding: "120px 24px", position: "relative" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="two-col">
        <div>
          <LEyebrow>CLUB · ADMIN</LEyebrow>
          <h2 style={{ marginTop: 16, fontSize: "clamp(32px, 4.4vw, 56px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            Una estructura.<br/>Hasta 25 equipos.
          </h2>
          <p style={{ marginTop: 18, color: "var(--color-text-muted)", fontSize: 17, lineHeight: 1.55, maxWidth: 480 }}>
            El admin define la estructura — federación, categoría, grupo. Cada capitán gestiona su equipo. Tú ves todo lo que ocurre en tiempo real.
          </p>
          <ul style={{ marginTop: 28, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["Vista global", "Próximas jornadas y últimos resultados de todos los equipos."],
              ["Roles separados", "Cada capitán solo ve y edita su propio equipo."],
              ["Plantillas compartidas", "Jugadores en varios equipos del club sin duplicar fichas."],
            ].map(([k, v]) => (
              <li key={k} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "baseline", paddingBottom: 14, borderBottom: "1px solid var(--color-hair)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--color-accent)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{k}</span>
                <span style={{ color: "var(--color-text-muted)", fontSize: 15 }}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="club-phones" style={{ position: "relative", height: 640, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ position: "absolute", left: "10%", top: 20, transform: "rotate(-6deg)" }}>
            <PhoneFrame src={window.__resources.clubImg} width={250} glow floatDelay={0.3}/>
          </div>
          <div style={{ position: "absolute", right: "5%", bottom: 0, transform: "rotate(7deg)" }}>
            <PhoneFrame src={window.__resources.equiposClubImg} width={250} floatDelay={1.6}/>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───── Features bento (6 tiles) ──────────────────────────────────
function Features() {
  const items = [
    { icon: LBolt,    title: "Auto-orden FEP",       desc: "Ordena cada pareja por puntos respetando reglas de federación: FEP, FAP, FMP, FCantP, FMurP, FNP, LAPI, EPF Bizkaia." },
    { icon: LLayers,  title: "Variantes ilimitadas", desc: "Prueba escenarios sin tocar la oficial. La alineación válida siempre es la última que confirmas." },
    { icon: LBell,    title: "Push al equipo",       desc: "Hora, sede y pareja directamente al teléfono de cada convocado. Sin grupos paralelos." },
    { icon: LUsers,   title: "Multi-equipo",         desc: "Hasta 25 equipos bajo un mismo club, con roles separados de admin y capitán." },
    { icon: LRefresh, title: "Disponibilidad",       desc: "Cada jugador marca su disponibilidad. El capitán ve quién entra y quién falta antes de alinear." },
    { icon: LShield,  title: "Acta cerrada",         desc: "Resultados validados pareja a pareja. Sets, W.O., empates registrados con su estado." },
  ];
  return (
    <section id="features" style={{ padding: "120px 24px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <SectionHeader eyebrow="FEATURES" title="Pensado para una sola cosa: ganar el sábado." sub="Cero distracciones. Cada pantalla está diseñada para que el capitán llegue al partido sabiendo exactamente quién juega con quién y por qué."/>
        <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="bento">
          {items.map((it, i) => (
            <div key={it.title} style={{
              background: "var(--color-bg-card)", borderRadius: 20, padding: 28, position: "relative", overflow: "hidden",
              boxShadow: "inset 0 0 0 1px var(--color-hair)",
              gridColumn: i === 0 ? "span 2" : "span 1",
              minHeight: 220,
              transition: "transform 220ms cubic-bezier(0.25,1,0.5,1), box-shadow 220ms",
            }}>
              {i === 0 && (
                <div aria-hidden style={{
                  position: "absolute", top: -80, right: -80, width: 280, height: 280,
                  filter: "blur(60px)",
                  background: "radial-gradient(circle, rgba(0,223,130,0.16), transparent 70%)",
                  pointerEvents: "none",
                }}/>
              )}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", gap: 24 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: "rgba(0,223,130,0.08)",
                  display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px var(--color-accent-25)",
                }}>
                  <it.icon size={22} color="var(--color-accent)"/>
                </div>
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>{it.title}</h3>
                  <p style={{ marginTop: 10, color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.55 }}>{it.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───── Pricing ───────────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useS2(false);
  const tiers = [
    { name: "Capitán",       teams: "1 equipo",   m: 4.99,  a: 47.90 },
    { name: "Club Starter",  teams: "3 equipos",  m: 11.99, a: 115.10 },
    { name: "Club Pro",      teams: "10 equipos", m: 24.99, a: 239.90, featured: true },
    { name: "Club Elite",    teams: "25 equipos", m: 39.99, a: 383.90 },
  ];
  return (
    <section id="precios" style={{ padding: "120px 24px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <SectionHeader align="center" eyebrow="PLANES · 14 DÍAS DE PRUEBA" title="Solo el capitán paga." sub="Jugadores y capitanes invitados a un club acceden gratis. Cancela cuando quieras."/>
        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <div style={{
            display: "inline-flex", padding: 5, background: "var(--color-bg-card)",
            borderRadius: 999, boxShadow: "inset 0 0 0 1px var(--color-hair-strong)",
          }}>
            {[["Mensual", false],["Anual · −20%", true]].map(([lbl, v]) => (
              <button key={lbl} onClick={() => setAnnual(v)} style={{
                background: annual === v ? "var(--color-accent-10)" : "transparent",
                color: annual === v ? "var(--color-accent)" : "var(--color-text-muted)",
                boxShadow: annual === v ? "inset 0 0 0 1px var(--color-accent-40)" : "none",
                border: 0, padding: "10px 22px", borderRadius: 999, cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase",
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="pricing-grid">
          {tiers.map(t => (
            <div key={t.name} style={{
              background: t.featured ? "rgba(0,223,130,0.06)" : "var(--color-bg-card)",
              borderRadius: 22, padding: 26, position: "relative",
              boxShadow: t.featured ? "inset 0 0 0 1.5px var(--color-accent-55), 0 30px 60px -20px rgba(0,223,130,0.25)" : "inset 0 0 0 1px var(--color-hair)",
            }}>
              {t.featured && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "var(--color-accent)", color: "var(--color-text-inverse)",
                  fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 10,
                  letterSpacing: "0.25em", padding: "5px 12px", borderRadius: 999,
                }}>RECOMENDADO</div>
              )}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", color: "var(--color-accent)", textTransform: "uppercase" }}>{t.teams}</div>
              <div style={{ marginTop: 10, fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 24 }}>{t.name}</div>
              <div style={{ marginTop: 22, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em", color: "var(--color-text)" }}>
                  {(annual ? (t.a/12) : t.m).toFixed(2).replace(".", ",")}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-faint)", letterSpacing: "0.15em" }}>€ / mes</span>
              </div>
              {annual && (
                <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)", letterSpacing: "0.10em" }}>
                  {t.a.toFixed(2).replace(".", ",")} € / año
                </div>
              )}
              <button style={{
                marginTop: 24, width: "100%", padding: "14px 16px", borderRadius: 999,
                border: 0, cursor: "pointer", fontWeight: 700, fontSize: 14,
                background: t.featured ? "var(--color-accent)" : "transparent",
                color: t.featured ? "var(--color-text-inverse)" : "var(--color-text)",
                boxShadow: t.featured ? "0 10px 30px -8px rgba(0,223,130,0.55)" : "inset 0 0 0 1px var(--color-hair-strong)",
                fontFamily: "var(--font-sans)",
              }}>Empezar gratis</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───── FAQ ───────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useS2(0);
  const qs = [
    ["¿Qué federaciones soporta TACTIUM?", "FEP, FAP, FMP, FCantP, FMurP, FNP, LAPI y EPF Bizkaia. El auto-orden respeta las reglas de cada federación al ordenar las parejas por puntos."],
    ["¿Cómo funciona el periodo de prueba?", "14 días gratis al crear tu primer equipo. Sin tarjeta, sin compromiso. Si decides no continuar, tu cuenta queda en modo lectura."],
    ["¿Pueden mis jugadores entrar gratis?", "Sí. Solo el capitán paga su plan. Los jugadores invitados acceden con un código y no pagan nada."],
    ["¿Puedo cambiar entre planes?", "Sí, en cualquier momento. Si subes de plan, se prorratea. Si bajas, el cambio aplica al final del ciclo."],
    ["¿Hay app de Android?", "Sí. iOS y Android desde el día uno. Ambas comparten la misma cuenta."],
  ];
  return (
    <section id="faq" style={{ padding: "120px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <SectionHeader align="center" eyebrow="FAQ" title="Preguntas frecuentes"/>
        <div style={{ marginTop: 56, borderTop: "1px solid var(--color-hair)" }}>
          {qs.map(([q, a], i) => (
            <div key={q} style={{ borderBottom: "1px solid var(--color-hair)" }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24,
                padding: "26px 0", background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
                color: "var(--color-text)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 19,
              }}>
                <span>{q}</span>
                <span style={{
                  width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center",
                  background: open === i ? "var(--color-accent-10)" : "transparent",
                  boxShadow: `inset 0 0 0 1px ${open === i ? "var(--color-accent-40)" : "var(--color-hair-strong)"}`,
                  flexShrink: 0,
                }}>{open === i ? <LMinus size={16} color="var(--color-accent)"/> : <LPlus size={16} color="var(--color-text-muted)"/>}</span>
              </button>
              {open === i && (
                <div style={{ paddingBottom: 26, color: "var(--color-text-muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 720 }}>{a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───── Final CTA + footer ────────────────────────────────────────
function FinalCta() {
  return (
    <section style={{ padding: "120px 24px", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 100%, rgba(0,223,130,0.15), transparent 60%)",
      }}/>
      <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <LEyebrow style={{ display: "block" }}>WAITLIST · 2026</LEyebrow>
        <h2 style={{
          marginTop: 20, fontFamily: "var(--font-sans)", fontWeight: 800,
          fontSize: "clamp(40px, 5.6vw, 72px)", letterSpacing: "-0.025em", lineHeight: 1.02,
        }}>
          Tu próxima alineación,<br/>
          <span style={{ color: "var(--color-accent)" }}>en dos minutos.</span>
        </h2>
        <p style={{ marginTop: 18, color: "var(--color-text-muted)", fontSize: 18, lineHeight: 1.55 }}>
          Únete a la waitlist. Los primeros 500 capitanes entran con un mes extra de prueba.
        </p>
        <div style={{ marginTop: 36, maxWidth: 520, marginInline: "auto" }}>
          <WaitlistForm/>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "48px 24px", borderTop: "1px solid var(--color-hair)" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "var(--color-primary)",
            display: "grid", placeItems: "center", color: "var(--color-accent)",
            fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 16,
            boxShadow: "inset 0 0 0 1px var(--color-accent-40)",
          }}>T</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", color: "var(--color-text-faint)", textTransform: "uppercase" }}>
            TACTIUM · 2026 · Hecho en España
          </div>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {["Términos","Privacidad","Contacto","X / Twitter"].map(l => (
            <a key={l} href="#" style={{
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-text-muted)",
            }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ───── Interactive in-page demo (real app screens inside iPhone) ─
function InteractiveDemo() {
  const [route, setRoute] = useS2("home");
  const FLOW = [
    { id: "home",              label: "Home" },
    { id: "jornada",           label: "Jornada" },
    { id: "alineacion",        label: "Alineación" },
    { id: "jornada-validated", label: "Resultado" },
    { id: "club",              label: "Club" },
  ];
  const go = (id) => setRoute(id);
  const renderScreen = () => {
    switch(route) {
      case "home":              return <HomeScreen go={go} onTab={() => {}}/>;
      case "jornada":           return <JornadaScreen go={go} state="pending"/>;
      case "alineacion":        return <AlineacionScreen go={go}/>;
      case "jornada-validated": return <JornadaScreen go={go} state="validated"/>;
      case "club":              return <ClubScreen go={go} onTab={() => {}}/>;
      default: return null;
    }
  };

  return (
    <section id="demo" style={{ padding: "120px 24px", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 800px 600px at 50% 30%, rgba(0,223,130,0.10), transparent 60%)",
      }}/>
      <div style={{ position: "relative", maxWidth: 1152, margin: "0 auto", textAlign: "center" }}>
        <SectionHeader align="center" eyebrow="PRUÉBALO AHORA · DEMO EN VIVO" title="La app real. Sin descargar nada." sub="Cambia entre pantallas, monta una alineación, valida el acta. Es la misma interfaz que tendrás en tu móvil."/>

        {/* Pill nav */}
        <div style={{
          marginTop: 40, display: "inline-flex", flexWrap: "wrap", justifyContent: "center", gap: 6,
          padding: 6, background: "var(--color-bg-card)", borderRadius: 999,
          boxShadow: "inset 0 0 0 1px var(--color-hair-strong)",
        }}>
          {FLOW.map(f => (
            <button key={f.id} onClick={() => setRoute(f.id)} style={{
              background: route === f.id ? "var(--color-accent-10)" : "transparent",
              color: route === f.id ? "var(--color-accent)" : "var(--color-text-muted)",
              boxShadow: route === f.id ? "inset 0 0 0 1px var(--color-accent-40)" : "none",
              border: 0, padding: "10px 16px", borderRadius: 999, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.20em", textTransform: "uppercase",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Device stage */}
        <div className="demo-stage" style={{ marginTop: 56, display: "flex", justifyContent: "center" }}>
          <div className="demo-device" style={{
            transition: "transform 380ms cubic-bezier(0.25,1,0.5,1)",
            filter: "drop-shadow(0 60px 80px rgba(0,0,0,0.6)) drop-shadow(0 0 80px rgba(0,223,130,0.20))",
          }}>
            <IOSDevice dark width={390} height={844}>
              {renderScreen()}
            </IOSDevice>
          </div>
        </div>

        <div style={{
          marginTop: 32, display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 16px", borderRadius: 999,
          boxShadow: "inset 0 0 0 1px var(--color-hair-strong)",
          color: "var(--color-text-faint)", fontFamily: "var(--font-mono)",
          fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-accent)", boxShadow: "0 0 8px var(--color-accent)" }}/>
          Datos de muestra · no se envía nada
        </div>
      </div>
    </section>
  );
}

Object.assign(window, {
  Header, Hero, AppPreview, FederationsMarquee, ForWho, ForClubs, Features,
  Pricing, FAQ, FinalCta, Footer, InteractiveDemo,
});
