import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { registerUser } from '../api/auth'

const Register = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerUser(form.username, form.email, form.password)
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
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
          <h2 style={styles.title}>Create Account</h2>
          <p style={styles.subtitle}>Join your team's monitoring platform</p>
        </div>

        <form onSubmit={handleRegister} style={styles.form}>
          {[
            { key: 'username', label: 'Username', type: 'text', placeholder: 'john_doe' },
            { key: 'email', label: 'Email Address', type: 'email', placeholder: 'john@example.com' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} style={styles.fieldGroup}>
              <label style={styles.label}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                required
                style={styles.input}
              />
            </div>
          ))}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--bg-base)' },
  bg: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 80% 50%, rgba(0,212,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(0,255,157,0.04) 0%, transparent 50%)', pointerEvents: 'none' },
  card: { width: 400, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fade-up 0.4s ease' },
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
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '11px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' },
  btn: { marginTop: 8, padding: '13px', background: 'var(--accent-green)', color: '#080c14', border: 'none', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 700, letterSpacing: 0.5 },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' },
  link: { color: 'var(--accent-cyan)' },
}

export default Register
