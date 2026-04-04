import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/authApi';
import toast from 'react-hot-toast';

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: string; end?: boolean }[];
}

const navSections: NavSection[] = [
  {
    label: 'Main',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: '⊞', end: true }],
  },
  {
    label: 'Clients',
    items: [
      { to: '/dashboard/clients', label: 'All Clients', icon: '🏢' },
      { to: '/dashboard/clients/register', label: 'Register Client', icon: '➕' },
    ],
  },
  {
    label: 'Plans',
    items: [
      { to: '/dashboard/plans', label: 'Manage Plans', icon: '💳' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/dashboard/platform-superadmins', label: 'Platform Super Admins', icon: '🛡️' },
      { to: '/dashboard/users', label: 'Client Admins', icon: '👥' },
      { to: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 99,
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <h1>Trai<span>ding</span></h1>
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
            <div style={{ color: '#64748b', fontSize: 11 }}>{user?.role}</div>
          </div>
          <button onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18, lineHeight: 1 }}
            title="Sign out">⏻</button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main-content">
        <header className="topbar">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hamburger-btn"
            aria-label="Toggle sidebar"
          >☰</button>
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
