import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/authApi';
import { configApi } from '@/api/businessApi';
import { hrApi } from '@/api/hrApi';
import type { TenantConfig, TenantModules } from '@/types';
import toast from 'react-hot-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [myPerms, setMyPerms] = useState<Record<string, { can_view: boolean }>>({});

  const role = user?.role ?? '';
  const isAdmin = role === 'tenant_admin' || role === 'super_admin';
  const isStaff = isAdmin || role === 'staff';

  // Load tenant config to know which modules are enabled
  useEffect(() => {
    configApi.get()
      .then((res: { data?: TenantConfig } | TenantConfig) => {
        // Handle both wrapped and unwrapped responses
        const d = (res as { data?: TenantConfig }).data ?? (res as TenantConfig);
        if (d) setConfig(d);
      })
      .catch(() => { /* non-critical — fall back to showing all items */ });
  }, []);

  // Load current user's module permissions (employees only — admins see all)
  useEffect(() => {
    if (isAdmin) return;
    hrApi.permissions
      .my()
      .then((res) => {
        const modules = (res as { data?: { modules?: Record<string, { can_view?: boolean }> } })?.data?.modules ?? {};
        setMyPerms(modules);
      })
      .catch(() => { /* non-critical — employee will see no modules until perms assigned */ });
  }, [isAdmin]);

  // config.modules is the nested { crm, products, ... } object from the API
  const m = config?.modules;
  const mod = (flag: keyof TenantModules) => m == null || !!m[flag];
  // Employees: only show module if tenant has it AND user has can_view. Admins: always show if tenant has it.
  const canAccess = (flag: keyof TenantModules) =>
    mod(flag) && (isAdmin || !!myPerms[flag]?.can_view);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    logout();
    toast.success('Signed out.');
    navigate('/login');
  };

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?';

  const companyName = (config as unknown as { company_name?: string })?.company_name || config?.company || 'Trading';

  // ── Build nav sections based on role + enabled modules ─────────────────────
  type NavItem = { to: string; label: string; icon: string; end?: boolean };

  // Dispatch sub-items (when dispatch module enabled)
  const dispatchItems: NavItem[] = [
    { to: '/dashboard/dispatch', label: 'Dispatch', icon: '🚚' },
    ...(isAdmin ? [{ to: '/dashboard/dispatch/settings', label: 'Dispatch Settings', icon: '⚙️' }] : []),
  ];

  // Modules list (excludes CRM, Products, Orders, Invoices, Inventory, Dispatch which get their own sections)
  const moduleItems: NavItem[] = [
    ...(canAccess('tracking')      ? [{ to: '/dashboard/tracking',        label: 'Tracking',      icon: '📍' }] : []),
    ...(canAccess('manufacturing') ? [{ to: '/dashboard/manufacturing',   label: 'Manufacturing', icon: '⚙️' }] : []),
    ...(canAccess('analytics')     ? [{ to: '/dashboard/analytics',       label: 'Analytics',     icon: '📊' }] : []),
    ...(canAccess('hr') && isStaff ? [{ to: '/dashboard/employees',       label: 'HR',            icon: '👥' }] : []),
  ];

  // Invoices sub-items
  const invoiceItems: NavItem[] = [
    { to: '/dashboard/invoices/list',     label: 'Invoices',          icon: '🧾' },
    ...(isAdmin ? [{ to: '/dashboard/invoices/settings', label: 'Invoice Settings', icon: '⚙️' }] : []),
  ];

  // Orders sub-items — include Warehouse Approvals so users find where approved orders go
  const orderItems: NavItem[] = [
    { to: '/dashboard/orders/list',     label: 'Orders',             icon: '📋' },
    ...(canAccess('orders') ? [{ to: '/dashboard/inventory/approvals', label: 'Warehouse Approvals', icon: '✅' }] : []),
    ...(isAdmin ? [{ to: '/dashboard/orders/settings', label: 'Order Settings', icon: '⚙️' }] : []),
  ];

  // Products sub-items
  const productItems: NavItem[] = [
    { to: '/dashboard/products/list',     label: 'Products',         icon: '🛍️' },
    ...(isAdmin ? [{ to: '/dashboard/products/settings', label: 'Product Settings', icon: '⚙️' }] : []),
  ];

  // CRM sub-items — Leads for all staff, CRM Settings for admin only
  const crmItems: NavItem[] = [
    { to: '/dashboard/crm/leads',    label: 'Leads',        icon: '🎯' },
    ...(isAdmin ? [{ to: '/dashboard/crm/settings', label: 'CRM Settings', icon: '⚙️' }] : []),
  ];

  // Inventory sub-items — stock/warehouse module flags control visibility
  const inventoryEnabled = canAccess('stock') || canAccess('warehouse');
  const inventoryItems: NavItem[] = [
    { to: '/dashboard/inventory/stock',     label: 'Stock Levels', icon: '📦' },
    { to: '/dashboard/inventory/movements', label: 'Movements',    icon: '↕️' },
    { to: '/dashboard/inventory/warehouses', label: 'Warehouses',  icon: '🏭' },
    { to: '/dashboard/inventory/transfers', label: 'Transfers',    icon: '🔀' },
    { to: '/dashboard/inventory/analysis',  label: 'Analysis',     icon: '📈' },
    { to: '/dashboard/inventory/approvals', label: 'Approvals',    icon: '✅' },
    ...(isAdmin ? [{ to: '/dashboard/inventory/settings', label: 'Inv. Settings', icon: '⚙️' }] : []),
  ];

  const navSections: { label: string; items: NavItem[] }[] = [
    {
      label: 'Main',
      items: [{ to: '/dashboard', label: 'Dashboard', icon: '⊞', end: true }],
    },
    // Admin section — only for tenant_admin / super_admin
    ...(isAdmin ? [{
      label: 'Admin',
      items: [
        { to: '/dashboard/settings',    label: 'Settings',    icon: '⚙️' },
        { to: '/dashboard/permissions', label: 'Permissions', icon: '🔐' },
        { to: '/dashboard/history',     label: 'History',     icon: '📜' },
      ],
    }] : []),
    // CRM as its own section (when enabled)
    ...(canAccess('crm') ? [{
      label: 'CRM',
      items: crmItems,
    }] : []),
    // Orders as its own section (when enabled)
    ...(canAccess('orders') ? [{
      label: 'Orders',
      items: orderItems,
    }] : []),
    // Invoices as its own section (when enabled)
    ...(canAccess('invoices') ? [{
      label: 'Invoices',
      items: invoiceItems,
    }] : []),
    // Dispatch as its own section (when enabled)
    ...(canAccess('dispatch') ? [{
      label: 'Dispatch',
      items: dispatchItems,
    }] : []),
    // Products as its own section (when enabled)
    ...(canAccess('products') ? [{
      label: 'Products',
      items: productItems,
    }] : []),
    // Inventory as its own section (when stock or warehouse module enabled)
    ...(inventoryEnabled ? [{
      label: 'Inventory',
      items: inventoryItems,
    }] : []),
    // All other enabled modules
    ...(moduleItems.length > 0 ? [{
      label: 'Modules',
      items: moduleItems,
    }] : []),
  ];

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <h1>{companyName}</h1>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name || user?.email}
            </div>
            <div style={{ color: '#64748b', fontSize: 11, textTransform: 'capitalize' }}>
              {role === 'tenant_admin' ? 'Admin' : role === 'super_admin' ? 'Super Admin' : role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, lineHeight: 1 }}
            title="Sign out"
          >⏻</button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main-content">
        <header className="topbar">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hamburger-btn" aria-label="Toggle sidebar">☰</button>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar">{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name || user?.email}</span>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
