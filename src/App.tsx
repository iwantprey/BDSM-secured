import { useState } from 'react'
import { useEffect } from 'react'
import ResidentView from './views/ResidentView'
import StaffView from './views/StaffView'
import AdminView from './views/AdminView'
import { confirmPasswordReset, getCurrentUser, getLoginCaptcha, login, logout, registerResident, requestPasswordReset, type AuthUser } from './services/api'

type Role = 'resident' | 'staff' | 'admin'

const roleConfig = {
  resident: {
    label: 'Resident',
    description: 'Submit drainage issues in your area and track your report status in real time.',
    accent: '#2ec4b6',
    icon: '🏠',
    features: ['Submit Drainage Report', 'Track My Reports', 'View Report Status'],
  },
  staff: {
    label: 'Barangay Staff',
    description: 'Verify incoming reports and update the maintenance progress for each case.',
    accent: '#f59e0b',
    icon: '👷',
    features: ['Manage Reports', 'Schedule Inspection', 'Assign & Record Maintenance'],
  },
  admin: {
    label: 'Administrator',
    description: 'Access the full dashboard, analytics, and manage all system users.',
    accent: '#8b5cf6',
    icon: '⚙️',
    features: ['Manage Users & Staff', 'Dashboard & Analytics', 'Generate Reports'],
  },
}

const navItems: Record<Role, { id: string; label: string; icon: string }[]> = {
  resident: [
    { id: 'submit', label: 'Submit Report', icon: '＋' },
    { id: 'track', label: 'Track My Reports', icon: '📂' },
    { id: 'status', label: 'View Report Status', icon: '📡' },
  ],
  staff: [
    { id: 'submitted', label: 'Submitted Reports', icon: '📋' },
    { id: 'inspect', label: 'Schedule Inspection', icon: '🔍' },
    { id: 'update', label: 'Update Status', icon: '↺' },
    { id: 'maintenance', label: 'Record Maintenance', icon: '🔧' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: '▦' },
    { id: 'users', label: 'Manage Users', icon: '◉' },
    { id: 'staff-accounts', label: 'Staff Accounts', icon: '👷' },
    { id: 'reports', label: 'Generate Reports', icon: '📄' },
  ],
}

const diagramNavItems: Record<Role, { id: string; label: string; icon: string }[]> = {
  resident: [
    { id: 'submit', label: 'Submit Drainage Report', icon: '+' },
    { id: 'track', label: 'Track My Reports', icon: 'R' },
    { id: 'status', label: 'View Report Status', icon: 'S' },
    { id: 'settings', label: 'Settings', icon: 'G' },
  ],
  staff: [
    { id: 'submitted', label: 'Manage Reports', icon: 'R' },
    { id: 'inspect', label: 'Schedule Inspection', icon: 'I' },
    { id: 'update', label: 'Update Maintenance Status', icon: 'U' },
    { id: 'maintenance', label: 'Assign & Record Maintenance', icon: 'M' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: 'D' },
    { id: 'users', label: 'Manage Users', icon: 'U' },
    { id: 'staff-accounts', label: 'Manage Staff Accounts', icon: 'S' },
    { id: 'reports', label: 'Generate Reports', icon: 'G' },
  ],
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [activeNav, setActiveNav] = useState<string>('')

  useEffect(() => {
    void getCurrentUser().then((user) => {
      setCurrentUser(user)
      setRole(user.role)
      setActiveNav(diagramNavItems[user.role][0].id)
    }).catch(() => {}).finally(() => setSessionLoaded(true))
  }, [])

  if (!sessionLoaded) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#5a7199' }}>Loading account…</div>
  if (!currentUser) return <LoginScreen role={null} onLogin={(user) => { setCurrentUser(user); setRole(user.role); setActiveNav(diagramNavItems[user.role][0].id) }} />

  return (
    <AppShell role={currentUser.role} userName={currentUser.name} activeNav={activeNav} onNavChange={setActiveNav} onLogout={() => { void logout().finally(() => { setCurrentUser(null); setRole(null) }) }}>
      {currentUser.role === 'resident' && <ResidentView activeTab={activeNav} user={currentUser} onUserUpdated={setCurrentUser} />}
      {currentUser.role === 'staff' && <StaffView activeTab={activeNav} user={currentUser} />}
      {currentUser.role === 'admin' && <AdminView activeTab={activeNav} />}
    </AppShell>
  )
}

