const KpiCard = ({ icon: Icon, label, value, accent, sub }) => (
  <div style={{ ...styles.card, borderTop: `2px solid ${accent}` }}>
    <div style={styles.top}>
      <span style={styles.label}>{label}</span>
      <div style={{ ...styles.iconWrap, background: `${accent}18`, color: accent }}>
        <Icon size={18} />
      </div>
    </div>
    <div style={{ ...styles.value, color: accent }}>{value}</div>
    {sub && <div style={styles.sub}>{sub}</div>}
  </div>
)

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    flex: 1,
    minWidth: 0,
    transition: 'background 0.15s',
  },
  top: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' },
  iconWrap: { padding: 8, borderRadius: 8 },
  value: { fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 },
  sub: { fontSize: 11, color: 'var(--text-muted)', marginTop: 6 },
}

export default KpiCard
