// TACTIUM — Login screen (con email + Apple + Google)

function ScreenLogin({ onContinue }) {
  const [mode, setMode] = React.useState('choice'); // 'choice' | 'email'
  const [tab, setTab]   = React.useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = React.useState('');
  const [pass, setPass]   = React.useState('');
  const [name, setName]   = React.useState('');
  const [showPass, setShowPass] = React.useState(false);

  const valid = mode === 'email'
    ? (tab === 'signin'
        ? email.includes('@') && pass.length >= 6
        : email.includes('@') && pass.length >= 6 && name.trim().length >= 2)
    : true;

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: TACTIUM.bg,
      color: TACTIUM.text, fontFamily: FONT,
      display: 'flex', flexDirection: 'column',
      paddingTop: 64, overflow: 'hidden',
    }}>
      {/* Ambient gradient glow */}
      <div style={{
        position: 'absolute', top: -120, left: -80, right: -80, height: 460,
        background: `radial-gradient(60% 70% at 50% 50%, ${TACTIUM.primary}55, transparent 70%)`,
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: '20%', width: 360, height: 360,
        background: `radial-gradient(circle, ${TACTIUM.accent}22, transparent 70%)`,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {mode === 'choice' ? (
        <ChoiceView onContinue={onContinue} onEmail={() => setMode('email')} />
      ) : (
        <EmailView
          tab={tab} setTab={setTab}
          email={email} setEmail={setEmail}
          pass={pass} setPass={setPass}
          name={name} setName={setName}
          showPass={showPass} setShowPass={setShowPass}
          valid={valid}
          onBack={() => setMode('choice')}
          onSubmit={onContinue}
        />
      )}
    </div>
  );
}

function ChoiceView({ onContinue, onEmail }) {
  return (
    <React.Fragment>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    position: 'relative', zIndex: 2, gap: 22 }}>
        <TactiumMark size={104} gradient />
        <div style={{
          fontSize: 44, fontWeight: 400, letterSpacing: 8,
          lineHeight: 1, textAlign: 'center', paddingLeft: 8,
        }}>TACTIUM</div>
        <div style={{
          fontSize: 12, letterSpacing: 5, color: TACTIUM.accent,
          textTransform: 'uppercase', fontWeight: 500,
        }}>Create · Analyze · Elevate</div>
        <div style={{
          fontSize: 15, color: TACTIUM.textMuted, textAlign: 'center',
          maxWidth: 260, lineHeight: 1.4, marginTop: 8,
        }}>El laboratorio de alineaciones inteligentes para pádel.</div>
      </div>

      <div style={{ padding: '0 24px 36px', display: 'flex', flexDirection: 'column',
                    gap: 10, position: 'relative', zIndex: 2 }}>
        <button onClick={onContinue} style={btnPrimaryWhite}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="#000">
            <path d="M14.5 9.5c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-2-.9-3.2-.9c-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 9.9.8 1.2 1.8 2.5 3.1 2.5s1.7-.8 3.2-.8 1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.7-1-2.7-4.2zM12.1 2.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/>
          </svg>
          Continuar con Apple
        </button>

        <button onClick={onContinue} style={btnGhost}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M16.5 9.2c0-.6-.1-1.1-.2-1.7H9v3.2h4.2c-.2 1-.7 1.8-1.5 2.4v2h2.5c1.5-1.4 2.3-3.4 2.3-5.9z" fill="#4285F4"/>
            <path d="M9 17c2.1 0 3.8-.7 5.1-1.9l-2.5-2c-.7.5-1.5.7-2.6.7-2 0-3.7-1.4-4.3-3.2H2.1v2.1C3.4 15.4 6 17 9 17z" fill="#34A853"/>
            <path d="M4.7 10.6c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6V5.3H2.1C1.4 6.4 1 7.7 1 9s.4 2.6 1.1 3.7l2.6-2.1z" fill="#FBBC05"/>
            <path d="M9 4.2c1.1 0 2.1.4 2.9 1.1l2.2-2.2C12.8 1.9 11.1 1 9 1 6 1 3.4 2.6 2.1 5.3l2.6 2.1C5.3 5.6 7 4.2 9 4.2z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: TACTIUM.hair }} />
          <div style={{ fontSize: 10, color: TACTIUM.textFaint, letterSpacing: 2,
                        fontFamily: MONO }}>O</div>
          <div style={{ flex: 1, height: 1, background: TACTIUM.hair }} />
        </div>

        <button onClick={onEmail} style={{...btnGhost, color: TACTIUM.accent,
            border: `1px solid ${TACTIUM.accent}40`,
            background: `${TACTIUM.accent}08`}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke={TACTIUM.accent} strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M3 7l9 6 9-6"/>
          </svg>
          Continuar con email
        </button>

        <div style={{
          textAlign: 'center', marginTop: 12,
          fontSize: 12, color: TACTIUM.textFaint, lineHeight: 1.5,
        }}>
          Al continuar aceptas los Términos<br/>y la Política de Privacidad.
        </div>
      </div>
    </React.Fragment>
  );
}

