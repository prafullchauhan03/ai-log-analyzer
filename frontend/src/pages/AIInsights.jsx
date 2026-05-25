import { useEffect, useState, useRef, useCallback } from 'react'
import {
  MdStars, MdBolt, MdTrendingUp, MdWarning,
  MdSend, MdRefresh, MdCheckCircle, MdCancel,
  MdPsychology, MdScatterPlot, MdShowChart, MdChat, MdInfo,
} from 'react-icons/md'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { getAIStatus, runAnalysis, runAnomalies, runAlertSummary, runForecast, sendChat } from '../api/ai'

// ─── constants ────────────────────────────────────────────────────────────────

const RISK_META = {
  healthy:  { color: 'var(--accent-green)',      bg: 'rgba(0,255,157,0.08)',   label: 'Healthy' },
  low:      { color: 'var(--accent-blue)',        bg: 'rgba(77,159,255,0.08)', label: 'Low Risk' },
  medium:   { color: 'var(--accent-amber)',       bg: 'rgba(255,179,0,0.08)',  label: 'Medium Risk' },
  high:     { color: '#ff7043',                   bg: 'rgba(255,112,67,0.08)', label: 'High Risk' },
  critical: { color: 'var(--severity-critical)',  bg: 'rgba(255,61,90,0.08)',  label: 'Critical' },
  unknown:  { color: 'var(--text-muted)',         bg: 'rgba(255,255,255,0.04)', label: 'Unknown' },
  caution:  { color: 'var(--accent-amber)',       bg: 'rgba(255,179,0,0.08)',  label: 'Caution' },
  warning:  { color: '#ff7043',                   bg: 'rgba(255,112,67,0.08)', label: 'Warning' },
}

const SEV_COLOR = {
  info:     'var(--accent-cyan)',
  warning:  'var(--accent-amber)',
  error:    '#ff7043',
  critical: 'var(--severity-critical)',
  low:      'var(--accent-blue)',
  medium:   'var(--accent-amber)',
  high:     '#ff7043',
  none:     'var(--accent-green)',
}

const TABS = [
  { id: 'analysis',  label: 'System Analysis', icon: MdPsychology },
  { id: 'anomalies', label: 'Anomaly Detection', icon: MdScatterPlot },
  { id: 'forecast',  label: 'Trend Forecast', icon: MdShowChart },
  { id: 'alerts',    label: 'Alert Summary', icon: MdWarning },
  { id: 'chat',      label: 'AI Assistant', icon: MdChat },
]

// ─── shared sub-components ────────────────────────────────────────────────────

const RiskPill = ({ level }) => {
  const m = RISK_META[level] || RISK_META.unknown
  return (
    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
      letterSpacing: 0.8, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
      background: m.bg, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}

const SevDot = ({ sev }) => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    display: 'inline-block', background: SEV_COLOR[sev] || 'var(--text-muted)' }} />
)

const LoadingCard = ({ label }) => (
  <div style={S.loadingCard}>
    <div style={S.spinnerWrap}>
      <div style={S.spinner} />
    </div>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
      {label || 'Analysing with Groq AI…'}
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
      llama-3.3-70b-versatile
    </div>
  </div>
)

const ErrorCard = ({ message, onRetry }) => (
  <div style={S.errorCard}>
    <MdCancel size={24} color="var(--severity-critical)" />
    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message}</div>
    {onRetry && (
      <button onClick={onRetry} style={S.retryBtn}>
        <MdRefresh size={13} /> Retry
      </button>
    )}
  </div>
)

const NoKeyCard = () => (
  <div style={S.noKeyCard}>
    <MdStars size={32} color="var(--accent-cyan)" style={{ opacity: 0.6 }} />
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Groq API Key Required</div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
      Add your free Groq API key to <code style={S.inlineCode}>.env</code> to enable AI-powered analysis.
    </div>
    <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={S.getKeyBtn}>
      <MdStars size={14} /> Get free API key →
    </a>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
      GROQ_API_KEY=your-key-here
    </div>
  </div>
)

// ─── panels ───────────────────────────────────────────────────────────────────

