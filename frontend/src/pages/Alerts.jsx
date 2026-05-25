import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  MdWarning, MdCheckCircle, MdCancel, MdInfo,
  MdSearch, MdRefresh, MdOpenInNew,
  MdDoneAll, MdClose, MdDelete, MdPlayArrow,
  MdFilterAlt, MdBolt,
} from 'react-icons/md'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import {
  getAlerts, getAlertSummary, runDetection,
  acknowledgeAlert, resolveAlert, deleteAlert,
} from '../api/alerts'
import { useAuth } from '../context/AuthContext'

// ─── constants ────────────────────────────────────────────────────────────────

const SEVERITY_META = {
  critical: { color: '#ff3d5a', bg: 'rgba(255,61,90,0.10)', label: 'CRITICAL', icon: MdCancel },
  high:     { color: '#ff7043', bg: 'rgba(255,112,67,0.10)', label: 'HIGH',     icon: MdWarning },
  medium:   { color: '#ffb300', bg: 'rgba(255,179,0,0.10)',  label: 'MEDIUM',   icon: MdWarning },
  low:      { color: '#4d9fff', bg: 'rgba(77,159,255,0.10)', label: 'LOW',      icon: MdInfo },
}

const STATUS_META = {
  open:         { color: '#ff3d5a', label: 'Open' },
  acknowledged: { color: '#ffb300', label: 'Acknowledged' },
  resolved:     { color: '#00ff9d', label: 'Resolved' },
}

const CATEGORY_ICONS = {
  security:       '🔐',
  performance:    '⚡',
  infrastructure: '🏗️',
  anomaly:        '🤖',
}

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// ─── sub-components ───────────────────────────────────────────────────────────

const SeverityBadge = ({ severity, size = 'sm' }) => {
  const m = SEVERITY_META[severity] || SEVERITY_META.low
  const Icon = m.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: size === 'sm' ? 9 : 11,
      fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: 0.5,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 20, background: m.bg, color: m.color,
      border: `1px solid ${m.color}40`,
    }}>
      <Icon size={size === 'sm' ? 10 : 12} />
      {m.label}
    </span>
  )
}

const StatusDot = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.open
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
      {m.label}
    </span>
  )
}

const SummaryCard = ({ severity, count, onClick, active }) => {
  const m = SEVERITY_META[severity]
  const Icon = m.icon
  return (
    <button onClick={onClick} style={{
      flex: 1, background: active ? m.bg : 'var(--bg-card)',
      border: `1px solid ${active ? m.color + '80' : 'var(--border)'}`,
      borderTop: `2px solid ${m.color}`,
      borderRadius: 10, padding: '14px 16px',
      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Icon size={18} color={m.color} />
        <span style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: m.color }}>{count}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
        {m.label}
      </div>
    </button>
  )
}

// ─── detail drawer ────────────────────────────────────────────────────────────

