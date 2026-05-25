import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  MdStorage, MdError, MdDns, MdSecurity,
  MdCheckCircle, MdWarning, MdCancel
} from 'react-icons/md'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import KpiCard from '../components/DashboardCards'


// ── Letter-mark icons (react-icons/si not available in v5) ───────────────────
const EsIcon    = ({ size = 16, color = 'var(--accent-cyan)'  }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: size, color, lineHeight: 1 }}>ES</span>
)
const KafkaIcon = ({ size = 16, color = 'var(--accent-amber)' }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: size, color, lineHeight: 1 }}>KF</span>
)
const RedisIcon = ({ size = 16, color = '#DC382D'             }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: size, color, lineHeight: 1 }}>RD</span>
)

const SEVERITY_COLOR = {
  critical: 'var(--severity-critical)',
  high: 'var(--severity-high)',
  medium: 'var(--severity-medium)',
  low: 'var(--severity-low)',
}

const SERVER_STATUS_ICON = {
  healthy:  <MdCheckCircle color="var(--accent-green)"  size={14} />,
  warning:  <MdWarning     color="var(--accent-amber)"  size={14} />,
  critical: <MdCancel      color="var(--severity-critical)" size={14} />,
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ fontSize: 12, color: p.color }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Connection badge ──────────────────────────────────────────────────────────
const ConnBadge = ({ connected }) => (
  <span style={{
    fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px',
    borderRadius: 10, fontWeight: 700, letterSpacing: 0.5,
    background: connected ? 'rgba(0,255,157,0.12)' : 'rgba(120,120,120,0.15)',
    color: connected ? 'var(--accent-green)' : 'var(--text-muted)',
  }}>
    {connected ? 'LIVE' : 'MOCK'}
  </span>
)

