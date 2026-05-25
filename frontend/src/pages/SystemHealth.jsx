import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  MdDeviceHub, MdCheckCircle, MdWarning, MdCancel,
} from 'react-icons/md'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { getElasticsearch, getKafka, getRedis, getESTimeSeries } from '../api/infra'

// ─── Bug 1 fix: replace react-icons/si with inline SVG icons ─────────────────
// SiElasticsearch, SiApachekafka, SiRedis don't exist in react-icons v5.
// Use simple inline SVG letter-marks instead.

const EsIcon  = () => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 16, color: '#FEC514' }}>ES</span>
const KafkaIcon = () => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 16, color: '#8b9cff' }}>KF</span>
const RedisIcon = () => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 16, color: '#DC382D' }}>RD</span>

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICON = {
  green:       <MdCheckCircle color="var(--accent-green)"       size={14} />,
  yellow:      <MdWarning     color="var(--accent-amber)"       size={14} />,
  red:         <MdCancel      color="var(--severity-critical)"  size={14} />,
  healthy:     <MdCheckCircle color="var(--accent-green)"       size={14} />,
  lagging:     <MdWarning     color="var(--accent-amber)"       size={14} />,
  running:     <MdCheckCircle color="var(--accent-green)"       size={14} />,
  unavailable: <MdCancel      color="var(--severity-critical)"  size={14} />,
  unknown:     <MdWarning     color="var(--text-muted)"         size={14} />,
  error:       <MdCancel      color="var(--severity-critical)"  size={14} />,
}

const statusColor = (s) => ({
  green:       'var(--accent-green)',
  yellow:      'var(--accent-amber)',
  red:         'var(--severity-critical)',
  healthy:     'var(--accent-green)',
  running:     'var(--accent-green)',
  lagging:     'var(--accent-amber)',
  unavailable: 'var(--severity-critical)',
  unknown:     'var(--text-muted)',
  error:       'var(--severity-critical)',
}[s] || 'var(--text-muted)')

const Pill = ({ label, color }) => (
  <span style={{
    fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 10,
    fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
    background: color + '18', color, border: `1px solid ${color}40`,
  }}>
    {label}
  </span>
)

const StatRow = ({ label, value, accent = 'var(--text-primary)' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: accent, fontWeight: 600 }}>
      {value}
    </span>
  </div>
)

// Bug 5 fix: iconColor removed from SectionCard — each icon is self-coloured
const SectionCard = ({ title, IconComponent, children, badge, badgeColor }) => (
  <div style={S.card}>
    <div style={S.cardHeader}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconComponent />
        <span style={S.cardTitle}>{title}</span>
      </div>
      {badge && <Pill label={badge} color={badgeColor || statusColor(badge)} />}
    </div>
    {children}
  </div>
)

const BarMeter = ({ value, warn = 70, crit = 90 }) => {
  const pct   = Math.min(100, Math.max(0, value))
  const color = pct >= crit ? 'var(--severity-critical)' : pct >= warn ? 'var(--accent-amber)' : 'var(--accent-green)'
  return (
    <div style={{ width: '100%' }}>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
        {pct.toFixed(1)}%
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 12, color: p.color }}>
          {p.name}: <strong>{Number(p.value).toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

// Bug 4 fix: LoadingSkeleton shown while data is null
const LoadingSkeleton = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20,
    color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)', animation: 'pulse-dot 1s infinite' }} />
    Loading {label}...
  </div>
)

const OfflineBanner = ({ label }) => (
  <div style={S.offline}>
    {STATUS_ICON.unavailable}
    <span>Not reachable — check {label} in .env</span>
  </div>
)

// ─── main component ───────────────────────────────────────────────────────────