function LoginScreen({ role, onLogin }: { role: Role | null; onLogin: (user: AuthUser) => void }) {
  const cfg = role ? roleConfig[role] : roleConfig.resident
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [registered, setRegistered] = useState(false)
  const [resetRequested, setResetRequested] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [captcha, setCaptcha] = useState<{ id: string; question: string } | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetComplete(false)
    if (mode === 'register' && !termsAccepted) {
      setError('Please read and accept the privacy notice and terms to create an account.')
      return
    }
    if (mode === 'register') {
      const normalizedName = name.trim()
      const normalizedEmail = email.trim().toLowerCase()
      if (!address.trim()) {
        setError('Home address: this field is required.')
        return
      }
      if (normalizedName.length < 2 || normalizedName.length > 50 || !/^[\p{L}\p{M} .'-]+$/u.test(normalizedName)) {
        setError('Full name: enter 2–50 characters using letters, spaces, hyphens, apostrophes, or periods.')
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Email address: enter a valid email address.')
        return
      }
    }
    if ((mode === 'register' || mode === 'reset') && (password.length < 6 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))) {
      setError('Password: use 6–72 characters with at least one uppercase letter, one lowercase letter, and one number.')
      return
    }
    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError('Confirm password: passwords do not match.')
      return
    }
    if (mode === 'reset' && !/^\d{6}$/.test(otp)) {
      setError('Verification code: enter the six-digit code sent to your email.')
      return
    }
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email)
        setResetRequested(true)
        setMode('reset')
        return
      }
      if (mode === 'reset') {
        await confirmPasswordReset({ email, otp, password, confirmPassword })
        setRegistered(false)
        setResetRequested(false)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setOtp('')
        setResetComplete(true)
        return
      }
      if (mode === 'register') {
        await registerResident({ name: name.trim(), email: email.trim().toLowerCase(), password, confirmPassword, role: 'resident', address: address.trim(), phone })
        setRegistered(true)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        return
      }
      const user = await login(email.trim().toLowerCase(), password, captcha ? { id: captcha.id, answer: captchaAnswer } : undefined)
      if (role && user.role !== role) {
        await logout()
        throw new Error(`That account belongs to the ${roleConfig[user.role].label} portal.`)
      }
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
      if (mode === 'login' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        try {
          const challenge = await getLoginCaptcha(email.trim().toLowerCase())
          if (challenge.required) {
            setCaptcha({ id: challenge.id, question: challenge.question })
            setCaptchaAnswer('')
          } else {
            setCaptcha(null)
            setCaptchaAnswer('')
          }
        } catch {
          setCaptcha(null)
        }
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#060f24', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 0%, ${cfg.accent}22 0%, transparent 70%)` }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 18, padding: '2rem', boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${cfg.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{cfg.icon}</div>
          <div><div style={{ fontSize: '0.75rem', color: '#8eadd4', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{role ? 'Website System' : 'Unified Account Portal'}</div><div style={{ fontSize: '1.1rem', color: '#0a1f3d', fontWeight: 700 }}>Barangay DMMS {mode === 'login' ? 'Login' : mode === 'register' ? 'Registration' : mode === 'forgot' ? 'Forgot Password' : 'Reset Password'}</div></div>
        </div>
        {(mode === 'login' || mode === 'register') && <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', backgroundColor: '#f0f4fa', borderRadius: 8, marginBottom: '1.5rem' }}>
          {(['login', 'register'] as const).map((tab) => <button key={tab} type="button" onClick={() => { setMode(tab); setRegistered(false); setError('') }} style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: 6, backgroundColor: mode === tab ? '#ffffff' : 'transparent', color: mode === tab ? '#0a1f3d' : '#5a7199', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{tab}</button>)}
        </div>}
        {registered && <div style={{ padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: 8, backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.8125rem' }}>Registration submitted. You can now log in.</div>}
        {resetComplete && <div style={{ padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: 8, backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.8125rem' }}>Password reset successfully. You can now log in.</div>}
        {resetRequested && mode === 'reset' && <div style={{ padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: 8, backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.8125rem' }}>If an active account uses this email, a six-digit reset code has been sent. The code expires in 10 minutes.</div>}
        {error && <div role="alert" style={{ padding: '0.625rem 0.75rem', marginBottom: '1rem', borderRadius: 8, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.8125rem' }}>{error}</div>}
        <h1 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: '1.75rem', fontWeight: 400, color: '#0a1f3d', marginBottom: '0.5rem' }}>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create an account' : mode === 'forgot' ? 'Find your account' : 'Choose a new password'}</h1>
        <p style={{ color: '#5a7199', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>{mode === 'login' ? 'Sign in to continue. Your dashboard is selected automatically based on your account.' : mode === 'register' ? 'Create a resident account for the barangay portal.' : mode === 'forgot' ? 'Enter the email address linked to your account. We will send a six-digit reset code.' : 'Enter the six-digit email code and choose a new password.'}</p>
        {mode === 'register' && <><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Full name</label><input required minLength={2} maxLength={50} pattern="[\p{L}\p{M} .'-]+" title="Use 2–50 letters, spaces, hyphens, apostrophes, or periods." value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9375rem' }} /><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Home address *</label><input required minLength={1} maxLength={255} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="House number, street, subdivision or purok" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9375rem' }} /><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Phone (optional)</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9375rem' }} /></>}
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Email address</label>
        <input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setCaptcha(null); setCaptchaAnswer('') }} onBlur={() => mode === 'register' && setEmail((value) => value.trim().toLowerCase())} autoComplete="username" placeholder="name@brgy.gov.ph" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9375rem' }} />
        {mode === 'reset' && <><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Six-digit email code</label><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9375rem', letterSpacing: '0.2em' }} /></>}
        {mode !== 'forgot' && <><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>{mode === 'reset' ? 'New password' : 'Password'}</label><input required type="password" minLength={mode === 'register' || mode === 'reset' ? 6 : undefined} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9375rem' }} /></>}
        {mode === 'login' && captcha && <div style={{ marginBottom: '1.25rem', padding: '0.875rem', border: '1px solid #d1dce8', borderRadius: 8, backgroundColor: '#f8fafc' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>{captcha.question} Enter the answer to continue.</label>
          <input required inputMode="numeric" value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} aria-label="CAPTCHA answer" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, fontSize: '0.9375rem' }} />
        </div>}
        {(mode === 'register' || mode === 'reset') && <><label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Confirm password</label><input required type="password" minLength={6} maxLength={72} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" style={{ width: '100%', padding: '0.7rem 0.875rem', border: '1px solid #d1dce8', borderRadius: 8, marginBottom: '1.25rem', fontSize: '0.9375rem' }} /></>}
        {mode === 'register' && <div style={{ marginBottom: '1.25rem', padding: '0.875rem', border: '1px solid #d1dce8', borderRadius: 8, backgroundColor: '#f8fafc', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.55 }}>
          <strong style={{ display: 'block', color: '#0a1f3d', marginBottom: '0.375rem' }}>Privacy notice and terms of use</strong>
          <p style={{ margin: '0 0 0.5rem' }}>Barangay DMMS collects your name, email, required home address, and any optional phone number to create and secure your account, manage drainage reports, and contact you about your submitted reports. Your barangay is set by the system administrator. Your information may be viewed by authorized barangay staff and administrators for these purposes. Keep your password private and submit accurate, respectful reports. Do not use the system to post unlawful, false, or abusive content.</p>
          <p style={{ margin: '0 0 0.625rem' }}>Account and report information is retained while needed to operate the service and meet barangay recordkeeping obligations. You may request access or correction through the barangay office. Phone details are optional.</p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#334155', cursor: 'pointer' }}>
            <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: '0.2rem' }} />
            <span>I have read and agree to this privacy notice and the system terms of use.</span>
          </label>
        </div>}
        {mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); setRegistered(false); setResetComplete(false); setCaptcha(null) }} style={{ display: 'block', margin: '-0.5rem 0 1rem auto', padding: '0.25rem 0', background: 'none', border: 'none', color: '#1a5fb4', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit' }}>Forgot password?</button>}
        <button type="submit" style={{ width: '100%', padding: '0.75rem', backgroundColor: cfg.accent, color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9375rem' }}>{mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : mode === 'forgot' ? 'Send reset code' : 'Reset password'}</button>
        {mode === 'forgot' && <button type="button" onClick={() => { setMode('reset'); setResetRequested(true); setError(''); setOtp('') }} style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem', backgroundColor: 'transparent', color: '#1a5fb4', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>I already have a code</button>}
        {mode === 'reset' && <button type="button" onClick={() => { setMode('forgot'); setResetRequested(false); setError(''); setOtp('') }} style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem', backgroundColor: 'transparent', color: '#1a5fb4', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>Request a new code</button>}
        {(mode === 'forgot' || mode === 'reset') && <button type="button" onClick={() => { setMode('login'); setResetRequested(false); setError(''); setOtp('') }} style={{ width: '100%', padding: '0.625rem', marginTop: '0.25rem', backgroundColor: 'transparent', color: '#5a7199', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'inherit' }}>Back to login</button>}
      </form>
    </div>
  )
}

function LandingPage({ onSelect }: { onSelect: (r: Role) => void }) {
  const [hovered, setHovered] = useState<Role | null>(null)

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: '#060f24', color: '#ffffff' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#060f24ee', backdropFilter: 'blur(12px)', borderBottom: '1px solid #ffffff12' }}>
        <div className="landing-header-inner" style={{ maxWidth: 1120, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <a href="#home" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#ffffff', textDecoration: 'none', fontWeight: 700 }}><span style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#2ec4b6', display: 'grid', placeItems: 'center' }}>💧</span>Barangay DMMS</a>
          <nav className="landing-nav" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.875rem' }}>{['home', 'about', 'cta', 'contacts'].map((item) => <a key={item} href={`#${item}`} style={{ color: '#9bb1d0', textDecoration: 'none', textTransform: 'capitalize' }}>{item === 'cta' ? 'Get Started' : item}</a>)}</nav>
        </div>
      </header>
      <main>
        <section id="home" className="landing-hero" style={{ maxWidth: 1120, margin: '0 auto', padding: '7rem 1.5rem 6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)', gap: '4rem', alignItems: 'center' }}>
          <div><div style={{ color: '#2ec4b6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>A safer, cleaner barangay</div><h1 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2.75rem, 7vw, 5.5rem)', lineHeight: 0.98, marginBottom: '1.5rem' }}>Better drainage.<br /><span style={{ color: '#2ec4b6' }}>Better community.</span></h1><p style={{ color: '#9bb1d0', fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 540, marginBottom: '2rem' }}>Barangay DMMS connects residents, staff, and administrators to keep drainage concerns visible, verified, and resolved.</p><a href="#cta" style={{ display: 'inline-block', padding: '0.85rem 1.25rem', borderRadius: 8, backgroundColor: '#2ec4b6', color: '#052433', fontWeight: 700, textDecoration: 'none' }}>Access the system →</a></div>
          <div style={{ minHeight: 330, borderRadius: 24, border: '1px solid #2ec4b638', background: 'linear-gradient(145deg, #12345a, #0b1b36 55%, #0c6b70)', padding: '1.5rem', display: 'flex', alignItems: 'flex-end', boxShadow: '0 24px 80px #00000040' }}><div style={{ width: '100%', padding: '1.25rem', borderRadius: 16, backgroundColor: '#06162ce8', border: '1px solid #ffffff18' }}><div style={{ color: '#7a9cc4', fontSize: '0.75rem', marginBottom: '0.5rem' }}>COMMUNITY STATUS</div><div style={{ fontSize: '2.25rem', fontFamily: '"DM Serif Display", Georgia, serif' }}>Clearer channels.<br />Faster action.</div></div></div>
        </section>
        <section id="about" style={{ backgroundColor: '#0a1f3d', padding: '6rem 1.5rem' }}><div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}><div style={{ color: '#2ec4b6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>About the system</div><h2 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 3.5rem)', marginBottom: '1rem' }}>One shared view of every drainage concern.</h2><p style={{ color: '#9bb1d0', fontSize: '1rem', lineHeight: 1.7, maxWidth: 680, margin: '0 auto' }}>Residents can report issues and follow progress. Barangay staff can verify, inspect, and record maintenance. Administrators get the oversight and analytics needed to improve services over time.</p></div></section>
        <section id="cta" style={{ maxWidth: 1120, margin: '0 auto', padding: '6rem 1.5rem' }}><div style={{ marginBottom: '2rem' }}><div style={{ color: '#2ec4b6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Get started</div><h2 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 3.25rem)', marginTop: '0.75rem' }}>Choose your portal</h2></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>{(Object.entries(roleConfig) as [Role, (typeof roleConfig)[Role]][]).map(([roleKey, cfg]) => <button key={roleKey} onClick={() => onSelect(roleKey)} onMouseEnter={() => setHovered(roleKey)} onMouseLeave={() => setHovered(null)} style={{ textAlign: 'left', padding: '1.5rem', borderRadius: 16, border: `1px solid ${hovered === roleKey ? cfg.accent + '70' : '#ffffff18'}`, backgroundColor: hovered === roleKey ? '#ffffff12' : '#ffffff08', color: '#ffffff', cursor: 'pointer', transform: hovered === roleKey ? 'translateY(-3px)' : 'none', transition: 'all 0.2s ease' }}><div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.625rem' }}>{cfg.icon} {cfg.label}</div><div style={{ color: '#9bb1d0', fontSize: '0.875rem', lineHeight: 1.55 }}>{cfg.description}</div><div style={{ color: cfg.accent, fontSize: '0.8125rem', fontWeight: 700, marginTop: '1.25rem' }}>Enter portal →</div></button>)}</div></section>
        <section id="contacts" style={{ backgroundColor: '#2ec4b6', color: '#052433', padding: '4rem 1.5rem' }}><div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}><div><div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Contacts</div><h2 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: '2.5rem', marginBottom: '0.5rem' }}>Need help?</h2><p style={{ maxWidth: 480, lineHeight: 1.6 }}>Reach the barangay office for assistance with reports, access, or maintenance updates.</p></div><div style={{ fontWeight: 700, lineHeight: 1.9 }}>Barangay Hall<br />help@barangay.gov.ph<br />(02) 8123 4567</div></div></section>
      </main>
      <footer style={{ maxWidth: 1120, margin: '0 auto', padding: '1.5rem', color: '#5e779b', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}><span>Barangay Government Portal</span><span>For official use only · v2.4.1</span></footer>
    </div>
  )
}

function RoleSelectScreen({ onSelect }: { onSelect: (r: Role) => void }) {
  return <LandingPage onSelect={onSelect} />
  /*
  const [hovered, setHovered] = useState<Role | null>(null)

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#060f24',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(26,95,180,0.18) 0%, transparent 70%)',
      }}
    >
      { /* Logo + title * / }
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            backgroundColor: '#ffffff0d',
            border: '1px solid #ffffff15',
            borderRadius: 100,
            padding: '0.4rem 1rem 0.4rem 0.5rem',
            marginBottom: '1.75rem',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              backgroundColor: '#2ec4b6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            💧
          </div>
          <span style={{ color: '#2ec4b6', fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '0.08em' }}>
            BARANGAY DMMS
          </span>
        </div>

        <h1
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 'clamp(1.75rem, 4vw, 2.875rem)',
            color: '#ffffff',
            fontWeight: 400,
            lineHeight: 1.2,
            marginBottom: '0.875rem',
          }}
        >
          Drainage Maintenance<br />Management System
        </h1>
        <p style={{ color: '#7a9cc4', fontSize: '1rem', maxWidth: '28rem', margin: '0 auto', lineHeight: 1.6 }}>
          Select your portal to access the system. Each role provides a tailored set of tools and permissions.
        </p>
      </div>

      { /* Role cards * / }
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.25rem',
          width: '100%',
          maxWidth: '860px',
        }}
      >
        {(Object.entries(roleConfig) as [Role, (typeof roleConfig)[Role]][]).map(([roleKey, cfg]) => (
          <button
            key={roleKey}
            onClick={() => onSelect(roleKey)}
            onMouseEnter={() => setHovered(roleKey)}
            onMouseLeave={() => setHovered(null)}
            style={{
              backgroundColor: hovered === roleKey ? '#ffffff0f' : '#ffffff08',
              border: `1px solid ${hovered === roleKey ? cfg.accent + '55' : '#ffffff12'}`,
              borderRadius: 16,
              padding: '1.75rem',
              textAlign: 'left',
              cursor: 'pointer',
              transform: hovered === roleKey ? 'translateY(-3px)' : 'translateY(0)',
              transition: 'all 0.2s ease',
              outline: 'none',
              boxShadow: hovered === roleKey ? `0 12px 32px rgba(0,0,0,0.25), 0 0 0 1px ${cfg.accent}30` : 'none',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: cfg.accent + '20',
                border: `1px solid ${cfg.accent}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                marginBottom: '1.25rem',
              }}
            >
              {cfg.icon}
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#7a9cc4', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              {cfg.description}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {cfg.features.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: cfg.accent }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: cfg.accent,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  {f}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <p style={{ color: '#3a5470', fontSize: '0.75rem', marginTop: '2.5rem', textAlign: 'center' }}>
        Barangay Government Portal · v2.4.1 · For official use only
      </p>
    </div>
  )
}

  */
}

function AppShell({
  role,
  userName,
  activeNav,
  onNavChange,
  onLogout,
  children,
}: {
  role: Role
  userName: string
  activeNav: string
  onNavChange: (id: string) => void
  onLogout: () => void
  children: React.ReactNode
}) {
  const cfg = roleConfig[role]
  const items = diagramNavItems[role]
  const [logoutHover, setLogoutHover] = useState(false)

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div className="app-sidebar"
        style={{
          width: 232,
          backgroundColor: '#060f24',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid #ffffff0f',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '1.125rem 1.125rem 1rem', borderBottom: '1px solid #ffffff0a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: 30,
                height: 30,
                backgroundColor: '#2ec4b6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              💧
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8125rem', lineHeight: 1 }}>
                Barangay DMMS
              </div>
              <div style={{ color: '#3a5470', fontSize: '0.6875rem', marginTop: 2 }}>v2.4.1</div>
            </div>
          </div>
        </div>

        {/* Current user */}
        <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid #ffffff0a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: cfg.accent + '25',
                border: `1px solid ${cfg.accent}45`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {cfg.icon}
            </div>
            <div>
              <div style={{ color: '#e8eef7', fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}>{userName}</div>
              <div style={{ color: cfg.accent, fontSize: '0.6875rem', fontWeight: 500 }}>{cfg.label}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.875rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#3a5470', letterSpacing: '0.1em', padding: '0 0.5rem', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
            {cfg.label} Portal
          </div>
          {items.map((item) => {
            const isActive = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  backgroundColor: isActive ? cfg.accent + '22' : 'transparent',
                  color: isActive ? cfg.accent : '#7a9cc4',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {isActive && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: cfg.accent,
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '0.75rem 0.625rem', borderTop: '1px solid #ffffff0a' }}>
          <button
            onClick={onLogout}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: 8,
              border: 'none',
              backgroundColor: logoutHover ? '#ffffff10' : 'transparent',
              color: logoutHover ? '#e8eef7' : '#3a5470',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 13 }}>←</span>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="app-main" style={{ flex: 1, overflow: 'auto', backgroundColor: '#f0f4fa' }}>{children}</div>
    </div>
  )
}
