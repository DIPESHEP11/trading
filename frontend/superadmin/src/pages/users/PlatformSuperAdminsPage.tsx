import { useState, useEffect, type FormEvent } from 'react';
import { userApi } from '@/api/userApi';
import type { User } from '@/types';
import toast from 'react-hot-toast';

export default function PlatformSuperAdminsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await userApi.platformSuperAdmins.list();
      const d = (res as { data?: { users?: User[] } }).data;
      setUsers(d?.users ?? []);
    } catch {
      toast.error('Failed to load platform super admins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await userApi.platformSuperAdmins.create({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirm: form.password_confirm,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      toast.success('Platform super admin created.');
      setForm({
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
      });
      load();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg =
        ex?.response?.data?.message ||
        (ex?.response?.data?.errors && JSON.stringify(ex.response.data.errors)) ||
        'Failed to create user.';
      toast.error(typeof msg === 'string' ? msg : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform super admins</h1>
          <p className="page-subtitle">
            Create and view accounts that can access this Superadmin portal. Only existing platform super admins can add new ones.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2 className="card-title" style={{ marginBottom: 16 }}>Add platform super admin</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email *</label>
              <input
                className="form-input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="name@company.com"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">First name</label>
                <input
                  className="form-input"
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Last name</label>
                <input
                  className="form-input"
                  value={form.last_name}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password *</label>
              <input
                className="form-input"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirm password *</label>
              <input
                className="form-input"
                type="password"
                required
                minLength={6}
                value={form.password_confirm}
                onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create platform super admin'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All platform super admins ({users.length})</h2>
        </div>
        {loading ? (
          <div className="card-body" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.email}</strong></td>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.is_active ? 'Yes' : 'No'}</td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {u.date_joined ? new Date(u.date_joined).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="card-body" style={{ color: 'var(--color-text-muted)' }}>No platform super admins yet.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