const AlertDrawer = ({ alert, onClose, onAck, onResolve, onDelete, isAdmin }) => {
  if (!alert) return null
  const m = SEVERITY_META[alert.severity] || SEVERITY_META.low

  return (
    <div style={S.drawerOverlay} onClick={onClose}>
      <div style={S.drawer} onClick={e => e.stopPropagation()}>
        <div style={S.drawerHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[alert.category] || '⚠️'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{alert.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SeverityBadge severity={alert.severity} size="lg" />
                <StatusDot status={alert.status} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={S.iconBtn}><MdClose size={20} /></button>
        </div>

        <div style={S.drawerBody}>
          {/* Message */}
          <div style={S.drawerSection}>
            <div style={S.drawerSectionTitle}>Message</div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{alert.message}</p>
          </div>

          {/* Metric details */}
          {alert.metric_key && (
            <div style={S.drawerSection}>
              <div style={S.drawerSectionTitle}>Triggered By</div>
              <div style={S.metricBox}>
                <div style={S.metricRow}>
                  <span style={S.metricLabel}>Metric</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)' }}>{alert.metric_key}</span>
                </div>
                <div style={S.metricRow}>
                  <span style={S.metricLabel}>Value</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: m.color, fontWeight: 700 }}>
                    {typeof alert.metric_value === 'number' ? alert.metric_value.toLocaleString() : alert.metric_value}
                  </span>
                </div>
                {alert.threshold > 0 && (
                  <div style={S.metricRow}>
                    <span style={S.metricLabel}>Threshold</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {alert.threshold.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={S.drawerSection}>
            <div style={S.drawerSectionTitle}>Details</div>
            <div style={S.metricBox}>
              {[
                ['Source',   alert.source],
                ['Category', alert.category],
                ['Rule ID',  alert.rule_id],
                ['Created',  alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'],
                alert.acknowledged_by && ['Acknowledged by', alert.acknowledged_by],
                alert.resolved_by     && ['Resolved by',     alert.resolved_by],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={S.metricRow}>
                  <span style={S.metricLabel}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={S.drawerActions}>
          {alert.status === 'open' && (
            <button onClick={() => onAck(alert.id)} style={{ ...S.actionBtn, borderColor: '#ffb30080', color: '#ffb300' }}>
              <MdDoneAll size={14} /> Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button onClick={() => onResolve(alert.id)} style={{ ...S.actionBtn, borderColor: '#00ff9d80', color: '#00ff9d' }}>
              <MdCheckCircle size={14} /> Resolve
            </button>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(alert.id)} style={{ ...S.actionBtn, borderColor: '#ff3d5a80', color: '#ff3d5a', marginLeft: 'auto' }}>
              <MdDelete size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const Alerts = () => {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  const [alerts,      setAlerts]      = useState([])
  const [summary,     setSummary]     = useState({ open_total: 0, by_severity: {} })
  const [loading,     setLoading]     = useState(true)
  const [detecting,   setDetecting]   = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // filters
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('open')
  const [filterCategory, setFilterCategory] = useState('')
  const [search,         setSearch]         = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterSeverity) params.severity = filterSeverity
      if (filterStatus)   params.status   = filterStatus
      if (filterCategory) params.category = filterCategory

      const [alertsRes, summaryRes] = await Promise.all([
        getAlerts({ ...params, limit: 100 }),
        getAlertSummary(),
      ])
      setAlerts(alertsRes.data.alerts || [])
      setSummary(summaryRes.data)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [filterSeverity, filterStatus, filterCategory])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const t = setInterval(fetchAll, 30000)
    return () => clearInterval(t)
  }, [fetchAll])

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const res = await runDetection()
      const count = res.data.detected
      toast.success(count > 0 ? `${count} new alert(s) detected` : 'No new alerts detected')
      fetchAll()
    } catch {
      toast.error('Detection failed')
    } finally {
      setDetecting(false)
    }
  }

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      toast.success('Alert acknowledged')
      setSelected(null)
      fetchAll()
    } catch { toast.error('Failed to acknowledge') }
  }

  const handleResolve = async (id) => {
    try {
      await resolveAlert(id)
      toast.success('Alert resolved')
      setSelected(null)
      fetchAll()
    } catch { toast.error('Failed to resolve') }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAlert(id)
      toast.success('Alert deleted')
      setSelected(null)
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  // client-side search filter
  const visible = alerts.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.message.toLowerCase().includes(search.toLowerCase()) ||
    a.source.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={S.layout}>
      <Sidebar />
      <div style={S.main}>
        <Navbar onRefresh={fetchAll} loading={loading} lastUpdated={lastUpdated} />
        <div style={S.content}>

          {/* ── Summary row ─────────────────────────────────── */}
          <div style={S.summaryRow}>
            {['critical', 'high', 'medium', 'low'].map(sev => (
              <SummaryCard
                key={sev}
                severity={sev}
                count={summary.by_severity?.[sev] || 0}
                active={filterSeverity === sev}
                onClick={() => setFilterSeverity(prev => prev === sev ? '' : sev)}
              />
            ))}
            <div style={S.totalCard}>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {summary.open_total || 0}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                Open Alerts
              </div>
            </div>
          </div>

          {/* ── Controls ────────────────────────────────────── */}
          <div style={S.controls}>
            {/* Search */}
            <div style={S.searchWrap}>
              <MdSearch size={15} color="var(--text-muted)" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search alerts..."
                style={S.searchInput}
              />
            </div>

            {/* Status filter */}
            <div style={S.filterGroup}>
              {['', 'open', 'acknowledged', 'resolved'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    ...S.filterBtn,
                    background: filterStatus === s ? 'rgba(0,212,255,0.12)' : 'transparent',
                    color: filterStatus === s ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    borderColor: filterStatus === s ? 'var(--accent-cyan)40' : 'var(--border)',
                  }}
                >
                  {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <div style={S.filterGroup}>
              {['', 'security', 'performance', 'infrastructure', 'anomaly'].map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  style={{
                    ...S.filterBtn,
                    background: filterCategory === c ? 'rgba(182,123,255,0.10)' : 'transparent',
                    color: filterCategory === c ? 'var(--accent-purple)' : 'var(--text-muted)',
                    borderColor: filterCategory === c ? 'var(--accent-purple)40' : 'var(--border)',
                  }}
                >
                  {c === '' ? 'All Categories' : `${CATEGORY_ICONS[c]} ${c}`}
                </button>
              ))}
            </div>

            {/* Run detection */}
            <button onClick={handleDetect} disabled={detecting} style={S.detectBtn}>
              <MdBolt size={14} />
              {detecting ? 'Running...' : 'Run Detection'}
            </button>
          </div>

          {/* ── Alert list ──────────────────────────────────── */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>
                Alerts
                <span style={S.countBadge}>{visible.length}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Click a row to view details & take action
              </span>
            </div>

            {loading && alerts.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.loadingDot} />
                <span>Loading alerts...</span>
              </div>
            ) : visible.length === 0 ? (
              <div style={S.emptyState}>
                <MdCheckCircle size={32} color="var(--accent-green)" style={{ opacity: 0.5 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {filterStatus === 'open' ? 'No open alerts — system is healthy' : 'No alerts match the current filters'}
                </span>
                <button onClick={handleDetect} style={S.emptyDetectBtn}>
                  <MdBolt size={13} /> Run detection now
                </button>
              </div>
            ) : (
              <div style={S.alertList}>
                {/* Header row */}
                <div style={{ ...S.alertRow, ...S.alertRowHeader }}>
                  <span>Severity</span>
                  <span>Title</span>
                  <span>Source</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span>Time</span>
                </div>
                {visible.map(alert => {
                  const m = SEVERITY_META[alert.severity] || SEVERITY_META.low
                  return (
                    <div
                      key={alert.id}
                      onClick={() => setSelected(alert)}
                      style={{
                        ...S.alertRow,
                        borderLeft: `3px solid ${m.color}`,
                        cursor: 'pointer',
                        background: selected?.id === alert.id ? 'var(--bg-card-hover)' : 'transparent',
                        opacity: alert.status === 'resolved' ? 0.5 : 1,
                      }}
                    >
                      <span><SeverityBadge severity={alert.severity} /></span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {CATEGORY_ICONS[alert.category]} {alert.title}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{alert.source}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{alert.category}</span>
                      <span><StatusDot status={alert.status} /></span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtTime(alert.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail drawer ───────────────────────────────────── */}
      <AlertDrawer
        alert={selected}
        onClose={() => setSelected(null)}
        onAck={handleAck}
        onResolve={handleResolve}
        onDelete={handleDelete}
        isAdmin={isAdmin}
      />
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

const S = {
  layout:   { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content:  { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },

  summaryRow: { display: 'flex', gap: 12 },
  totalCard:  {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderTop: '2px solid var(--border-bright)', borderRadius: 10,
    padding: '14px 20px', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', minWidth: 100,
  },

  controls:    { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  searchWrap:  {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '7px 12px', minWidth: 200,
  },
  searchInput: { background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn:   {
    padding: '5px 12px', borderRadius: 20, border: '1px solid',
    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
    letterSpacing: 0.3, transition: 'all 0.15s', cursor: 'pointer',
  },
  detectBtn: {
    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.3)', borderRadius: 'var(--radius)',
    color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600,
    transition: 'all 0.15s',
  },

  panel:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flex: 1 },
  panelHeader: {
    padding: '14px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  panelTitle:  { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 },
  countBadge:  { background: 'var(--severity-critical)', color: '#fff', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700 },

  alertList:      { },
  alertRowHeader: {
    fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
    letterSpacing: 0.5, background: 'var(--bg-base)', borderLeft: '3px solid transparent',
  },
  alertRow: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 120px 130px 120px 80px',
    gap: 12, padding: '11px 20px', alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    transition: 'background 0.1s',
  },

  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: '60px 20px',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
  },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse-dot 1s infinite' },
  emptyDetectBtn: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
    padding: '6px 14px', background: 'rgba(0,212,255,0.08)',
    border: '1px solid rgba(0,212,255,0.3)', borderRadius: 'var(--radius)',
    color: 'var(--accent-cyan)', fontSize: 11, cursor: 'pointer',
  },

  // drawer
  drawerOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 100, display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 480, height: '100%', background: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    animation: 'slide-in 0.2s ease', overflowY: 'auto',
  },
  drawerHeader: {
    padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexShrink: 0,
  },
  drawerBody:    { flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 },
  drawerSection: { },
  drawerSectionTitle: {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontWeight: 700,
  },
  drawerActions: {
    padding: '16px 20px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: 10, flexShrink: 0,
  },

  metricBox:   { background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden' },
  metricRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border)' },
  metricLabel: { fontSize: 11, color: 'var(--text-muted)' },

  actionBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', background: 'transparent',
    border: '1px solid', borderRadius: 'var(--radius)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
  },
  iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' },
}

export default Alerts
