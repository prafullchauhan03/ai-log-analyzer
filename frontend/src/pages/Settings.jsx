import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  MdPerson, MdLock, MdSave, MdCheckCircle,
  MdVisibility, MdVisibilityOff, MdEdit,
} from 'react-icons/md'
import Sidebar from '../components/Sidebar'
import Navbar  from '../components/Navbar'
import { getMe, updateMe, changePassword } from '../api/users'
import { useAuth } from '../context/AuthContext'

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, children }) => (
  <div style={S.card}>
    <div style={S.cardHeader}>
      <Icon size={18} color="var(--accent-cyan)" />
      <span style={S.cardTitle}>{title}</span>
    </div>
    {children}
  </div>
)

// ─── Field row ────────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={S.field}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
)

// ─── Password input ───────────────────────────────────────────────────────────
const PasswordInput = ({ value, onChange, placeholder }) => {
  const [show, setShow] = useState(false)
  return (
    <div style={S.pwWrap}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={S.input}
      />
      <button type="button" onClick={() => setShow(s => !s)} style={S.eyeBtn}>
        {show ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const Settings = () => {
  const { user: authUser, login } = useAuth()

  // Profile
  const [profile,        setProfile]        = useState({ username: '', email: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaved,   setProfileSaved]   = useState(false)

  // Password
  const [passwords,      setPasswords]      = useState({ current: '', next: '', confirm: '' })
  const [pwLoading,      setPwLoading]      = useState(false)

  useEffect(() => {
    getMe()
      .then(r => setProfile({ username: r.data.username, email: r.data.email }))
      .catch(() => toast.error('Failed to load profile'))
  }, [])

  // ── Profile save ────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await updateMe({ username: profile.username, email: profile.email })
      // Update auth context so Sidebar reflects new username immediately
      const token = localStorage.getItem('token')
      login(token, { ...authUser, username: res.data.username })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally {
      setProfileLoading(false)
    }
  }

  // ── Password save ───────────────────────────────────────────────────────────
  const savePassword = async () => {
    if (passwords.next.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('New passwords do not match')
      return
    }
    setPwLoading(true)
    try {
      await changePassword({ current_password: passwords.current, new_password: passwords.next })
      toast.success('Password changed successfully')
      setPasswords({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password change failed')
    } finally {
      setPwLoading(false)
    }
  }

  const setPw = key => e => setPasswords(p => ({ ...p, [key]: e.target.value }))

  return (
    <div style={S.layout}>
      <Sidebar />
      <div style={S.main}>
        <Navbar onRefresh={() => {}} loading={false} lastUpdated={null} />
        <div style={S.content}>

          {/* Account info banner */}
          <div style={S.banner}>
            <div style={S.bannerAvatar}>
              {authUser?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={S.bannerName}>{authUser?.username}</div>
              <div style={S.bannerRole}>{authUser?.role}</div>
            </div>
          </div>

          {/* Profile section */}
          <Section title="Profile" icon={MdPerson}>
            <div style={S.cardBody}>
              <div style={S.twoCol}>
                <Field label="Username">
                  <input
                    value={profile.username}
                    onChange={e => setProfile(p => ({ ...p, username: e.target.value }))}
                    style={S.input}
                    placeholder="username"
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    style={S.input}
                    placeholder="you@example.com"
                  />
                </Field>
              </div>
              <div style={S.twoCol}>
                <Field label="Role">
                  <input value={authUser?.role || ''} readOnly style={{ ...S.input, opacity: 0.5, cursor: 'not-allowed' }} />
                </Field>
              </div>
              <div style={S.cardFooter}>
                <button
                  onClick={saveProfile}
                  disabled={profileLoading}
                  style={S.saveBtn}
                >
                  {profileSaved
                    ? <><MdCheckCircle size={14} /> Saved!</>
                    : profileLoading
                      ? 'Saving...'
                      : <><MdSave size={14} /> Save Profile</>
                  }
                </button>
              </div>
            </div>
          </Section>

          {/* Password section */}
          <Section title="Change Password" icon={MdLock}>
            <div style={S.cardBody}>
              <Field label="Current Password">
                <PasswordInput
                  value={passwords.current}
                  onChange={setPw('current')}
                  placeholder="Enter current password"
                />
              </Field>
              <div style={S.twoCol}>
                <Field label="New Password">
                  <PasswordInput
                    value={passwords.next}
                    onChange={setPw('next')}
                    placeholder="Min. 6 characters"
                  />
                </Field>
                <Field label="Confirm New Password">
                  <PasswordInput
                    value={passwords.confirm}
                    onChange={setPw('confirm')}
                    placeholder="Repeat new password"
                  />
                </Field>
              </div>

              {/* Strength indicator */}
              {passwords.next.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    PASSWORD STRENGTH
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[6, 10, 14].map((threshold, i) => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: passwords.next.length >= threshold
                          ? ['var(--accent-amber)', 'var(--accent-cyan)', 'var(--accent-green)'][i]
                          : 'var(--border)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    {passwords.next.length < 6 ? 'Too short' : passwords.next.length < 10 ? 'Fair' : passwords.next.length < 14 ? 'Good' : 'Strong'}
                  </div>
                </div>
              )}

              <div style={S.cardFooter}>
                <button
                  onClick={savePassword}
                  disabled={pwLoading || !passwords.current || !passwords.next || !passwords.confirm}
                  style={{ ...S.saveBtn, opacity: (!passwords.current || !passwords.next || !passwords.confirm) ? 0.4 : 1 }}
                >
                  {pwLoading ? 'Changing...' : <><MdLock size={14} /> Change Password</>}
                </button>
              </div>
            </div>
          </Section>

          {/* Danger zone */}
          <div style={S.dangerCard}>
            <div style={S.dangerHeader}>Danger Zone</div>
            <div style={S.dangerRow}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Account Information</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  To delete your account, contact an administrator.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  layout:  { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 },

  banner:       { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 },
  bannerAvatar: { width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent-cyan),var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 },
  bannerName:   { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
  bannerRole:   { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'var(--font-mono)', marginTop: 2 },

  card:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--border)' },
  cardTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  cardBody:   { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  cardFooter: { display: 'flex', justifyContent: 'flex-end', paddingTop: 4 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },

  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', fontWeight: 700 },
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },

  pwWrap:  { position: 'relative', display: 'flex', alignItems: 'center' },
  eyeBtn:  { position: 'absolute', right: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 },

  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--accent-cyan)', color: '#080c14', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s' },

  dangerCard:   { background: 'rgba(255,61,90,0.04)', border: '1px solid rgba(255,61,90,0.2)', borderRadius: 12, overflow: 'hidden' },
  dangerHeader: { padding: '12px 24px', borderBottom: '1px solid rgba(255,61,90,0.2)', fontSize: 11, fontWeight: 700, color: 'var(--severity-critical)', textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'var(--font-mono)' },
  dangerRow:    { padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
}

export default Settings