const SystemHealth = () => {
  const [es,     setEs]     = useState(null)
  const [kafka,  setKafka]  = useState(null)
  const [redis,  setRedis]  = useState(null)
  const [series, setSeries] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [esRes, kafkaRes, redisRes, seriesRes] = await Promise.allSettled([
      getElasticsearch(), getKafka(), getRedis(), getESTimeSeries(60),
    ])
    if (esRes.status     === 'fulfilled') setEs(esRes.value.data)
    if (kafkaRes.status  === 'fulfilled') setKafka(kafkaRes.value.data)
    if (redisRes.status  === 'fulfilled') setRedis(redisRes.value.data)
    if (seriesRes.status === 'fulfilled') setSeries(seriesRes.value.data?.time_series || [])
    setLastUpdated(new Date().toLocaleTimeString())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 30000)
    return () => clearInterval(t)
  }, [fetchAll])

  return (
    <div style={S.layout}>
      <Sidebar />
      <div style={S.main}>
        <Navbar onRefresh={fetchAll} loading={loading} lastUpdated={lastUpdated} />
        <div style={S.content}>

          {/* ── Elasticsearch ──────────────────────────────────────────────── */}
          <SectionCard
            title="Elasticsearch"
            IconComponent={EsIcon}
            badge={es?.status || 'unknown'}
            badgeColor={statusColor(es?.status || 'unknown')}
          >
            {es === null ? <LoadingSkeleton label="Elasticsearch" /> :
             !es.connected ? <OfflineBanner label="ES_HOST" /> : (
              <>
                {/* KPIs */}
                <div style={S.statsGrid}>
                  {[
                    { val: (es.total_docs || 0).toLocaleString(), label: 'Total Docs' },
                    { val: es.index_count || 0,                    label: 'Indices' },
                    { val: (es.health || 'unknown').toUpperCase(), label: 'Health', color: statusColor(es.health) },
                    { val: es.unassigned_shards || 0,              label: 'Unassigned Shards', color: es.unassigned_shards > 0 ? 'var(--accent-amber)' : 'var(--accent-green)' },
                  ].map(({ val, label, color }) => (
                    <div key={label} style={S.statBox}>
                      <div style={{ ...S.statVal, ...(color ? { color } : {}) }}>{val}</div>
                      <div style={S.statLabel}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Log volume chart — only if ES returned real time series */}
                {series.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.subTitle}>Log Volume — Last 60 min</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}   />
                          </linearGradient>
                          <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ff3d5a" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ff3d5a" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="time"    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                        <YAxis                   tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="logs"     name="Logs"     stroke="#00d4ff" fill="url(#logGrad)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="errors"   name="Errors"   stroke="#ff3d5a" fill="url(#errGrad)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="warnings" name="Warnings" stroke="#ffb300" fill="none"          strokeWidth={1} dot={false} strokeDasharray="4 2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Index table — Bug 3 fix: 5-col grid matches 5 columns */}
                {es.indices?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.subTitle}>Indices</div>
                    <div style={S.table}>
                      <div style={{ ...S.tableRow5, ...S.tableHead }}>
                        <span>Index</span><span>Health</span><span>Docs</span><span>Size</span><span>Pri / Rep</span>
                      </div>
                      {es.indices.map(idx => (
                        <div key={idx.name} style={S.tableRow5}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {idx.name}
                          </span>
                          <span style={{ color: statusColor(idx.health), display: 'flex', alignItems: 'center', gap: 4 }}>
                            {STATUS_ICON[idx.health] || STATUS_ICON.unknown} {idx.health}
                          </span>
                          <span>{(idx.docs || 0).toLocaleString()}</span>
                          <span>{idx.size}</span>
                          <span>{idx.primaries} / {idx.replicas}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* ── Kafka + Redis side-by-side ──────────────────────────────────── */}
          <div style={S.twoCol}>

            {/* ── Kafka ──────────────────────────────────────────────────────── */}
            <SectionCard
              title="Apache Kafka"
              IconComponent={KafkaIcon}
              badge={kafka?.status || 'unknown'}
              badgeColor={statusColor(kafka?.status || 'unknown')}
            >
              {kafka === null ? <LoadingSkeleton label="Kafka" /> :
               !kafka.connected ? <OfflineBanner label="KAFKA_BROKERS" /> : (
                <>
                  <div style={S.statsGrid}>
                    {[
                      { val: kafka.broker_count || 0, label: 'Brokers' },
                      { val: kafka.topics?.length || 0, label: 'Topics' },
                      { val: (kafka.total_lag || 0).toLocaleString(), label: 'Total Lag',
                        color: (kafka.total_lag || 0) > 1000 ? 'var(--accent-amber)' : 'var(--accent-green)' },
                      { val: kafka.consumer_groups?.length || 0, label: 'Consumer Groups' },
                    ].map(({ val, label, color }) => (
                      <div key={label} style={S.statBox}>
                        <div style={{ ...S.statVal, ...(color ? { color } : {}) }}>{val}</div>
                        <div style={S.statLabel}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Topics — Bug 3 fix: 4-col grid */}
                  {kafka.topics?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Topics</div>
                      <div style={S.table}>
                        <div style={{ ...S.tableRow4, ...S.tableHead }}>
                          <span>Topic</span><span>Partitions</span><span>Messages</span><span>Status</span>
                        </div>
                        {kafka.topics.map(t => (
                          <div key={t.topic} style={S.tableRow4}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.topic}
                            </span>
                            <span>{t.partitions}</span>
                            <span>{(t.total_messages || 0).toLocaleString()}</span>
                            <span style={{ color: statusColor(t.status) }}>{t.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Consumer group lag bar charts */}
                  {kafka.consumer_groups?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Consumer Group Lag</div>
                      {kafka.consumer_groups.map(g => (
                        <div key={g.topic} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{g.topic}</span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: g.total_lag > 1000 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                              lag: {(g.total_lag || 0).toLocaleString()}
                            </span>
                          </div>
                          {g.partitions?.length > 0 && (
                            <ResponsiveContainer width="100%" height={60}>
                              <BarChart data={g.partitions} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                <XAxis dataKey="partition" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="lag" name="Lag" fill="var(--accent-amber)" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Brokers */}
                  {kafka.brokers?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Brokers</div>
                      {kafka.brokers.map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                          background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                          <MdDeviceHub size={12} color="var(--accent-cyan)" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>
                            #{b.id} — {b.host}:{b.port}
                          </span>
                          <Pill label="online" color="var(--accent-green)" />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </SectionCard>

            {/* ── Redis ──────────────────────────────────────────────────────── */}
            <SectionCard
              title="Redis"
              IconComponent={RedisIcon}
              badge={redis?.status || 'unknown'}
              badgeColor={statusColor(redis?.status || 'unknown')}
            >
              {redis === null ? <LoadingSkeleton label="Redis" /> :
               !redis.connected ? <OfflineBanner label="REDIS_HOST" /> : (
                <>
                  <div style={S.statsGrid}>
                    {[
                      { val: `${redis.used_memory_mb} MB`, label: 'Memory Used' },
                      { val: `${((redis.hit_rate || 0) * 100).toFixed(1)}%`, label: 'Hit Rate' },
                      { val: (redis.total_keys || 0).toLocaleString(), label: 'Total Keys' },
                      { val: redis.ops_per_sec || 0, label: 'Ops / sec' },
                    ].map(({ val, label }) => (
                      <div key={label} style={S.statBox}>
                        <div style={S.statVal}>{val}</div>
                        <div style={S.statLabel}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Memory bar */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={S.subTitle}>Memory Usage</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Peak: {redis.peak_memory_mb} MB
                      </span>
                    </div>
                    <BarMeter value={redis.memory_pct || 0} warn={70} crit={90} />
                  </div>

                  {/* Stats rows */}
                  <div style={{ marginTop: 14 }}>
                    <StatRow label="Redis Version"       value={redis.redis_version || 'n/a'} />
                    <StatRow label="Uptime"              value={`${redis.uptime_hours}h`} />
                    <StatRow label="Connected Clients"   value={redis.connected_clients || 0} />
                    <StatRow label="Blocked Clients"     value={redis.blocked_clients || 0}
                      accent={redis.blocked_clients > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'} />
                    <StatRow label="Evicted Keys"        value={(redis.evicted_keys || 0).toLocaleString()}
                      accent={redis.evicted_keys > 0 ? 'var(--accent-amber)' : 'var(--text-primary)'} />
                    <StatRow label="Expired Keys"        value={(redis.expired_keys || 0).toLocaleString()} />
                    <StatRow label="Fragmentation Ratio" value={redis.fragmentation_ratio?.toFixed(2) || 'n/a'}
                      accent={redis.fragmentation_ratio > 1.5 ? 'var(--accent-amber)' : 'var(--accent-green)'} />
                  </div>

                  {/* Keyspaces — Bug 3 fix: 4-col grid */}
                  {redis.keyspaces?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Keyspaces</div>
                      <div style={S.table}>
                        <div style={{ ...S.tableRow4, ...S.tableHead }}>
                          <span>DB</span><span>Keys</span><span>Expires</span><span>Avg TTL</span>
                        </div>
                        {redis.keyspaces.map(k => (
                          <div key={k.db} style={S.tableRow4}>
                            <span>db{k.db}</span>
                            <span>{(k.keys || 0).toLocaleString()}</span>
                            <span>{(k.expires || 0).toLocaleString()}</span>
                            <span>{k.avg_ttl_ms > 0 ? `${Math.round(k.avg_ttl_ms / 1000)}s` : '∞'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Replication */}
                  {redis.replication && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Replication</div>
                      <StatRow label="Role"               value={redis.replication.role || 'n/a'} accent="var(--accent-cyan)" />
                      <StatRow label="Connected Replicas" value={redis.replication.connected_slaves || 0} />
                    </div>
                  )}

                  {/* Slow log */}
                  {redis.slow_log?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={S.subTitle}>Slow Log (top 5)</div>
                      {redis.slow_log.map(e => (
                        <div key={e.id} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 4 }}>
                          <div style={{ fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                            {e.duration_us}µs
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {e.command}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </SectionCard>

          </div>{/* end twoCol */}
        </div>
      </div>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

const S = {
  layout:  { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
  twoCol:  { display: 'flex', gap: 20, alignItems: 'flex-start' },

  card:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, flex: 1 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  cardTitle:  { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  statBox:   { background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px', textAlign: 'center' },
  statVal:   { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 },

  subTitle:  { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'var(--font-mono)', marginBottom: 8 },

  table:     { fontSize: 12, color: 'var(--text-secondary)', borderRadius: 6, overflow: 'hidden' },
  tableHead: { color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: 0.5, background: 'var(--bg-base)' },

  // Bug 3 fix: separate row templates for 4-col and 5-col tables
  tableRow4: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',       gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  tableRow5: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',   gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' },

  offline: { display: 'flex', alignItems: 'center', gap: 8, padding: 16,
    background: 'rgba(255,61,90,0.06)', border: '1px solid rgba(255,61,90,0.2)',
    borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' },
}

export default SystemHealth
