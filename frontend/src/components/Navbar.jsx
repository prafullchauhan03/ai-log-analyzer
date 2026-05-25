import { MdRefresh, MdCircle } from 'react-icons/md'

const Navbar = ({ onRefresh, loading, lastUpdated }) => {
  return (
    <header style={styles.navbar}>
      <div style={styles.left}>
        <div style={styles.status}>
          <MdCircle size={8} color="var(--accent-green)" style={{ animation: 'pulse-dot 2s infinite' }} />
          <span style={styles.statusText}>LIVE</span>
        </div>
        <span style={styles.breadcrumb}>Dashboard Overview</span>
      </div>
      <div style={styles.right}>
        {lastUpdated && (
          <span style={styles.lastUpdated}>
            Updated {lastUpdated}
          </span>
        )}
        <button onClick={onRefresh} style={styles.refreshBtn} disabled={loading}>
          <MdRefresh size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>
    </header>
  )
}

const styles = {
  navbar: {
    height: 'var(--navbar-height)',
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },
  left: { display: 'flex', alignItems: 'center', gap: 16 },
  status: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(0,255,157,0.08)', borderRadius: 20, border: '1px solid rgba(0,255,157,0.2)' },
  statusText: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', letterSpacing: 1 },
  breadcrumb: { fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  lastUpdated: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
}

export default Navbar