// ── Infra service card ────────────────────────────────────────────────────────
const InfraCard = ({ icon: Icon, name, connected, rows, accent }) => (
  <div style={{ ...styles.infraCard, borderTop: `2px solid ${accent}` }}>
    <div style={styles.infraCardHeader}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={accent} />
        <span style={{ ...styles.infraCardName, color: accent }}>{name}</span>
      </div>
      <ConnBadge connected={connected} />
    </div>
    <div style={styles.infraCardRows}>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.infraRow}>
          <span style={styles.infraRowLabel}>{label}</span>
          <span style={styles.infraRowValue}>{value}</span>
        </div>
      ))}
    </div>
  </div>
)

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchStats = useCallback(async (showSpinner = false) => {
    // Only show full-page spinner on first load — background refreshes keep
    // existing data visible and just update the "last updated" timestamp
    if (showSpinner) setLoading(true)
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      console.error(err)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(true)                              // first load — show spinner
    const id = setInterval(() => fetchStats(false), 30000)  // background — silent
    return () => clearInterval(id)
  }, [fetchStats])

  const es    = stats?.elasticsearch_status || {}
  const kafka = stats?.kafka_status || {}
  const redis = stats?.redis_status || {}

  return (
    <div style={styles.layout}>
      <Sidebar />
      <div style={styles.main}>
        <Navbar onRefresh={fetchStats} loading={loading} lastUpdated={lastUpdated} />
        <div style={styles.content}>
          {loading && !stats ? (
            <div style={styles.loadingState}>
              <div style={styles.loadingDot} />
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING METRICS...</span>
            </div>
          ) : stats ? (
            <>
              {/* KPI Row */}
              <div style={styles.kpiRow}>
                <KpiCard icon={MdStorage}  label="Logs Processed"  value={stats.kpis.logs_processed.toLocaleString()} accent="var(--accent-cyan)"            sub={es.connected ? '● Live from Elasticsearch' : '○ Mock data'} />
                <KpiCard icon={MdError}    label="Critical Errors"  value={stats.kpis.critical_errors}                  accent="var(--severity-critical)"       sub="Last hour" />
                <KpiCard icon={MdDns}      label="Active Servers"   value={stats.kpis.active_servers}                   accent="var(--accent-green)"            sub={es.connected ? `${es.indices} ES indices` : 'Mock'} />
                <KpiCard icon={MdSecurity} label="AI Threat Score"  value={stats.kpis.ai_threat_score.toFixed(2)}       accent="var(--accent-amber)"            sub={stats.kpis.ai_threat_score > 0.6 ? '⚠ Elevated' : '✓ Normal'} />
              </div>

              {/* Charts Row */}
              <div style={styles.chartsRow}>
                <div style={styles.chartCard}>
                  <div style={styles.chartTitleRow}>
                    <h3 style={styles.chartTitle}>Log Volume & Error Trend</h3>
                    <ConnBadge connected={es.connected} />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stats.time_series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="logsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#ff3d5a" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ff3d5a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="logs"   stroke="#00d4ff" fill="url(#logsGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="errors" stroke="#ff3d5a" fill="url(#errGrad)"  strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={styles.chartCard}>
                  <h3 style={styles.chartTitle}>Warning Distribution</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.time_series.slice(-12)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="warnings" fill="var(--accent-amber)"          radius={[3,3,0,0]} />
                      <Bar dataKey="errors"   fill="var(--severity-critical)"     radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Infra Cards Row — real service data */}
              <div style={styles.infraRow3}>
                <InfraCard
                  icon={EsIcon}
                  name="Elasticsearch"
                  connected={es.connected}
                  accent="var(--accent-cyan)"
                  rows={[
                    ['Cluster Health',   es.health?.toUpperCase() || '—'],
                    ['Total Documents',  (es.docs || 0).toLocaleString()],
                    ['Active Indices',   es.indices || 0],
                    ['Unassigned Shards', es.unassigned_shards ?? '—'],
                  ]}
                />
                <InfraCard
                  icon={KafkaIcon}
                  name="Kafka"
                  connected={kafka.connected}
                  accent="var(--accent-amber)"
                  rows={[
                    ['Brokers',       kafka.broker_count || '—'],
                    ['Topics',        kafka.topics || '—'],
                    ['Consumer Groups', kafka.consumers || '—'],
                    ['Total Lag',     (kafka.lag || 0).toLocaleString()],
                    ['Lag Status',    kafka.lag_status?.toUpperCase() || '—'],
                  ]}
                />
                <InfraCard
                  icon={RedisIcon}
                  name="Redis"
                  connected={redis.connected}
                  accent="var(--severity-critical)"
                  rows={[
                    ['Memory Used',   `${redis.used_memory_mb || 0} MB${redis.memory_pct ? ` (${redis.memory_pct}%)` : ''}`],
                    ['Total Keys',    (redis.keys || 0).toLocaleString()],
                    ['Hit Rate',      redis.hit_rate ? `${(redis.hit_rate * 100).toFixed(1)}%` : '—'],
                    ['Ops / sec',     redis.ops_per_sec || '—'],
                  ]}
                />
              </div>

              {/* Bottom Row */}
              <div style={styles.bottomRow}>
                {/* Alerts */}
                <div style={{ ...styles.panel, flex: 1.2 }}>
                  <h3 style={styles.panelTitle}>
                    Recent Alerts
                    <span style={styles.alertCount}>{stats.alerts.length}</span>
                  </h3>
                  <div style={styles.alertList}>
                    {stats.alerts.map((a) => (
                      <div key={a.id} style={styles.alertItem}>
                        <div style={{ ...styles.severityPill, background: `${SEVERITY_COLOR[a.severity]}20`, color: SEVERITY_COLOR[a.severity] }}>
                          {a.severity.toUpperCase()}
                        </div>
                        <div style={styles.alertMsg}>{a.message}</div>
                        <div style={styles.alertTime}>{a.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Server Health */}
                <div style={{ ...styles.panel, flex: 1 }}>
                  <h3 style={styles.panelTitle}>Server Health</h3>
                  <div style={styles.serverList}>
                    {stats.server_health.map((s) => (
                      <div key={s.name} style={styles.serverItem}>
                        <div style={styles.serverName}>
                          {SERVER_STATUS_ICON[s.status]}
                          <span style={styles.serverNameText}>{s.name}</span>
                        </div>
                        <div style={styles.serverBars}>
                          <div style={styles.metricBar}>
                            <span style={styles.metricLabel}>CPU</span>
                            <div style={styles.barTrack}>
                              <div style={{ ...styles.barFill, width: `${s.cpu}%`, background: s.cpu > 80 ? 'var(--severity-critical)' : s.cpu > 60 ? 'var(--accent-amber)' : 'var(--accent-green)' }} />
                            </div>
                            <span style={styles.metricVal}>{s.cpu}%</span>
                          </div>
                          <div style={styles.metricBar}>
                            <span style={styles.metricLabel}>MEM</span>
                            <div style={styles.barTrack}>
                              <div style={{ ...styles.barFill, width: `${s.memory}%`, background: s.memory > 80 ? 'var(--severity-critical)' : 'var(--accent-cyan)' }} />
                            </div>
                            <span style={styles.metricVal}>{s.memory}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const styles = {
  layout:      { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:        { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content:     { flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 },
  loadingState:{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingDot:  { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse-dot 1s infinite' },
  kpiRow:      { display: 'flex', gap: 16 },
  chartsRow:   { display: 'flex', gap: 16 },
  chartCard:   { flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' },
  chartTitleRow:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  chartTitle:  { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' },
  infraRow3:   { display: 'flex', gap: 16 },
  infraCard:   { flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' },
  infraCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  infraCardName:   { fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' },
  infraCardRows:   { display: 'flex', flexDirection: 'column', gap: 7 },
  infraRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  infraRowLabel:{ fontSize: 11, color: 'var(--text-muted)' },
  infraRowValue:{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 },
  bottomRow:   { display: 'flex', gap: 16 },
  panel:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', overflow: 'hidden' },
  panelTitle:  { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  alertCount:  { background: 'var(--severity-critical)', color: '#fff', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700 },
  alertList:   { display: 'flex', flexDirection: 'column', gap: 8 },
  alertItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 },
  severityPill:{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 10, fontWeight: 700, flexShrink: 0, letterSpacing: 0.5 },
  alertMsg:    { flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  alertTime:   { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 },
  serverList:  { display: 'flex', flexDirection: 'column', gap: 10 },
  serverItem:  { display: 'flex', alignItems: 'center', gap: 12 },
  serverName:  { display: 'flex', alignItems: 'center', gap: 6, width: 90, flexShrink: 0 },
  serverNameText: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' },
  serverBars:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  metricBar:   { display: 'flex', alignItems: 'center', gap: 6 },
  metricLabel: { fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 24 },
  barTrack:    { flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 2, transition: 'width 0.5s ease' },
  metricVal:   { fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 28, textAlign: 'right' },
}

export default Dashboard
