import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi, configApi } from '@/api/businessApi';
import type { TenantConfig, TenantModules } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';

interface ModuleMeta {
  key: keyof TenantModules;
  label: string;
  icon: string;
  desc: string;
  route: string;
}

const ALL_MODULES: ModuleMeta[] = [
  { key: 'crm',           label: 'CRM',           icon: '🎯', desc: 'Leads, customers & sales pipeline',     route: '/dashboard/crm/leads'  },
  { key: 'products',      label: 'Products',      icon: '📦', desc: 'Catalogue, categories & custom fields', route: '/dashboard/products'   },
  { key: 'stock',         label: 'Stock',         icon: '🏭', desc: 'Inventory levels & warehouses',         route: '/dashboard/stock'      },
  { key: 'orders',        label: 'Orders',        icon: '📋', desc: 'Order processing & approvals',          route: '/dashboard/orders'     },
  { key: 'warehouse',     label: 'Warehouse',     icon: '🏬', desc: 'Multi-warehouse management',            route: '/dashboard/stock'      },
  { key: 'invoices',      label: 'Invoices',      icon: '🧾', desc: 'Billing, invoices & dispatch',          route: '/dashboard/invoices'   },
  { key: 'dispatch',      label: 'Dispatch',      icon: '🚚', desc: 'Shipping stickers & courier tracking',  route: '/dashboard/invoices'   },
  { key: 'tracking',      label: 'Tracking',      icon: '📍', desc: 'Real-time courier tracking',            route: '/dashboard/invoices'   },
  { key: 'manufacturing', label: 'Manufacturing', icon: '⚙️', desc: 'Production & bill of materials',        route: '/dashboard'            },
  { key: 'hr',            label: 'HR',            icon: '👥', desc: 'Employees, experience & documents',     route: '/dashboard/employees'  },
  { key: 'analytics',     label: 'Analytics',     icon: '📊', desc: 'Reports & dashboard insights',          route: '/dashboard'            },
];

interface MonthlyPoint {
  month: string;
  count: number;
}

interface DashboardStats {
  leads:     { total: number; new: number; this_month?: number };
  orders:    { total: number; pending: number; this_month?: number };
  products:  { total: number };
  employees: { total: number; active: number };
  month_summary?: { leads: number; orders: number; month: string };
  monthly?: { leads: MonthlyPoint[]; orders: MonthlyPoint[] };
}

function formatMonth(ym: string) {
  try {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1);
    return format(d, 'MMM yy');
  } catch {
    return ym;
  }
}

