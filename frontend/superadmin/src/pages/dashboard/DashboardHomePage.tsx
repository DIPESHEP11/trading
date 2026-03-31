import { useAuthStore } from '@/store/authStore';

export default function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);

  const stats = [
    { label: 'Total Users', value: '—' },
    { label: 'Active Tenants', value: '—' },
    { label: 'Messages Sent', value: '—' },
    { label: 'Integrations', value: '2' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.first_name || 'there'} 👋</h1>
        <p className="page-subtitle">Here&apos;s what&apos;s happening across your platform.</p>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Activity</h2>
        </div>
        <div className="card-body" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
          No recent activity yet. Start by adding tenants and users.
        </div>
      </div>
    </>
  );
}
