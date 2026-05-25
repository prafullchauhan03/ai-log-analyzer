import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

const Placeholder = ({ title }) => (
  <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
    <Sidebar />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Navbar onRefresh={() => {}} loading={false} lastUpdated={null} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 40, opacity: 0.2 }}>🚧</div>
        <h2 style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 16 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Phase 2/3 — Coming soon</p>
      </div>
    </div>
  </div>
)

export default Placeholder