function EmailView({ tab, setTab, email, setEmail, pass, setPass, name, setName,
                     showPass, setShowPass, valid, onBack, onSubmit }) {
  const isSignup = tab === 'signup';
  return (
    <React.Fragment>
      {/* Top nav */}
      <div style={{ padding: '0 20px', position: 'relative', zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 12,
          border: `1px solid ${TACTIUM.hairStrong}`, background: TACTIUM.bgCard,
          color: TACTIUM.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: FONT, fontSize: 14, fontWeight: 500,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6"/>
          </svg>
          Atrás
        </button>
        <TactiumMark size={32} gradient />
      </div>

      {/* Header */}
      <div style={{ padding: '28px 24px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: TACTIUM.accent,
                      textTransform: 'uppercase', fontWeight: 500, marginBottom: 10,
                      fontFamily: MONO }}>
          {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
        </div>
        <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -0.6, lineHeight: 1.05 }}>
          {isSignup ? <>Únete a <span style={{ color: TACTIUM.accent }}>TACTIUM</span></>
                    : <>Bienvenido<br/>de vuelta</>}
        </div>
        <div style={{ fontSize: 14, color: TACTIUM.textMuted, marginTop: 10, lineHeight: 1.5 }}>
          {isSignup ? 'Configura tu cuenta y empieza a gestionar tu equipo.'
                    : 'Accede a tu equipo y planifica la próxima jornada.'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '24px 20px 0', position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'flex', gap: 4, padding: 4,
          background: TACTIUM.bgCard, borderRadius: 12,
          border: `1px solid ${TACTIUM.hair}`,
        }}>
          {[['signin','Iniciar sesión'], ['signup','Crear cuenta']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, height: 36, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: tab === k ? TACTIUM.bgRaised : 'transparent',
              color: tab === k ? TACTIUM.text : TACTIUM.textMuted,
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ padding: '20px 20px 0', position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto' }}>
        {isSignup && (
          <Field label="Nombre">
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Carlos Pérez" autoFocus style={inputAuthStyle} />
          </Field>
        )}
        <Field label="Email">
          <input value={email} onChange={e=>setEmail(e.target.value)}
            type="email" placeholder="tu@email.com" autoFocus={!isSignup}
            style={inputAuthStyle} />
        </Field>
        <Field label="Contraseña" hint={!isSignup && (
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TACTIUM.accent, fontFamily: FONT, fontSize: 12, fontWeight: 500,
            padding: 0,
          }}>¿Olvidaste?</button>
        )}>
          <div style={{ position: 'relative' }}>
            <input value={pass} onChange={e=>setPass(e.target.value)}
              type={showPass ? 'text' : 'password'}
              placeholder={isSignup ? 'Mínimo 6 caracteres' : '••••••••'}
              style={{...inputAuthStyle, paddingRight: 44}} />
            <button onClick={() => setShowPass(!showPass)} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 8, color: TACTIUM.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="3" y1="3" x2="21" y2="21" stroke={TACTIUM.accent} strokeWidth="1.6"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </Field>

        {isSignup && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 6,
                        fontSize: 12, color: TACTIUM.textMuted, lineHeight: 1.5 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, marginTop: 1,
                          background: `${TACTIUM.accent}15`, border: `1px solid ${TACTIUM.accent}50`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke={TACTIUM.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>Acepto los <span style={{ color: TACTIUM.accent }}>Términos</span> y la <span style={{ color: TACTIUM.accent }}>Política de Privacidad</span>.</div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 20px 36px', position: 'relative', zIndex: 2,
                    display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button disabled={!valid} onClick={onSubmit} style={{
          height: 54, borderRadius: 14, border: 'none',
          cursor: valid ? 'pointer' : 'default',
          background: TACTIUM.accent, color: '#000',
          fontFamily: FONT, fontWeight: 500, fontSize: 16,
          boxShadow: valid ? `0 12px 30px ${TACTIUM.accent}40` : 'none',
          opacity: valid ? 1 : 0.4,
        }}>
          {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
        <div style={{ textAlign: 'center', fontSize: 13, color: TACTIUM.textMuted }}>
          {isSignup ? '¿Ya tienes cuenta?' : '¿Nuevo aquí?'}{' '}
          <button onClick={() => setTab(isSignup ? 'signin' : 'signup')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TACTIUM.accent, fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: 0,
          }}>{isSignup ? 'Inicia sesión' : 'Crea una cuenta'}</button>
        </div>
      </div>
    </React.Fragment>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: TACTIUM.textFaint,
                      textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO }}>{label}</div>
        {hint}
      </div>
      {children}
    </div>
  );
}

const inputAuthStyle = {
  width: '100%', height: 50, padding: '0 14px', borderRadius: 12,
  background: TACTIUM.bgCard, border: `1px solid ${TACTIUM.hairStrong}`,
  color: TACTIUM.text, fontFamily: 'Satoshi', fontSize: 15, fontWeight: 400,
  outline: 'none', boxSizing: 'border-box',
};

const btnPrimaryWhite = {
  height: 54, borderRadius: 14, border: 'none', cursor: 'pointer',
  background: '#fff', color: '#000',
  fontFamily: 'Satoshi', fontWeight: 500, fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
};

const btnGhost = {
  height: 54, borderRadius: 14, border: `1px solid ${TACTIUM.hairStrong}`, cursor: 'pointer',
  background: 'transparent', color: TACTIUM.text,
  fontFamily: 'Satoshi', fontWeight: 500, fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
};

window.ScreenLogin = ScreenLogin;
