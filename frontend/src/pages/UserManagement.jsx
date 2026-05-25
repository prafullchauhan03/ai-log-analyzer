import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  MdPeople, MdAdminPanelSettings, MdPerson,
  MdDelete, MdEdit, MdClose, MdSave, MdAdd,
  MdSearch, MdShield, MdLock,
} from 'react-icons/md'
import Sidebar from '../components/Sidebar'
import Navbar  from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getUsers, changeRole, deleteUser, updateMe, changePassword } from '../api/users'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const RoleBadge = ({ role }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
    padding: '2px 9px', borderRadius: 20, letterSpacing: 0.5, textTransform: 'uppercase',
    background: role === 'admin' ? 'rgba(182,123,255,0.12)' : 'rgba(0,212,255,0.08)',
    color:      role === 'admin' ? 'var(--accent-purple)'   : 'var(--accent-cyan)',
    border:     `1px solid ${role === 'admin' ? 'rgba(182,123,255,0.3)' : 'rgba(0,212,255,0.2)'}`,
  }}>
    {role === 'admin' ? <MdAdminPanelSettings size={11} /> : <MdPerson size={11} />}
    {role}
  </span>
)

const Avatar = ({ username, size = 34 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700, color: '#080c14',
  }}>
    {username?.[0]?.toUpperCase() || '?'}
  </div>
)

// ── Edit Profile Modal ────────────────────────────────────────────────────────