export default function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loadingStats, setLoadingStats]   = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    dashboardApi.stats()
      .then((res: unknown) => {
        const d = (res as { data?: DashboardStats }).data ?? (res as DashboardStats);
        if (d) setStats(d);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));

    configApi.get()
      .then((res: unknown) => {
        const d = (res as { data?: TenantConfig }).data ?? (res as TenantConfig);
        if (d) setConfig(d);
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  const mods = config?.modules;
  const monthSummary = stats?.month_summary;
  const monthlyData = stats?.monthly;

  const statCards = [
    ...(mods?.crm !== false ? [{
      label: 'Total Leads',
      value: loadingStats ? '—' : String(stats?.leads.total ?? 0),
      sub:   stats?.leads.new != null ? `${stats.leads.new} new` : undefined,
      color: '#3b82f6', icon: '🎯',
    }] : []),
    ...(mods?.orders !== false ? [{
      label: 'Orders',
      value: loadingStats ? '—' : String(stats?.orders.total ?? 0),
      sub:   stats?.orders.pending != null ? `${stats.orders.pending} pending` : undefined,
      color: '#f59e0b', icon: '📋',
    }] : []),
    ...(mods?.products !== false ? [{
      label: 'Products',
      value: loadingStats ? '—' : String(stats?.products.total ?? 0),
      sub: undefined, color: '#10b981', icon: '📦',
    }] : []),
    ...(mods?.hr !== false ? [{
      label: 'Employees',
      value: loadingStats ? '—' : String(stats?.employees.active ?? 0),
      sub:   stats?.employees.total != null ? `${stats.employees.total} total` : undefined,
      color: '#8b5cf6', icon: '👥',
    }] : []),
  ];

  const quickActions = [
    ...(mods?.crm !== false      ? [{ icon: '🎯', title: 'Add a Lead',      desc: 'Capture a new sales lead',   to: '/dashboard/crm/leads' }] : []),
    ...(mods?.orders !== false   ? [{ icon: '📋', title: 'Create an Order', desc: 'Start a new customer order', to: '/dashboard/orders/list'    }] : []),
    ...(mods?.products !== false ? [{ icon: '📦', title: 'Manage Products', desc: 'Add or edit your catalogue', to: '/dashboard/products/list'  }] : []),
    ...(mods?.hr !== false       ? [{ icon: '👥', title: 'View Employees',  desc: 'Manage your team',           to: '/dashboard/employees' }] : []),
  ];

  const enabledModules  = ALL_MODULES.filter(m => mods == null || mods[m.key] !== false);
  const disabledModules = ALL_MODULES.filter(m => mods != null && mods[m.key] === false);

  // Combine leads + orders for combined chart (backend returns same months for both)
  const baseSeries = (monthlyData?.leads?.length && monthlyData.leads) || (monthlyData?.orders?.length && monthlyData.orders) || [];
  const chartData = baseSeries.map((item) => {
    const l = (monthlyData?.leads || []).find(x => x.month === item.month);
    const o = (monthlyData?.orders || []).find(x => x.month === item.month);
    return { month: item.month, label: formatMonth(item.month), leads: l?.count ?? 0, orders: o?.count ?? 0 };
  });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.first_name || 'there'} 👋</h1>
        <p className="page-subtitle">
          {config?.company ? config.company : 'Your business'} — overview for today.
        </p>
      </div>

      {/* Compact stat cards */}
      {statCards.length > 0 && (
        <div className="stats-grid-compact">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card-compact">
              <div className="stat-label-compact">
                <span style={{ marginRight: 4 }}>{s.icon}</span>{s.label}
              </div>
              <div className="stat-value-compact" style={{ color: s.color }}>{s.value}</div>
              {s.sub && <div className="stat-sub-compact">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Month summary + charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 24, alignItems: 'stretch' }}>
        {/* Month summary card */}
        {(monthSummary || mods?.crm !== false || mods?.orders !== false) && (
          <div className="card" style={{ minHeight: 180 }}>
            <div className="card-header">
              <h2 className="card-title">Month Summary</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {monthSummary?.month || format(new Date(), 'MMMM yyyy')}
              </p>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mods?.crm !== false && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Leads this month</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#3b82f6' }}>
                    {loadingStats ? '—' : (monthSummary?.leads ?? stats?.leads?.this_month ?? 0)}
                  </span>
                </div>
              )}
              {mods?.orders !== false && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Orders this month</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#f59e0b' }}>
                    {loadingStats ? '—' : (monthSummary?.orders ?? stats?.orders?.this_month ?? 0)}
                  </span>
                </div>
              )}
              {mods?.hr !== false && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Active employees</span>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#8b5cf6' }}>
                    {loadingStats ? '—' : (stats?.employees?.active ?? 0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leads & Orders chart */}
        {chartData.length > 0 && (mods?.crm !== false || mods?.orders !== false) && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Leads & Orders — Last 6 Months</h2>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                  <Tooltip
                    formatter={(value) => [String(value ?? 0), '']}
                    labelFormatter={(l) => l}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {mods?.crm !== false && <Bar dataKey="leads" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />}
                  {mods?.orders !== false && <Bar dataKey="orders" name="Orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Trends area chart (if we have monthly data) */}
      {chartData.length > 0 && mods?.orders !== false && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h2 className="card-title">Order Trend</h2>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(value) => [String(value ?? 0), 'Orders']}
                  labelFormatter={(l) => l}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="orders" stroke="#f59e0b" fill="url(#ordersGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="card-title">Assigned Modules</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Modules enabled for your account by the superadmin.
              </p>
            </div>
            {!loadingConfig && (
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                background: 'var(--color-primary-light, #eff6ff)', color: 'var(--color-primary)',
              }}>
                {enabledModules.length} / {ALL_MODULES.length} active
              </span>
            )}
          </div>
          <div className="card-body">
            {loadingConfig ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>Loading modules…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {enabledModules.map((m) => (
                    <div
                      key={m.key}
                      onClick={() => navigate(m.route)}
                      style={{
                        border: '2px solid var(--color-primary)', borderRadius: 10,
                        padding: '14px 16px', cursor: 'pointer',
                        background: 'var(--color-primary-light, #eff6ff)', transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>{m.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#22c55e', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>ON</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>

                {disabledModules.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                      Not enabled — contact us to unlock
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                      {disabledModules.map((m) => (
                        <div
                          key={m.key}
                          style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px', opacity: 0.55 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <span style={{ fontSize: 20, filter: 'grayscale(1)' }}>{m.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#94a3b8', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>OFF</span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)' }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {quickActions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {quickActions.map((q) => (
                <a
                  key={q.title}
                  href={q.to}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: '16px',
                    border: '1px solid var(--color-border)', borderRadius: 10,
                    textDecoration: 'none', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary, #f8f9fa)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  <span style={{ fontSize: 24 }}>{q.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{q.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{q.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
