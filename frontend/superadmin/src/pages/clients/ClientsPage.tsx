import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientApi } from '@/api/clientApi';
import toast from 'react-hot-toast';

interface Client {
  id: number;
  name: string;
  subtitle: string;
  slug: string;
  plan: string;
  business_model: string;
  contact_email: string;
  is_active: boolean;
  logo_url: string | null;
  created_on: string;
  module_crm: boolean;
  module_products: boolean;
  module_stock: boolean;
  module_orders: boolean;
  module_warehouse: boolean;
  module_invoices: boolean;
  module_dispatch: boolean;
  module_tracking: boolean;
  module_manufacturing: boolean;
  module_hr: boolean;
  module_analytics: boolean;
}

const MODULE_KEYS = [
  'module_crm', 'module_products', 'module_stock', 'module_orders',
  'module_warehouse', 'module_invoices', 'module_dispatch',
  'module_tracking', 'module_manufacturing', 'module_hr', 'module_analytics',
];

const PLAN_COLORS: Record<string, string> = {
  free: 'badge-neutral',
  basic: 'badge-primary',
  pro: 'badge-warning',
  enterprise: 'badge-success',
};

const BM_LABELS: Record<string, string> = {
  b2b: 'B2B', b2c: 'B2C', d2c: 'D2C', hybrid: 'Hybrid',
  marketplace: 'Marketplace', saas: 'SaaS', services: 'Services', other: 'Other',
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await clientApi.list();
        setClients(res.data?.tenants || res.data || []);
      } catch {
        toast.error('Failed to load clients');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact_email?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = !filterPlan || c.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete client "${name}"?`)) return;
    try {
      await clientApi.delete(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
      toast.success('Client deleted.');
    } catch {
      toast.error('Failed to delete client.');
    }
  };

  const moduleCount = (c: Client) =>
    MODULE_KEYS.reduce((acc, k) => acc + (c[k as keyof Client] ? 1 : 0), 0);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your registered tenants and their configurations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard/clients/register')}>
          + Register New Client
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 28 }}>
        {[
          { label: 'Total Clients', value: clients.length },
          { label: 'Active', value: clients.filter((c) => c.is_active).length },
          { label: 'Enterprise', value: clients.filter((c) => c.plan === 'enterprise').length },
          { label: 'Pro', value: clients.filter((c) => c.plan === 'pro').length },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ maxWidth: 280 }}
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" style={{ maxWidth: 160 }} value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No Clients Yet</div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>Register your first client to get started.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/clients/register')}>
              + Register New Client
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Business Model</th>
                  <th>Plan</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {c.logo_url ? (
                          <img src={c.logo_url} alt={c.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--color-border)', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                            {c.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                          {c.subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.subtitle}</div>}
                          {c.contact_email && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.contact_email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{BM_LABELS[c.business_model] || c.business_model}</span>
                    </td>
                    <td>
                      <span className={`badge ${PLAN_COLORS[c.plan] || 'badge-neutral'}`}>{c.plan?.toUpperCase()}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: 'var(--color-primary)', width: `${(moduleCount(c) / 11) * 100}%`, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{moduleCount(c)}/11</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {c.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                      {new Date(c.created_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/dashboard/clients/register?tenantId=${c.id}`)}
                          title="Assign client admin"
                        >
                          Assign admin
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                          title="View details"
                        >
                          👁️
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Delete client"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