const EditProfileModal = ({ onClose, onSaved }) => {
  const { user } = useAuth()
  const [tab,  setTab]  = useState('profile')
  const [form, setForm] = useState({ username: user?.username || '', email: '' })
  const [pass, setPass] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const saveProfile = async () => {
    setSaving(true)
    try {
      await updateMe({ username: form.username || undefined, email: form.email || undefined })
      toast.success('Profile updated')
      onSaved()
      onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed') }
    finally { setSaving(false) }
  }

  const savePassword = async () => {
    if (pass.new_password !== pass.confirm) return toast.error('Passwords do not match')
    if (pass.new_password.length < 8) return toast.error('Password must be 8+ characters')
    setSaving(true)
    try {
      await changePassword({ current_password: pass.current_password, new_password: pass.new_password })
      toast.success('Password changed')
      onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to change password') }
    finally { setSaving(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Edit Profile</span>
          <button onClick={onClose} style={S.iconBtn}><MdClose size={18} /></button>
        </div>

        <div style={S.tabs}>
          {[['profile', 'Profile'], ['password', 'Password']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...S.tab, ...(tab === id ? S.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={S.modalBody}>
            <div style={S.field}>
              <label style={S.label}>Username</label>
              <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                placeholder="New username" style={S.input} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="New email address" style={S.input} />
            </div>
            <button onClick={saveProfile} disabled={saving} style={S.saveBtn}>
              <MdSave size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {tab === 'password' && (
          <div style={S.modalBody}>
            {[
              { key: 'current_password', label: 'Current Password', placeholder: '••••••••' },
              { key: 'new_password',     label: 'New Password',     placeholder: '8+ characters' },
              { key: 'confirm',          label: 'Confirm Password', placeholder: 'Repeat new password' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={S.field}>
                <label style={S.label}>{label}</label>
                <input type="password" value={pass[key]}
                  onChange={e => setPass({...pass, [key]: e.target.value})}
                  placeholder={placeholder} style={S.input} />
              </div>
            ))}
            <button onClick={savePassword} disabled={saving} style={S.saveBtn}>
              <MdLock size={14} /> {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const UserManagement = () => {
  const { user: me } = useAuth()
  const isAdmin = me?.role === 'admin'

  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState('')
  const [editProfile, setEditProfile] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data.users || [])
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) {
      toast.error('Failed to load users')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleToggle = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    try {
      await changeRole(u.id, newRole)
      toast.success(`${u.username} is now ${newRole}`)
      fetchUsers()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update role') }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await deleteUser(u.id)
      toast.success(`User ${u.username} deleted`)
      fetchUsers()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete user') }
  }

  const visible = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole   = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div style={S.layout}>
      <Sidebar />
      <div style={S.main}>
        <Navbar onRefresh={fetchUsers} loading={loading} lastUpdated={lastUpdated} />
        <div style={S.content}>

          {/* Stats row */}
          <div style={S.statsRow}>
            {[
              { label: 'Total Users',  value: users.length,                            color: 'var(--accent-cyan)' },
              { label: 'Admins',       value: users.filter(u => u.role==='admin').length, color: 'var(--accent-purple)' },
              { label: 'Regular Users',value: users.filter(u => u.role==='user').length,  color: 'var(--accent-green)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...S.statCard, borderTop: `2px solid ${color}` }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{label}</div>
              </div>
            ))}

            <div style={{ ...S.statCard, borderTop: '2px solid var(--border-bright)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              <button onClick={() => setEditProfile(true)} style={S.editProfileBtn}>
                <MdEdit size={14} /> Edit My Profile
              </button>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                Logged in as <span style={{ color: 'var(--accent-cyan)' }}>{me?.username}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={S.controls}>
            <div style={S.searchWrap}>
              <MdSearch size={15} color="var(--text-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by username or email..." style={S.searchInput} />
            </div>
            <div style={S.filterGroup}>
              {['', 'user', 'admin'].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)} style={{
                  ...S.filterBtn,
                  background: roleFilter === r ? 'rgba(0,212,255,0.1)' : 'transparent',
                  color: roleFilter === r ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  borderColor: roleFilter === r ? 'rgba(0,212,255,0.3)' : 'var(--border)',
                }}>
                  {r === '' ? 'All Roles' : r === 'admin' ? '⚡ Admin' : '👤 User'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>
                Users
                <span style={S.countBadge}>{visible.length}</span>
              </span>
              {!isAdmin && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Read-only — admin access required to manage users
                </span>
              )}
            </div>

            {loading ? (
              <div style={S.emptyState}>
                <div style={S.dot} />
                <span>Loading users...</span>
              </div>
            ) : visible.length === 0 ? (
              <div style={S.emptyState}><MdPeople size={28} style={{ opacity: 0.3 }} /><span>No users found</span></div>
            ) : (
              <>
                <div style={{ ...S.row, ...S.rowHead }}>
                  <span>User</span><span>Email</span><span>Role</span><span>Joined</span>
                  {isAdmin && <span style={{ textAlign: 'center' }}>Actions</span>}
                </div>
                {visible.map(u => (
                  <div key={u.id} style={{ ...S.row, opacity: u.email === me?.email ? 0.9 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar username={u.username} size={30} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.username}
                          {u.email === me?.email && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)',
                              marginLeft: 8, padding: '1px 6px', borderRadius: 10,
                              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>YOU</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID #{u.id}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{u.email}</span>
                    <span><RoleBadge role={u.role} /></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDate(u.created_at)}</span>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {u.email !== me?.email && (
                          <>
                            <button
                              onClick={() => handleRoleToggle(u)}
                              title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                              style={{ ...S.actionBtn, color: u.role === 'admin' ? 'var(--accent-amber)' : 'var(--accent-purple)' }}
                            >
                              <MdShield size={15} />
                            </button>
                            <button onClick={() => handleDelete(u)} title="Delete user"
                              style={{ ...S.actionBtn, color: 'var(--severity-critical)' }}>
                              <MdDelete size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {editProfile && (
        <EditProfileModal onClose={() => setEditProfile(false)} onSaved={fetchUsers} />
      )}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = {
  layout:   { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content:  { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },

  statsRow: { display: 'flex', gap: 14 },
  statCard: { flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },

  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  searchWrap:  { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 12px', minWidth: 260 },
  searchInput: { background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' },
  filterGroup: { display: 'flex', gap: 6 },
  filterBtn:   { padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 11,
    fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },

  panel:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flex: 1 },
  panelHeader: { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle:  { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
    letterSpacing: 1, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 },
  countBadge:  { background: 'var(--accent-cyan)', color: '#080c14', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700 },

  rowHead: { fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5, background: 'var(--bg-base)' },
  row:     { display: 'grid', gridTemplateColumns: '2fr 2fr 120px 120px 80px', gap: 12,
    padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' },

  emptyState:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: '60px 20px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 },
  dot:         { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse-dot 1s infinite' },

  actionBtn:   { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },

  editProfileBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '7px 14px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: 'var(--radius)', color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:   { width: 440, background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fade-up 0.2s ease' },
  modalHeader: { padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  modalBody:   { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },

  tabs:     { display: 'flex', borderBottom: '1px solid var(--border)' },
  tab:      { flex: 1, padding: '10px', background: 'none', border: 'none', fontSize: 12, fontWeight: 600,
    color: 'var(--text-muted)', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  tabActive:{ color: 'var(--accent-cyan)', borderBottomColor: 'var(--accent-cyan)' },

  field:   { display: 'flex', flexDirection: 'column', gap: 6 },
  label:   { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' },
  input:   { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' },
  saveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px',
    background: 'var(--accent-cyan)', color: '#080c14', border: 'none', borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' },
}

export default UserManagement
