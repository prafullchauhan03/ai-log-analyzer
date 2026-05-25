import { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { loginUser } from '../api/auth'
import { AuthContext } from '../context/AuthContext'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await loginUser(email, password)
      login(res.data.access_token, { username: res.data.username, role: res.data.role })
      toast.success(`Welcome back, ${res.data.username}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <span style={styles.logoAI}>AI</span>
            <span style={styles.logoRest}>LogAnalyzer</span>
          </div>
          <div style={styles.logoSub}>ENTERPRISE EDITION</div>
          <h2 style={styles.title}>Sign In</h2>
          <p style={styles.subtitle}>Access your monitoring dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        <p style={styles.footer}>
          No account?{' '}
          <Link to="/register" style={styles.link}>Create one</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: 'var(--bg-base)',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(182,123,255,0.05) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  card: {
    width: 400,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px',
    position: 'relative',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    animation: 'fade-up 0.4s ease',
  },
  header: { textAlign: 'center', marginBottom: 32 },
  logo: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 4 },
  logoAI: { fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--accent-cyan)' },
  logoRest: { fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text-primary)' },
  logoSub: { fontSize: 9, letterSpacing: 4, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '11px 14px',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    marginTop: 8,
    padding: '13px',
    background: 'var(--accent-cyan)',
    color: '#080c14',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.5,
    transition: 'opacity 0.15s',
  },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' },
  link: { color: 'var(--accent-cyan)' },
}

export default Login
