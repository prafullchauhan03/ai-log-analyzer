import { useEffect, useState, useRef } from 'react'
import {
  MdCircle,
  MdPause,
  MdPlayArrow,
  MdClear,
} from 'react-icons/md'

import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

const LEVEL_COLORS = {
  INFO: 'var(--accent-cyan)',
  WARNING: 'var(--accent-amber)',
  ERROR: 'var(--severity-high)',
  CRITICAL: 'var(--severity-critical)',
}

const LiveLogs = () => {
  const [logs, setLogs] = useState([])
  const [paused, setPaused] = useState(false)
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const ws = useRef(null)
  const bottomRef = useRef(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) return

    const API_URL =
      import.meta.env.VITE_API_URL || 'http://localhost:8000'

    const WS_URL = API_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')

    const connect = () => {
      ws.current = new WebSocket(
        `${WS_URL}/ws/logs?token=${token}`
      )

      ws.current.onopen = () => {
        setConnected(true)
      }

      ws.current.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000)
      }

      ws.current.onerror = () => {
        setConnected(false)
      }

      ws.current.onmessage = (e) => {
        if (pausedRef.current) return

        const log = JSON.parse(e.data)

        setLogs((prev) => [log, ...prev].slice(0, 200))
      }
    }

    connect()

    return () => {
      ws.current?.close()
    }
  }, [])

  const filtered =
    filter === 'ALL'
      ? logs
      : logs.filter((l) => l.level === filter)

  return (
    <div style={styles.layout}>
      <Sidebar />

      <div style={styles.main}>
        <Navbar
          onRefresh={() => setLogs([])}
          loading={false}
          lastUpdated={null}
        />

        <div style={styles.content}>
          <div style={styles.controls}>
            <div style={styles.connectionBadge}>
              <MdCircle
                size={8}
                color={
                  connected
                    ? 'var(--accent-green)'
                    : 'var(--severity-critical)'
                }
              />

              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: connected
                    ? 'var(--accent-green)'
                    : 'var(--severity-critical)',
                }}
              >
                {connected
                  ? 'CONNECTED'
                  : 'DISCONNECTED'}
              </span>
            </div>

            <div style={styles.filterRow}>
              {[
                'ALL',
                'INFO',
                'WARNING',
                'ERROR',
                'CRITICAL',
              ].map((level) => (
                <button
                  key={level}
                  onClick={() => setFilter(level)}
                  style={{
                    ...styles.filterBtn,
                    background:
                      filter === level
                        ? `${LEVEL_COLORS[level] || 'var(--accent-cyan)'}20`
                        : 'transparent',
                    color:
                      filter === level
                        ? LEVEL_COLORS[level] ||
                          'var(--accent-cyan)'
                        : 'var(--text-muted)',
                    borderColor:
                      filter === level
                        ? `${LEVEL_COLORS[level] || 'var(--accent-cyan)'}60`
                        : 'var(--border)',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>

            <div style={styles.actions}>
              <button
                onClick={() => setPaused((p) => !p)}
                style={styles.actionBtn}
              >
                {paused ? (
                  <>
                    <MdPlayArrow size={14} />
                    Resume
                  </>
                ) : (
                  <>
                    <MdPause size={14} />
                    Pause
                  </>
                )}
              </button>

              <button
                onClick={() => setLogs([])}
                style={styles.actionBtn}
              >
                <MdClear size={14} />
                Clear
              </button>
            </div>
          </div>

          <div style={styles.terminal}>
            <div style={styles.terminalHeader}>
              <span style={styles.terminalTitle}>
                // LIVE LOG STREAM
              </span>

              <span style={styles.logCount}>
                {filtered.length} entries
              </span>
            </div>

            <div style={styles.logList}>
              {filtered.map((log) => (
                <div
                  key={log.id}
                  style={styles.logLine}
                >
                  <span style={styles.logTime}>
                    {new Date(
                      log.timestamp
                    ).toLocaleTimeString()}
                  </span>

                  <span
                    style={{
                      ...styles.logLevel,
                      color:
                        LEVEL_COLORS[log.level] ||
                        'var(--text-muted)',
                    }}
                  >
                    [{log.level}]
                  </span>

                  <span style={styles.logService}>
                    {log.service}
                  </span>

                  <span style={styles.logMsg}>
                    {log.message}
                  </span>

                  <span style={styles.logIp}>
                    {log.ip}
                  </span>
                </div>
              ))}

              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },

  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  content: {
    flex: 1,
    overflow: 'hidden',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },

  connectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 20,
  },

  filterRow: {
    display: 'flex',
    gap: 6,
  },

  filterBtn: {
    padding: '4px 12px',
    borderRadius: 20,
    border: '1px solid',
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    letterSpacing: 0.5,
    transition: 'all 0.15s',
  },

  actions: {
    marginLeft: 'auto',
    display: 'flex',
    gap: 8,
  },

  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    fontSize: 12,
  },

  terminal: {
    flex: 1,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  terminalHeader: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  terminalTitle: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },

  logCount: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },

  logList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },

  logLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '3px 16px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    animation: 'slide-in 0.15s ease',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },

  logTime: {
    color: 'var(--text-muted)',
    flexShrink: 0,
    fontSize: 11,
  },

  logLevel: {
    fontWeight: 700,
    flexShrink: 0,
    width: 72,
  },

  logService: {
    color: 'var(--accent-purple)',
    flexShrink: 0,
    width: 130,
  },

  logMsg: {
    color: 'var(--text-primary)',
    flex: 1,
  },

  logIp: {
    color: 'var(--text-muted)',
    flexShrink: 0,
    fontSize: 11,
  },
}

export default LiveLogs