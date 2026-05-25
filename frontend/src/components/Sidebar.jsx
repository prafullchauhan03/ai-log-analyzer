import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  MdDashboard, MdList, MdWarning, MdPsychology,
  MdMonitor, MdPeople, MdSettings, MdLogout
} from 'react-icons/md'
import { getAlertSummary } from '../api/alerts'

const Sidebar = () => {
  const { user, logout, isAuthenticated } = useAuth()
  const [openAlerts, setOpenAlerts] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) return
    const fetch = async () => {
      try {
        const res = await getAlertSummary()
        setOpenAlerts(res.data.open_total || 0)
      } catch { /* silent */ }
    }
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [isAuthenticated])

  const NAV = [
    { to: '/dashboard',     icon: MdDashboard,  label: 'Dashboard' },
    { to: '/live-logs',     icon: MdList,       label: 'Live Logs' },
    { to: '/alerts',        icon: MdWarning,    label: 'Alerts',      badge: openAlerts },
    { to: '/ai-insights',   icon: MdPsychology, label: 'AI Insights' },
    { to: '/system-health', icon: MdMonitor,    label: 'System Health' },
    { to: '/users',         icon: MdPeople,     label: 'User Mgmt' },
    { to: '/settings',      icon: MdSettings,   label: 'Settings' },
  ]

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoAccent}>AI</span>
        <span style={styles.logoText}>LogAnalyzer</span>
        <span style={styles.logoVersion}>ENTERPRISE</span>
      </div>

      <nav style={styles.nav}>
        {NAV.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <Icon size={18} />
            <span>{label}</span>
            {badge > 0 && (
              <span style={styles.badge}>{badge > 99 ? '99+' : badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={styles.userSection}>
        <div style={styles.avatar}>
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div style={styles.userInfo}>
          <div style={styles.username}>{user?.username || 'User'}</div>
          <div style={styles.role}>{user?.role || 'user'}</div>
        </div>
        <button onClick={logout} style={styles.logoutBtn} title="Logout">
          <MdLogout size={18} />
        </button>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)', minHeight: '100vh',
    background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  logo: {
    padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  logoAccent:  { fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 },
  logoText:    { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1 },
  logoVersion: { fontSize: 9, letterSpacing: 3, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  nav: { flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
    transition: 'all 0.15s', position: 'relative',
  },
  navItemActive: {
    background: 'rgba(0,212,255,0.08)', color: 'var(--accent-cyan)',
    borderLeft: '2px solid var(--accent-cyan)',
  },
  badge: {
    marginLeft: 'auto', background: 'var(--severity-critical)',
    color: '#fff', fontSize: 10, fontWeight: 700,
    padding: '1px 6px', borderRadius: 10, fontFamily: 'var(--font-mono)',
    animation: 'pulse-dot 2s infinite',
  },
  userSection: {
    padding: '16px', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0 },
  username: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  role:     { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' },
  logoutBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 0.15s',
  },
}

export default Sidebar