const AnalysisPanel = ({ data, loading, error, onRun }) => {
  if (loading) return <LoadingCard label="Analysing system health…" />
  if (error)   return <ErrorCard message={error} onRetry={onRun} />
  if (!data)   return (
    <div style={S.emptyPanel}>
      <MdPsychology size={36} color="var(--accent-cyan)" style={{ opacity: 0.4 }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Run Analysis" to get AI-powered system insights</div>
      <button onClick={onRun} style={S.runBtn}><MdBolt size={14} /> Run Analysis</button>
    </div>
  )

  return (
    <div style={S.panelBody}>
      {/* Summary */}
      <div style={{ ...S.summaryBox, background: (RISK_META[data.risk_level] || RISK_META.unknown).bg,
        border: `1px solid ${(RISK_META[data.risk_level] || RISK_META.unknown).color}30` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={S.sectionLabel}>Executive Summary</span>
          <RiskPill level={data.risk_level} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7 }}>{data.summary}</p>
      </div>

      {/* Findings */}
      {data.findings?.length > 0 && (
        <div>
          <div style={S.sectionLabel}>Findings ({data.findings.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {data.findings.map((f, i) => (
              <div key={i} style={{ ...S.findingCard, borderLeft: `3px solid ${SEV_COLOR[f.severity] || 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <SevDot sev={f.severity} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)',
                    background: 'rgba(0,212,255,0.1)', padding: '1px 7px', borderRadius: 10, marginLeft: 'auto' }}>
                    {f.service}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{f.detail}</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MdBolt size={12} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--accent-amber)' }}>{f.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div>
          <div style={S.sectionLabel}>Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {data.recommendations.map((r, i) => (
              <div key={i} style={S.recCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 7px',
                    borderRadius: 10, background: SEV_COLOR[r.priority] + '18', color: SEV_COLOR[r.priority] || 'var(--text-muted)' }}>
                    {r.priority?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.action}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={S.generatedAt}>
        Generated by {data.model} · {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : ''}
      </div>
    </div>
  )
}

const AnomalyPanel = ({ data, loading, error, onRun }) => {
  if (loading) return <LoadingCard label="Scanning for anomalies…" />
  if (error)   return <ErrorCard message={error} onRetry={onRun} />
  if (!data)   return (
    <div style={S.emptyPanel}>
      <MdScatterPlot size={36} color="var(--accent-purple)" style={{ opacity: 0.4 }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Run Anomaly Scan" to detect unusual patterns</div>
      <button onClick={onRun} style={{ ...S.runBtn, background: 'rgba(182,123,255,0.15)', color: 'var(--accent-purple)' }}>
        <MdScatterPlot size={14} /> Run Anomaly Scan
      </button>
    </div>
  )

  return (
    <div style={S.panelBody}>
      {/* Score header */}
      <div style={{ ...S.summaryBox, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 42, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: data.overall_anomaly_score > 0.6 ? 'var(--severity-critical)' :
                   data.overall_anomaly_score > 0.3 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
            {((data.overall_anomaly_score || 0) * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
            ANOMALY SCORE
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
            {data.anomaly_count || 0} ANOMALIES DETECTED
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{data.narrative}</p>
        </div>
      </div>

      {data.anomalies?.length > 0 ? (
        <div>
          <div style={S.sectionLabel}>Detected Anomalies</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {data.anomalies.map((a, i) => (
              <div key={i} style={{ ...S.findingCard, borderLeft: `3px solid ${SEV_COLOR[a.severity] || 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SevDot sev={a.severity} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {a.metric}
                    </span>
                  </div>
                  {a.deviation_pct > 0 && (
                    <span style={{ fontSize: 10, color: SEV_COLOR[a.severity], fontFamily: 'var(--font-mono)' }}>
                      +{a.deviation_pct.toFixed(1)}% deviation
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.8 }}>OBSERVED</div>
                    <div style={{ fontSize: 12, color: SEV_COLOR[a.severity], fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{a.observed}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.8 }}>EXPECTED</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{a.expected}</div>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px',
          background: 'rgba(0,255,157,0.06)', borderRadius: 8, border: '1px solid rgba(0,255,157,0.2)' }}>
          <MdCheckCircle size={18} color="var(--accent-green)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No anomalies detected — all metrics within normal ranges</span>
        </div>
      )}

      <div style={S.generatedAt}>
        Generated by {data.model} · {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : ''}
      </div>
    </div>
  )
}

const ForecastPanel = ({ data, loading, error, onRun }) => {
  if (loading) return <LoadingCard label="Generating 1-hour forecast…" />
  if (error)   return <ErrorCard message={error} onRetry={onRun} />
  if (!data)   return (
    <div style={S.emptyPanel}>
      <MdShowChart size={36} color="var(--accent-amber)" style={{ opacity: 0.4 }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Get a 1-hour trend forecast for all key metrics</div>
      <button onClick={onRun} style={{ ...S.runBtn, background: 'rgba(255,179,0,0.15)', color: 'var(--accent-amber)' }}>
        <MdShowChart size={14} /> Run Forecast
      </button>
    </div>
  )

  return (
    <div style={S.panelBody}>
      <div style={{ ...S.summaryBox, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={S.sectionLabel}>1-Hour Outlook</div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginTop: 6 }}>{data.narrative}</p>
        </div>
        <RiskPill level={data.overall_outlook} />
      </div>

      {data.forecasts?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.forecasts.map((f, i) => {
            const trendIcon = { increasing: '↑', decreasing: '↓', stable: '→', volatile: '↕' }[f.trend] || '→'
            const trendColor = {
              increasing: f.risk === 'none' || f.risk === 'low' ? 'var(--accent-green)' : 'var(--severity-critical)',
              decreasing: 'var(--accent-cyan)', stable: 'var(--text-muted)', volatile: 'var(--accent-amber)',
            }[f.trend] || 'var(--text-muted)'

            return (
              <div key={i} style={S.forecastRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 20, color: trendColor, fontFamily: 'var(--font-mono)', fontWeight: 700, width: 24, textAlign: 'center' }}>
                    {trendIcon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.metric}</span>
                      <RiskPill level={f.risk} />
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Now: <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{f.current_value}</span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        +1h: <span style={{ color: trendColor, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{f.forecast_1h}</span>
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.recommendation}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={S.generatedAt}>
        Generated by {data.model} · {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : ''}
      </div>
    </div>
  )
}

const AlertSummaryPanel = ({ data, loading, error, onRun }) => {
  if (loading) return <LoadingCard label="Summarising alert backlog…" />
  if (error)   return <ErrorCard message={error} onRetry={onRun} />
  if (!data)   return (
    <div style={S.emptyPanel}>
      <MdWarning size={36} color="var(--severity-critical)" style={{ opacity: 0.4 }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Get AI triage recommendations for open alerts</div>
      <button onClick={onRun} style={{ ...S.runBtn, background: 'rgba(255,61,90,0.12)', color: 'var(--severity-critical)' }}>
        <MdWarning size={14} /> Summarise Alerts
      </button>
    </div>
  )

  return (
    <div style={S.panelBody}>
      <div style={S.summaryBox}>
        <div style={S.sectionLabel}>Alert Situation</div>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, marginTop: 8 }}>{data.summary}</p>
      </div>

      {data.top_concern && (
        <div style={{ padding: '14px 16px', background: 'rgba(255,61,90,0.06)',
          border: '1px solid rgba(255,61,90,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--severity-critical)', fontFamily: 'var(--font-mono)',
            letterSpacing: 1, marginBottom: 6 }}>TOP CONCERN</div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{data.top_concern}</p>
        </div>
      )}

      {data.pattern && (
        <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 6 }}>
            PATTERN DETECTED
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{data.pattern}</p>
        </div>
      )}

      {data.suggested_triage?.length > 0 && (
        <div>
          <div style={S.sectionLabel}>Suggested Triage Order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {data.suggested_triage.map((t, i) => (
              <div key={i} style={{ ...S.findingCard, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,212,255,0.12)',
                  color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {t.order}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{t.alert_title}</div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={S.generatedAt}>
        Generated by {data.model} · {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : ''}
      </div>
    </div>
  )
}

const ChatPanel = ({ aiAvailable }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I have access to your live system metrics — Elasticsearch, Kafka, Redis, and your current alerts. Ask me anything about your infrastructure.' }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')

    const userMsg = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Pass history (exclude the opening greeting)
      const history = messages.slice(1).concat(userMsg)
      const res = await sendChat(q, history)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.response?.data?.detail || err.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const SUGGESTIONS = [
    'What is the current health of my Elasticsearch cluster?',
    'Is my Kafka consumer lag within acceptable limits?',
    'What is causing the highest risk right now?',
    'Should I be worried about Redis memory usage?',
    'Which alert should I tackle first?',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      {!aiAvailable && (
        <div style={{ margin: '0 0 12px', padding: '10px 14px', background: 'rgba(255,179,0,0.08)',
          border: '1px solid rgba(255,179,0,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--accent-amber)', display: 'flex', gap: 8 }}>
          <MdInfo size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          AI chat requires GROQ_API_KEY — set it in .env to enable real responses.
        </div>
      )}

      {/* Message history */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0', minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={S.aiBubbleIcon}><MdStars size={14} color="var(--accent-cyan)" /></div>
            )}
            <div style={{
              ...S.bubble,
              ...(m.role === 'user' ? S.userBubble : S.aiBubble),
              maxWidth: '78%',
            }}>
              <p style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={S.aiBubbleIcon}><MdStars size={14} color="var(--accent-cyan)" /></div>
            <div style={{ ...S.bubble, ...S.aiBubble }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(n => (
                  <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)',
                    animation: `pulse-dot 1.2s ${n * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 0.8, marginBottom: 8 }}>
            SUGGESTED QUESTIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setInput(s)} style={S.suggestionBtn}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={S.inputRow}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your system… (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={S.chatInput}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={S.sendBtn}>
          <MdSend size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const AIInsights = () => {
  const [activeTab,   setActiveTab]   = useState('analysis')
  const [aiAvailable, setAiAvailable] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Per-tab state
  const [analysisData,  setAnalysisData]  = useState(null)
  const [anomalyData,   setAnomalyData]   = useState(null)
  const [forecastData,  setForecastData]  = useState(null)
  const [alertSumData,  setAlertSumData]  = useState(null)

  const [analysisLoading,  setAnalysisLoading]  = useState(false)
  const [anomalyLoading,   setAnomalyLoading]   = useState(false)
  const [forecastLoading,  setForecastLoading]  = useState(false)
  const [alertSumLoading,  setAlertSumLoading]  = useState(false)

  const [analysisError,  setAnalysisError]  = useState(null)
  const [anomalyError,   setAnomalyError]   = useState(null)
  const [forecastError,  setForecastError]  = useState(null)
  const [alertSumError,  setAlertSumError]  = useState(null)

  // Check AI availability on mount
  useEffect(() => {
    getAIStatus()
      .then(res => setAiAvailable(res.data.available))
      .catch(() => setAiAvailable(false))
  }, [])

  const runTabAction = useCallback(async (tab) => {
    if (!aiAvailable) return

    const runners = {
      analysis: { set: setAnalysisData,  setLoading: setAnalysisLoading,  setError: setAnalysisError,  fn: runAnalysis },
      anomalies: { set: setAnomalyData,  setLoading: setAnomalyLoading,   setError: setAnomalyError,   fn: runAnomalies },
      forecast:  { set: setForecastData, setLoading: setForecastLoading,  setError: setForecastError,  fn: runForecast },
      alerts:    { set: setAlertSumData, setLoading: setAlertSumLoading,  setError: setAlertSumError,  fn: runAlertSummary },
    }
    const r = runners[tab]
    if (!r) return

    r.setLoading(true)
    r.setError(null)
    try {
      const res = await r.fn()
      r.set(res.data)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      r.setError(err.response?.data?.detail || err.message || 'AI request failed')
    } finally {
      r.setLoading(false)
    }
  }, [aiAvailable])

  const panelProps = {
    analysis:  { data: analysisData,  loading: analysisLoading,  error: analysisError,  onRun: () => runTabAction('analysis') },
    anomalies: { data: anomalyData,   loading: anomalyLoading,   error: anomalyError,   onRun: () => runTabAction('anomalies') },
    forecast:  { data: forecastData,  loading: forecastLoading,  error: forecastError,  onRun: () => runTabAction('forecast') },
    alerts:    { data: alertSumData,  loading: alertSumLoading,  error: alertSumError,  onRun: () => runTabAction('alerts') },
  }

  return (
    <div style={S.layout}>
      <Sidebar />
      <div style={S.main}>
        <Navbar
          onRefresh={() => runTabAction(activeTab)}
          loading={analysisLoading || anomalyLoading || forecastLoading || alertSumLoading}
          lastUpdated={lastUpdated}
        />
        <div style={S.content}>

          {/* Header */}
          <div style={S.pageHeader}>
            <div style={S.pageHeaderLeft}>
              <div style={S.aiIcon}><MdStars size={20} color="var(--accent-cyan)" /></div>
              <div>
                <h1 style={S.pageTitle}>AI Insights</h1>
                <p style={S.pageSubtitle}>Powered by Groq · llama-3.3-70b-versatile</p>
              </div>
            </div>
            {aiAvailable !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                background: aiAvailable ? 'rgba(0,255,157,0.08)' : 'rgba(255,61,90,0.08)',
                border: `1px solid ${aiAvailable ? 'rgba(0,255,157,0.3)' : 'rgba(255,61,90,0.3)'}`,
                borderRadius: 20 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%',
                  background: aiAvailable ? 'var(--accent-green)' : 'var(--severity-critical)',
                  animation: aiAvailable ? 'pulse-dot 2s infinite' : 'none' }} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: 0.8,
                  color: aiAvailable ? 'var(--accent-green)' : 'var(--severity-critical)' }}>
                  {aiAvailable ? 'GROQ CONNECTED' : 'API KEY REQUIRED'}
                </span>
              </div>
            )}
          </div>

          {aiAvailable === false ? <NoKeyCard /> : (
            <div style={S.workspace}>
              {/* Tabs */}
              <div style={S.tabs}>
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      ...S.tab,
                      ...(activeTab === id ? S.tabActive : {}),
                    }}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                    {/* Show run button on active tab header */}
                    {activeTab === id && id !== 'chat' && (
                      <div
                        onClick={e => { e.stopPropagation(); runTabAction(id) }}
                        style={S.tabRunBtn}
                        title={`Re-run ${label}`}
                      >
                        <MdRefresh size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={S.tabContent}>
                {activeTab === 'analysis'  && <AnalysisPanel     {...panelProps.analysis} />}
                {activeTab === 'anomalies' && <AnomalyPanel      {...panelProps.anomalies} />}
                {activeTab === 'forecast'  && <ForecastPanel     {...panelProps.forecast} />}
                {activeTab === 'alerts'    && <AlertSummaryPanel {...panelProps.alerts} />}
                {activeTab === 'chat'      && <ChatPanel aiAvailable={aiAvailable} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────

const S = {
  layout:   { display: 'flex', height: '100vh', overflow: 'hidden' },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content:  { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },

  pageHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageHeaderLeft:{ display: 'flex', alignItems: 'center', gap: 12 },
  aiIcon:        { width: 44, height: 44, borderRadius: 12, background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pageTitle:     { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  pageSubtitle:  { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: '2px 0 0' },

  workspace:  { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  tabs:       { display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', overflowX: 'auto' },
  tab:        { display: 'flex', alignItems: 'center', gap: 7, padding: '12px 18px', fontSize: 12, fontWeight: 500,
    color: 'var(--text-muted)', background: 'none', border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 },
  tabActive:  { color: 'var(--accent-cyan)', borderBottom: '2px solid var(--accent-cyan)', background: 'rgba(0,212,255,0.05)' },
  tabRunBtn:  { marginLeft: 4, width: 18, height: 18, borderRadius: 4, background: 'rgba(0,212,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)',
    cursor: 'pointer', transition: 'background 0.15s' },

  tabContent: { padding: 24, flex: 1, overflowY: 'auto' },
  panelBody:  { display: 'flex', flexDirection: 'column', gap: 16 },

  sectionLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: 1.2, fontFamily: 'var(--font-mono)' },

  summaryBox:  { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' },
  findingCard: { background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' },
  recCard:     { background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' },
  forecastRow: { background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' },

  generatedAt: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
    textAlign: 'right', paddingTop: 8, borderTop: '1px solid var(--border)' },

  emptyPanel: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '60px 20px', color: 'var(--text-muted)' },
  runBtn:     { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', marginTop: 4,
    background: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)',
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s' },

  loadingCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 20px' },
  spinnerWrap: { width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,212,255,0.08)',
    border: '2px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner:     { width: 20, height: 20, border: '2px solid transparent', borderTop: '2px solid var(--accent-cyan)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  errorCard:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    padding: '40px 20px', background: 'rgba(255,61,90,0.05)', borderRadius: 8, border: '1px solid rgba(255,61,90,0.15)' },
  retryBtn:    { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12,
    background: 'rgba(255,61,90,0.1)', color: 'var(--severity-critical)', border: '1px solid rgba(255,61,90,0.3)',
    borderRadius: 6, cursor: 'pointer' },

  noKeyCard:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: '80px 20px' },
  getKeyBtn:   { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', marginTop: 4,
    background: 'rgba(0,212,255,0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)',
    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  inlineCode:  { fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-elevated)',
    padding: '1px 6px', borderRadius: 4, color: 'var(--text-code)' },

  // Chat
  bubble:      { padding: '10px 14px', borderRadius: 12, maxWidth: '100%' },
  aiBubble:    { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderTopLeftRadius: 2 },
  userBubble:  { background: 'rgba(0,212,255,0.12)', color: 'var(--text-primary)',
    border: '1px solid rgba(0,212,255,0.2)', borderTopRightRadius: 2 },
  aiBubbleIcon:{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' },

  inputRow:   { display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' },
  chatInput:  { flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13,
    resize: 'none', outline: 'none', fontFamily: 'var(--font-sans)', lineHeight: 1.5 },
  sendBtn:    { width: 42, height: 42, borderRadius: 10, background: 'var(--accent-cyan)',
    border: 'none', color: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0 },

  suggestionBtn: { padding: '5px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 20, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' },
}

export default AIInsights
