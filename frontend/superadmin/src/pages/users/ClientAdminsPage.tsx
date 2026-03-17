import React, { useState, useEffect } from 'react';
import axiosInstance from '@/api/axiosInstance';
import type { ClientAdmin, Tenant } from '@/types';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// ─── API helpers ──────────────────────────────────────────────────────────────

const adminsApi = {
  list: () =>
    axiosInstance.get('/tenants/admins/').then(r => r.data),
  update: (id: number, data: object) =>
    axiosInstance.patch(`/tenants/admins/${id}/`, data).then(r => r.data),
  delete: (id: number) =>
    axiosInstance.delete(`/tenants/admins/${id}/`).then(r => r.data),
  setPassword: (id: number, password: string) =>
    axiosInstance.post(`/tenants/admins/${id}/set-password/`, { password }).then(r => r.data),
};

const tenantsApi = {
  list: () =>
    axiosInstance.get('/tenants/').then(r => r.data),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientAdminsPage() {
  const [admins, setAdmins] = useState<ClientAdmin[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ClientAdmin | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '', is_active: true, tenant_id: '' as string | number,
  });
  const [saving, setSaving] = useState(false);

  // Password: known from set-password flow (lost on refresh); visibility toggle
  const [knownPasswords, setKnownPasswords] = useState<Record<number, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwAdmin, setPwAdmin] = useState<ClientAdmin | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminsApi.list();
      const d = (res as { data: { admins: ClientAdmin[] } }).data;
      setAdmins(d?.admins || []);
    } catch {
      toast.error('Failed to load client admins.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await tenantsApi.list();
      const d = (res as { data: { tenants: Tenant[] } }).data;
      setTenants(d?.tenants || []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    fetchAdmins();
    fetchTenants();
  }, []);

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const openEdit = (admin: ClientAdmin) => {
    setEditing(admin);
    setEditForm({
      first_name: admin.first_name,
      last_name: admin.last_name,
      phone: admin.phone,
      is_active: admin.is_active,
      tenant_id: admin.client_id ?? '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        is_active: editForm.is_active,
        tenant_id: editForm.tenant_id !== '' ? Number(editForm.tenant_id) : null,
      };
      await adminsApi.update(editing.id, payload);
      toast.success('Admin updated.');
      setEditOpen(false);
      fetchAdmins();
    } catch {
      toast.error('Failed to update admin.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (admin: ClientAdmin) => {
    if (!window.confirm(`Delete admin "${admin.full_name || admin.email}" for client "${admin.client_name}"?\n\nThis cannot be undone — the client will lose login access.`)) return;
    try {
      await adminsApi.delete(admin.id);
      toast.success('Admin deleted.');
      fetchAdmins();
    } catch {
      toast.error('Failed to delete admin.');
    }
  };

  // ─── Password ─────────────────────────────────────────────────────────────
  // Passwords are hashed; we can only show after superadmin sets a new one.

  const openSetPassword = (admin: ClientAdmin) => {
    setPwAdmin(admin);
    setPwValue('');
    setPwConfirm('');
    setPwModalOpen(true);
  };

  const handleSetPasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwAdmin || pwValue.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (pwValue !== pwConfirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await adminsApi.setPassword(pwAdmin.id, pwValue);
      setKnownPasswords((prev) => ({ ...prev, [pwAdmin.id]: pwValue }));
      setVisiblePasswords((prev) => new Set(prev).add(pwAdmin.id));
      toast.success('Password updated. Share it securely with the client admin.');
      setPwModalOpen(false);
      setPwAdmin(null);
      setPwValue('');
      setPwConfirm('');
    } catch {
      toast.error('Failed to set password.');
    } finally {
      setPwSaving(false);
    }
  };

  const togglePasswordVisibility = (adminId: number) => {
    if (knownPasswords[adminId]) {
      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        if (next.has(adminId)) next.delete(adminId);
        else next.add(adminId);
        return next;
      });
    } else {
      const admin = admins.find((a) => a.id === adminId);
      if (admin) openSetPassword(admin);
    }
  };

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = admins.filter(a => {
    const q = search.toLowerCase();
    return !q ||
      a.email.toLowerCase().includes(q) ||
      a.full_name.toLowerCase().includes(q) ||
      a.client_name.toLowerCase().includes(q);
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Client Admins</h1>
            <p className="page-subtitle">All tenant admin users created during client registration.</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h2 className="card-title">All Admins ({filtered.length})</h2>
          <input
            className="form-input"
            style={{ width: 260 }}
            placeholder="Search by name, email or client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {search ? 'No admins match your search.' : 'No client admins yet. Register a client to create one.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Client</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((admin, idx) => (
                  <tr key={admin.id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--color-primary)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {(admin.first_name?.[0] || admin.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {admin.full_name || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{admin.email}</td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{admin.phone || '—'}</td>
                    <td>
                      {admin.client_id ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, background: 'var(--color-bg-secondary, #f1f5f9)',
                          padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                        }}>
                          🏢 {admin.client_name}
                        </span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', color: 'var(--color-warning, #f59e0b)', borderColor: 'var(--color-warning, #f59e0b)' }}
                          onClick={() => openEdit(admin)}
                        >
                          ⚠ Link client
                        </button>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {new Date(admin.date_joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={`badge ${admin.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                          {knownPasswords[admin.id]
                            ? (visiblePasswords.has(admin.id) ? knownPasswords[admin.id] : '••••••••')
                            : '••••••••'}
                        </code>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          onClick={() => togglePasswordVisibility(admin.id)}
                          title={knownPasswords[admin.id] ? (visiblePasswords.has(admin.id) ? 'Hide' : 'Show') : 'Set password'}
                        >
                          {knownPasswords[admin.id] && visiblePasswords.has(admin.id)
                            ? <FaEyeSlash size={14} />
                            : <FaEye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(admin)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(admin)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Edit modal ────────────────────────────────────────────────────────── */}
      {editOpen && editing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !saving && setEditOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 480, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Edit Admin</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !saving && setEditOpen(false)}>Close</button>
            </div>

            <form className="card-body" onSubmit={handleEditSave}>
              {/* Email info */}
              <div style={{ background: 'var(--color-bg-secondary, #f8fafc)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email: </span>
                <strong>{editing.email}</strong>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>Email cannot be changed here.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="form-input" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input className="form-input" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>

              {/* Link to client */}
              <div className="form-group">
                <label className="form-label">Linked Client</label>
                <select
                  className="form-select"
                  value={editForm.tenant_id}
                  onChange={e => setEditForm(f => ({ ...f, tenant_id: e.target.value }))}
                >
                  <option value="">— Not linked to any client —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Link this admin to the correct client so their name shows in the table.
                </span>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Active (can log in)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Set Password modal ────────────────────────────────────────────────── */}
      {pwModalOpen && pwAdmin && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !pwSaving && setPwModalOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Set Password</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => !pwSaving && setPwModalOpen(false)}>Close</button>
            </div>
            <div style={{ padding: '0 20px 20px', fontSize: 13, color: 'var(--color-text-muted)' }}>
              For {pwAdmin.full_name || pwAdmin.email}. Password will be visible in the table after you set it.
            </div>
            <form className="card-body" onSubmit={handleSetPasswordSave} style={{ paddingTop: 0 }}>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwValue}
                  onChange={e => setPwValue(e.target.value)}
                  placeholder="Min 6 characters"
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <input
                  type="password"
                  className="form-input"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPwModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Setting…' : 'Set password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
