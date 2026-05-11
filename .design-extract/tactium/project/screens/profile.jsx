// TACTIUM — Perfil

function ScreenProfile({ onBack, onLogout }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -120, left: -50, right: -50, height: 320,
        background: `radial-gradient(60% 70% at 50% 50%, ${TACTIUM.primary}40, transparent 70%)`,
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      {/* nav */}
      <div style={{ paddingTop: 60, padding: '60px 20px 0', position: 'relative', zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.hairStrong}`, background: TACTIUM.bgCard,
          color: TACTIUM.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 14, fontWeight: 500,
        }}><IconBack size={16} /> Inicio</button>
        <button style={{
          height: 36, padding: '0 14px', borderRadius: 12,
          border: `1px solid ${TACTIUM.hairStrong}`, background: TACTIUM.bgCard,
          color: TACTIUM.text, cursor: 'pointer',
          fontFamily: FONT, fontSize: 13, fontWeight: 500,
        }}>Editar</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 30px',
                    position: 'relative', zIndex: 2 }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column',
                      alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%',
            background: `linear-gradient(135deg, ${TACTIUM.primary}, ${TACTIUM.bgCard2})`,
            border: `2px solid ${TACTIUM.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT, fontSize: 32, fontWeight: 500, color: TACTIUM.accent,
            letterSpacing: -0.5, marginBottom: 14,
            boxShadow: `0 0 30px ${TACTIUM.accent}25`,
          }}>CP</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.4 }}>Capitán</div>
          <div style={{ fontSize: 13, color: TACTIUM.textMuted, marginTop: 4 }}>capitan@padelclub.es</div>
          <div style={{
            marginTop: 12, padding: '4px 10px', borderRadius: 9999,
            background: `${TACTIUM.accent}15`, color: TACTIUM.accent,
            fontFamily: MONO, fontSize: 11, letterSpacing: 1, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <NeonDot size={5} />
            ROL · ADMIN
          </div>
        </div>

        {/* Equipo actual */}
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.textFaint,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>Equipo actual</div>

        <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                      border: `1px solid ${TACTIUM.hair}`, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 14 }}>
          <TactiumMark size={42} gradient />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.1 }}>Padel Club</div>
            <div style={{ fontSize: 12, color: TACTIUM.textMuted, marginTop: 2 }}>
              2ª categoría · Temporada 25/26
            </div>
          </div>
          <button style={{
            height: 28, padding: '0 10px', borderRadius: 8,
            background: 'transparent', border: `1px solid ${TACTIUM.hairStrong}`,
            color: TACTIUM.textMuted, fontFamily: FONT, fontSize: 11, fontWeight: 500,
            cursor: 'pointer',
          }}>Cambiar</button>
        </div>

        {/* Stats highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <ProfileStat label="Jornadas" value="07" />
          <ProfileStat label="Alineac." value="12" />
          <ProfileStat label="Tasa V" value="67%" highlight />
        </div>

        {/* Cuenta */}
        <div style={{ marginTop: 28, fontSize: 11, letterSpacing: 3, color: TACTIUM.textFaint,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>Cuenta</div>

        <SettingsList items={[
          { label: 'Notificaciones', detail: 'Activadas' },
          { label: 'Apariencia', detail: 'Oscuro' },
          { label: 'Idioma', detail: 'Español' },
          { label: 'Privacidad', detail: '' },
        ]} />

        <div style={{ marginTop: 20, fontSize: 11, letterSpacing: 3, color: TACTIUM.textFaint,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 12 }}>Soporte</div>
        <SettingsList items={[
          { label: 'Centro de ayuda', detail: '' },
          { label: 'Términos y privacidad', detail: '' },
          { label: 'Versión', detail: '1.0.0', noChevron: true },
        ]} />

        {/* Logout */}
        <button onClick={onLogout} style={{
          marginTop: 24, width: '100%', height: 52, borderRadius: 14, cursor: 'pointer',
          background: 'transparent',
          border: `1px solid ${TACTIUM.err}40`,
          color: TACTIUM.err, fontFamily: FONT, fontSize: 15, fontWeight: 500,
          letterSpacing: -0.1,
        }}>Cerrar sesión</button>

        <div style={{ textAlign: 'center', marginTop: 20, fontFamily: MONO,
                      fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5 }}>
          TACTIUM · CREATE · ANALYZE · ELEVATE
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value, highlight }) {
  return (
    <div style={{
      background: TACTIUM.bgCard, borderRadius: 12,
      border: `1px solid ${TACTIUM.hair}`,
      padding: '10px 0', textAlign: 'center',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500,
                    color: highlight ? TACTIUM.accent : TACTIUM.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 1.5,
                    textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function SettingsList({ items }) {
  return (
    <div style={{ background: TACTIUM.bgCard, borderRadius: 16,
                  border: `1px solid ${TACTIUM.hair}`, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={it.label} style={{
          display: 'flex', alignItems: 'center', padding: '14px 16px',
          borderBottom: i < items.length - 1 ? `1px solid ${TACTIUM.hair}` : 'none',
          cursor: it.noChevron ? 'default' : 'pointer',
        }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500,
                        color: TACTIUM.text, letterSpacing: -0.1 }}>{it.label}</div>
          {it.detail && (
            <div style={{ fontSize: 13, color: TACTIUM.textMuted, marginRight: 8 }}>{it.detail}</div>
          )}
          {!it.noChevron && <IconChevron color={TACTIUM.textFaint} />}
        </div>
      ))}
    </div>
  );
}

window.ScreenProfile = ScreenProfile;
